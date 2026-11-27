import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import offline from '../fixtures/offline.json';
import playing from '../fixtures/playing.json';
import app from '../src/index';
import { PRESENCE_KEY, SNAPSHOT_MAX_AGE_MS } from '../src/storage/presence';
import worker from '../src/worker';
import { memoryKv } from './helpers/memory-kv';

const now = Date.parse('2026-11-27T08:00:00.000Z');
const interval = 120_000;
const endpoint = 'https://presence.example.invalid/json?key=private';

function tick(scheduledTime = Date.now()) {
  return { scheduledTime, cron: '*/2 * * * *', noRetry: vi.fn() };
}

beforeEach(() => vi.setSystemTime(now));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('refreshes once per tick, skips delayed duplicates, and updates without a card request', async () => {
  const kv = memoryKv();
  const env = { PRESENCE_KV: kv, NXAPI_PRESENCE_URL: endpoint };
  const fetch = vi.fn()
    .mockResolvedValueOnce(Response.json(playing))
    .mockResolvedValueOnce(Response.json(offline));
  vi.stubGlobal('fetch', fetch);

  const first = tick();
  await worker.scheduled(first, env);
  expect(first.noRetry).toHaveBeenCalledOnce();
  expect(kv.put).toHaveBeenCalledTimes(1);
  expect(JSON.parse(await kv.get(PRESENCE_KEY))).toMatchObject({
    refreshedAt: new Date(now).toISOString(),
    presence: { status: 'playing', game: { title: 'Starlight Trails' } },
    assets: { avatarDataUri: null, gameImageDataUri: null },
  });

  vi.setSystemTime(now + interval);
  await worker.scheduled(tick(), env);
  await worker.scheduled(first, env);
  expect(kv.getWithMetadata).toHaveBeenCalledWith(PRESENCE_KEY, 'stream');
  expect(kv.put).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(JSON.parse(await kv.get(PRESENCE_KEY))).toMatchObject({
    refreshedAt: new Date(now + interval).toISOString(),
    presence: { status: 'offline', game: null },
  });
});

it('avoids a concurrent refresh in the same isolate', async () => {
  const kv = memoryKv();
  const env = { PRESENCE_KV: kv, NXAPI_PRESENCE_URL: endpoint };
  let markEntered!: () => void;
  let finishFetch!: (response: Response) => void;
  const entered = new Promise<void>((resolve) => { markEntered = resolve; });
  const pending = new Promise<Response>((resolve) => { finishFetch = resolve; });
  const fetch = vi.fn().mockImplementation(async () => {
    markEntered();
    return pending;
  });
  vi.stubGlobal('fetch', fetch);

  const first = worker.scheduled(tick(), env);
  await entered;
  try {
    await worker.scheduled(tick(), env);
    expect(fetch).toHaveBeenCalledOnce();
  } finally {
    finishFetch(Response.json(playing));
    await first;
  }
  expect(kv.put).toHaveBeenCalledOnce();
});

it('reports consecutive failures securely, keeps the last good data, and recovers on a later tick', async () => {
  const kv = memoryKv();
  const env = { PRESENCE_KV: kv, NXAPI_PRESENCE_URL: endpoint };
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const fetch = vi.fn()
    .mockResolvedValueOnce(Response.json(playing))
    .mockResolvedValueOnce(new Response(endpoint, { status: 503 }))
    .mockResolvedValueOnce(new Response(endpoint, { status: 503 }))
    .mockResolvedValueOnce(Response.json(offline));
  vi.stubGlobal('fetch', fetch);

  await worker.scheduled(tick(), env);
  const previous = await kv.get(PRESENCE_KEY);
  for (const elapsed of [interval, SNAPSHOT_MAX_AGE_MS]) {
    vi.setSystemTime(now + elapsed);
    const event = tick();
    await expect(worker.scheduled(event, env)).rejects.toThrow('Presence refresh failed');
    expect(event.noRetry).toHaveBeenCalledOnce();
    expect(await kv.get(PRESENCE_KEY)).toBe(previous);
  }
  expect(log.mock.calls).toEqual(Array.from({ length: 2 }, () =>
    ['presence_refresh_failed', { stage: 'presence', code: 'http', status: 503 }],
  ));

  const response = await app.request('/card.svg', {}, env);
  expect(await response.text()).toContain('状態を取得できません');
  expect(fetch).toHaveBeenCalledTimes(3);

  vi.setSystemTime(now + SNAPSHOT_MAX_AGE_MS + interval);
  await worker.scheduled(tick(), env);
  expect(kv.put).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenCalledTimes(4);
});

it('reports a failed KV write without exposing the storage error', async () => {
  const kv = memoryKv();
  kv.put.mockRejectedValue(new Error('private storage detail'));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(playing)));
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});

  await expect(worker.scheduled(tick(), { PRESENCE_KV: kv, NXAPI_PRESENCE_URL: endpoint }))
    .rejects.toThrow('Presence refresh failed');
  expect(log).toHaveBeenCalledExactlyOnceWith('presence_refresh_failed', {
    stage: 'storage', code: 'request-failed', status: undefined,
  });
  expect(await kv.get(PRESENCE_KEY)).toBeNull();
});
