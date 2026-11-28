import { execFileSync } from 'node:child_process';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import playingFixture from '../fixtures/playing.json';
import app from '../src/index';
import { memoryKv } from './helpers/memory-kv';
import { mockNintendo, nintendoEnv } from './helpers/nintendo-upstream.mjs';

let refreshPresence;

beforeAll(async () => {
  execFileSync(process.execPath, ['scripts/build-worker.mjs', '--refresh']);
  const entry = new URL('../.wrangler/worker/refresh.mjs', import.meta.url).href;
  ({ refreshPresence } = await import(/* @vite-ignore */ entry));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockFetch(upstream) {
  vi.stubGlobal('fetch', async (url, init) => {
    expect(init.redirect).toBe('manual');
    const response = await upstream.fetch(new Request(url, init));
    Object.defineProperty(response, 'url', { value: String(url) });
    return response;
  });
}

async function refreshCard(env, path = '/card.svg') {
  const kv = memoryKv();
  await refreshPresence({ ...env, PRESENCE_KV: kv });
  return app.request(path, {}, { PRESENCE_KV: kv });
}

it('renders Coral presence, reuses its token, and retries once after token expiry', async () => {
  const upstream = mockNintendo();
  mockFetch(upstream);
  const env = { ...nintendoEnv, NXAPI_PRESENCE_URL: 'https://unused.invalid' };

  const playing = await refreshCard(env, '/card.svg?style=minutes');
  expect(playing.headers.get('Cache-Control')).toBe('public, max-age=90');
  const svg = await playing.text();
  expect(svg).toContain('Coral Test Game');
  expect(svg).toContain('2.4時間');
  expect(svg).not.toContain('test-session-token');

  upstream.presence = { state: 'INACTIVE' };
  const online = await (await refreshCard(env)).text();
  expect(online).toContain('>オンライン</text>');
  expect(online).not.toContain('Coral Test Game');
  expect(upstream.calls.filter((path) => path === '/v4/Account/Login')).toHaveLength(1);

  upstream.presence = { state: 'OFFLINE' };
  upstream.expired = true;
  const offline = await (await refreshCard(env)).text();
  expect(offline).toContain('>オフライン</text>');
  expect(upstream.calls.filter((path) => path === '/v4/Account/Login')).toHaveLength(2);
  expect(upstream.calls.filter((path) => path === '/v4/Friend/Show')).toHaveLength(4);
});

it.each([
  ['nintendo-account', 'authentication', '/connect/1.0.0/api/token', 400, 'invalid_grant'],
  ['nxapi-auth', 'http', '/api/oauth/token', 503, 'server_error'],
  ['nxapi-config', 'http', '/api/nxapi/config', 503, 'server_error'],
])('reports %s failures without exposing the SDK error or writing to KV', async (stage, code, path, status, error) => {
  const upstream = mockNintendo();
  upstream.error = { path, status, body: { error, details: nintendoEnv.NINTENDO_SESSION_TOKEN } };
  mockFetch(upstream);
  const kv = memoryKv();
  const env = { ...nintendoEnv, PRESENCE_KV: kv, NINTENDO_SESSION_TOKEN: nintendoEnv.NINTENDO_SESSION_TOKEN + stage };

  const update = refreshPresence(env);
  await expect(update).rejects.toMatchObject({ stage, code, status });
  await expect(update).rejects.not.toThrow(nintendoEnv.NINTENDO_SESSION_TOKEN);
  expect(kv.put).not.toHaveBeenCalled();
  expect(upstream.calls).not.toContain('/v4/Friend/Show');
});

it('rejects malformed Coral presence before writing KV', async () => {
  const upstream = mockNintendo();
  upstream.presence = { state: 'UNRECOGNIZED' };
  mockFetch(upstream);
  const kv = memoryKv();
  await expect(refreshPresence({ ...nintendoEnv, PRESENCE_KV: kv })).rejects.toMatchObject({
    stage: 'nintendo', code: 'invalid-response',
  });
  expect(kv.put).not.toHaveBeenCalled();
});

it('embeds a Nintendo CDN image and skips the JSON provider proxy in self mode', async () => {
  const upstream = mockNintendo();
  const proxyOrigin = 'https://presence.example.invalid';
  const avatarUrl = 'https://cdn-image-e0d67c509fb203858ebcb2fe3f88c2aa.baas.nintendo.com/avatar.png';
  upstream.avatarUrl = avatarUrl;
  upstream.presence.game.imageUri = proxyOrigin + '/api/presence/resources/atum/game.png';
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP8gAAAAASUVORK5CYII=', 'base64');
  const fetch = vi.fn((request) => request.url === avatarUrl
    ? new Response(png, { headers: { 'Content-Type': 'image/png' } })
    : upstream.fetch(request));
  mockFetch({ fetch });

  const response = await refreshCard({ ...nintendoEnv, NXAPI_PRESENCE_URL: proxyOrigin + '/json' });
  const svg = await response.text();
  expect(svg).toContain('Coral Test Game');
  expect(svg.match(/<image /g)).toHaveLength(1);
  expect(svg).toContain('href="data:image/png;base64,' + png.toString('base64') + '"');
  expect(fetch.mock.calls.some(([request]) => request.url.startsWith(proxyOrigin))).toBe(false);
});

it('switches providers while rendering the same card URL from the same KV binding', async () => {
  const kv = memoryKv();
  const direct = { ...nintendoEnv, PRESENCE_KV: kv };
  mockFetch(mockNintendo());
  await refreshPresence(direct);
  const cardUrl = '/card.svg?style=orbit';
  expect(await (await app.request(cardUrl, {}, { PRESENCE_KV: kv })).text()).toContain('Coral Test Game');

  const endpoint = 'https://presence.example.invalid/json?key=private-url';
  const fetch = vi.fn().mockResolvedValue(Response.json(playingFixture));
  vi.stubGlobal('fetch', fetch);
  await refreshPresence({ ...direct, PRESENCE_SOURCE: 'nxapi-auth', NXAPI_PRESENCE_URL: endpoint });
  expect(String(fetch.mock.calls[0][0])).toBe(endpoint);
  fetch.mockClear();

  const svg = await (await app.request(cardUrl, {}, { PRESENCE_KV: kv })).text();
  expect(svg).toContain('Starlight Trails');
  expect(svg).not.toContain('Coral Test Game');
  expect(svg).not.toContain('private-url');
  expect(fetch).not.toHaveBeenCalled();
  expect(kv.put.mock.calls.map(([key]) => key)).toEqual(['presence:current', 'presence:current']);
});
