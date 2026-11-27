import { execFileSync } from 'node:child_process';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { mockNintendo, nintendoEnv } from './helpers/nintendo-upstream.mjs';

let app;

beforeAll(async () => {
  execFileSync(process.execPath, ['scripts/build-worker.mjs']);
  const entry = new URL('../.wrangler/worker/index.mjs', import.meta.url).href;
  ({ default: app } = await import(/* @vite-ignore */ entry));
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

it('renders Coral presence, reuses its token, and retries once after token expiry', async () => {
  const upstream = mockNintendo();
  mockFetch(upstream);
  const env = { ...nintendoEnv, NXAPI_PRESENCE_URL: 'https://unused.invalid' };

  const playing = await app.request('/card.svg?style=minutes', {}, env);
  expect(playing.headers.get('Cache-Control')).toBe('public, max-age=90');
  const svg = await playing.text();
  expect(svg).toContain('Coral Test Game');
  expect(svg).toContain('145分');
  expect(svg).not.toContain('test-session-token');

  upstream.presence = { state: 'INACTIVE' };
  const online = await (await app.request('/card.svg', {}, env)).text();
  expect(online).toContain('>オンライン</text>');
  expect(online).not.toContain('Coral Test Game');
  expect(upstream.calls.filter((path) => path === '/v4/Account/Login')).toHaveLength(1);

  upstream.presence = { state: 'OFFLINE' };
  upstream.expired = true;
  const offline = await (await app.request('/card.svg', {}, env)).text();
  expect(offline).toContain('>オフライン</text>');
  expect(upstream.calls.filter((path) => path === '/v4/Account/Login')).toHaveLength(2);
  expect(upstream.calls.filter((path) => path === '/v4/Friend/Show')).toHaveLength(4);
});

it.each([
  ['nintendo-account', 'authentication', '/connect/1.0.0/api/token', 400, 'invalid_grant'],
  ['nxapi-auth', 'http', '/api/oauth/token', 503, 'server_error'],
  ['nxapi-config', 'http', '/api/nxapi/config', 503, 'server_error'],
])('reports %s failures without exposing the SDK error or caching the SVG', async (stage, code, path, status, error) => {
  const upstream = mockNintendo();
  upstream.error = { path, status, body: { error, details: nintendoEnv.NINTENDO_SESSION_TOKEN } };
  mockFetch(upstream);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const env = { ...nintendoEnv, NINTENDO_SESSION_TOKEN: nintendoEnv.NINTENDO_SESSION_TOKEN + stage };

  const response = await app.request('/card.svg', {}, env);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.text()).toContain('状態を取得できません');
  expect(warn).toHaveBeenCalledExactlyOnceWith('presence_unavailable', { source: 'self', stage, code, status });
  expect(upstream.calls).not.toContain('/v4/Friend/Show');
});

it('rejects malformed Coral presence instead of caching it as offline', async () => {
  const upstream = mockNintendo();
  upstream.presence = { state: 'UNRECOGNIZED' };
  mockFetch(upstream);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const response = await app.request('/card.svg', {}, nintendoEnv);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.text()).toContain('状態を取得できません');
  expect(warn).toHaveBeenCalledExactlyOnceWith('presence_unavailable', {
    source: 'self', stage: 'nintendo', code: 'invalid-response', status: undefined,
  });
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

  const response = await app.request('/card.svg', {}, { ...nintendoEnv, NXAPI_PRESENCE_URL: proxyOrigin + '/json' });
  const svg = await response.text();
  expect(svg).toContain('Coral Test Game');
  expect(svg.match(/<image /g)).toHaveLength(1);
  expect(svg).toContain('href="data:image/png;base64,' + png.toString('base64') + '"');
  expect(fetch.mock.calls.some(([request]) => request.url.startsWith(proxyOrigin))).toBe(false);
});
