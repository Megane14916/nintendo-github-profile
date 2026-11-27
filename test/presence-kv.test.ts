import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import playing from '../fixtures/playing.json';
import app from '../src/index';
import { refreshPresence } from '../src/jobs/refresh-presence';
import { PRESENCE_KEY, SNAPSHOT_MAX_AGE_MS, type PresenceSnapshot } from '../src/storage/presence';
import { memoryKv } from './helpers/memory-kv';

const now = Date.parse('2026-11-27T08:00:00.000Z');
const endpoint = 'https://presence.example.invalid/json?key=private-presence-url';
const gameImage = 'https://atum-img-lp1.cdn.nintendo.net/game.png?key=private-image-url';
const avatar = 'https://cdn-image-e0d67c509fb203858ebcb2fe3f88c2aa.baas.nintendo.com/avatar.png';
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP8gAAAAASUVORK5CYII=';
const dataUri = 'data:image/png;base64,' + png;

function snapshot(age = 0): PresenceSnapshot {
  return {
    schemaVersion: 1,
    presence: {
      status: 'playing',
      user: { name: 'Sample Player', avatarUrl: null },
      game: { title: 'Starlight Trails', imageUrl: null, totalPlayTimeMinutes: 125 },
      fetchedAt: new Date(now - age).toISOString(),
    },
    assets: { avatarDataUri: dataUri, gameImageDataUri: dataUri },
    refreshedAt: new Date(now - age).toISOString(),
  };
}

beforeEach(() => vi.setSystemTime(now));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('KV presence cards', () => {
  it('refreshes one snapshot and renders the saved data and images without further upstream fetches', async () => {
    const kv = memoryKv();
    const env = { PRESENCE_KV: kv, PRESENCE_SOURCE: 'nxapi-auth', NXAPI_PRESENCE_URL: endpoint };
    const image = () => new Response(Uint8Array.from(atob(png), (char) => char.charCodeAt(0)), {
      headers: { 'Content-Type': 'image/png' },
    });
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({
      friend: {
        ...playing.friend,
        image2Uri: avatar,
        presence: { ...playing.friend.presence, game: { ...playing.friend.presence.game, imageUri: gameImage } },
      },
    })).mockImplementation(image);
    vi.stubGlobal('fetch', fetch);

    await expect(refreshPresence(env)).resolves.toBe(new Date(now).toISOString());
    expect(kv.put).toHaveBeenCalledExactlyOnceWith(PRESENCE_KEY, expect.any(String), {
      metadata: { refreshedAt: new Date(now).toISOString() },
    });
    const stored = await kv.get(PRESENCE_KEY);
    expect(JSON.parse(stored)).toEqual(snapshot());
    expect(stored).not.toContain('private-presence-url');
    expect(stored).not.toContain('private-image-url');
    expect(stored).not.toContain(avatar);
    expect(fetch).toHaveBeenCalledTimes(3);
    fetch.mockClear();

    const response = await app.request('/card.svg', {}, env);
    expect(response.headers.get('Content-Type')).toBe('image/svg+xml; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=90');
    const svg = await response.text();
    expect(svg).toContain('Starlight Trails');
    expect(svg).toContain('合計プレイ時間 125分');
    expect(svg.match(/<image /g)).toHaveLength(2);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['empty', null],
    ['malformed JSON', '{'],
    ['invalid schema version', JSON.stringify({ ...snapshot(), schemaVersion: 2 })],
    ['invalid date', JSON.stringify({ ...snapshot(), refreshedAt: 'bad' })],
    ['stale', JSON.stringify(snapshot(SNAPSHOT_MAX_AGE_MS))],
    ['future dated', JSON.stringify(snapshot(-1000))],
    ['unsafe image', JSON.stringify({ ...snapshot(), assets: { ...snapshot().assets, gameImageDataUri: 'data:image/svg+xml;base64,PHN2Zz4=' } })],
  ])('shows an uncached unknown state for a %s snapshot without reaching the provider', async (_reason, value) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const kv = memoryKv(value);
    const response = await app.request('/card.svg', {}, { PRESENCE_KV: kv, NXAPI_PRESENCE_URL: endpoint });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const svg = await response.text();
    expect(svg).toContain('状態を取得できません');
    expect(svg).not.toContain('Starlight Trails');
    expect(svg).not.toContain('<image ');
    expect(kv.get).toHaveBeenCalledExactlyOnceWith(PRESENCE_KEY);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps the previous snapshot when refreshing the provider fails', async () => {
    const previous = JSON.stringify(snapshot(1000));
    const kv = memoryKv(previous);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'unavailable' }, { status: 503 })));
    await expect(refreshPresence({ PRESENCE_KV: kv, NXAPI_PRESENCE_URL: endpoint })).rejects.toThrow('presence: http');
    expect(await kv.get(PRESENCE_KEY)).toBe(previous);
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('limits response caching to the freshness remaining in KV', async () => {
    const kv = memoryKv(JSON.stringify(snapshot(SNAPSHOT_MAX_AGE_MS - 5000)));
    const response = await app.request('/card.svg?style=orbit', {}, { PRESENCE_KV: kv });
    expect(await response.text()).toContain('Starlight Trails');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=5');
  });

  it('renders an explicit preview without touching KV', async () => {
    const kv = memoryKv();
    const response = await app.request('/card.svg', {}, { PRESENCE_KV: kv, PREVIEW_STATUS: 'offline' });
    expect(await response.text()).toContain('オフライン');
    expect(kv.get).not.toHaveBeenCalled();
  });

  it('renders unknown when the KV read fails, without exposing the error', async () => {
    const kv = memoryKv();
    kv.get.mockRejectedValue(new Error('private KV detail'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = await app.request('/card.svg', {}, { PRESENCE_KV: kv });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.text()).toContain('状態を取得できません');
    expect(warn).toHaveBeenCalledExactlyOnceWith('presence_kv_unavailable');
  });
});
