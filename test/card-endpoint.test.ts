import { afterEach, describe, expect, it, vi } from 'vitest';
import playing from '../fixtures/playing.json';
import app from '../src/index';
import { PRESENCE_TIMEOUT_MS, type Bindings } from '../src/config';
import { refreshPresence } from '../src/jobs/refresh-presence';
import { concepts } from '../src/render/layouts/concepts';
import { cardLayouts } from '../src/render/layouts/presets';
import { redTreatments } from '../src/render/themes';
import { memoryKv } from './helpers/memory-kv';

const endpoint = 'https://presence.example.invalid/json?key=sample-secret';
const env = { NXAPI_PRESENCE_URL: endpoint, PREVIEW_STATUS: '' };
const gameImage = 'https://atum-img-lp1.cdn.nintendo.net/game.png';
const avatar = 'https://cdn-image-e0d67c509fb203858ebcb2fe3f88c2aa.baas.nintendo.com/avatar.png';
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP8gAAAAASUVORK5CYII=';

function payload(imageUri: string, image2Uri?: string) {
  return {
    friend: {
      ...playing.friend,
      image2Uri,
      presence: {
        ...playing.friend.presence,
        game: { ...playing.friend.presence.game, imageUri },
      },
    },
  };
}

async function refreshCard(bindings: Bindings = env): Promise<Response> {
  const kv = memoryKv();
  await refreshPresence({ ...bindings, PRESENCE_KV: kv });
  return app.request('/card.svg', {}, { PRESENCE_KV: kv });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GET /card.svg', () => {
  it.each([
    ['playing', 'オンライン'],
    ['online', 'オンライン'],
    ['offline', 'オフライン'],
    ['unknown', '状態を取得できません'],
  ])('serves the %s fixture without external requests', async (PREVIEW_STATUS, label) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    const response = await app.request('/card.svg', {}, { PREVIEW_STATUS });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/svg+xml; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.text()).toContain(label);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('ignores request parameters for both the fixture and the upstream URL', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    const response = await app.request('/card.svg?status=playing&url=https://example.invalid', {}, {
      ...env,
    });
    expect(await response.text()).toContain('状態を取得できません');
    expect(fetch).not.toHaveBeenCalled();
    expect((await app.request('/health')).status).toBe(404);
  });

  it.each([
    ['green', 'fill="#14643C" stroke="#14643C"'],
    ['profile', '<text x="55" y="37"'],
    ['editorial', 'font-family="Noto Serif JP,'],
  ])('renders the selected %s design', async (style, marker) => {
    const response = await app.request('/card.svg?style=' + style, {}, { PREVIEW_STATUS: 'playing' });
    const svg = await response.text();
    expect(svg).toContain('>オンライン</text>');
    expect(svg).toContain(marker);
    expect(svg).toContain('Starlight Trails');
  });

  it('renders 36 distinct red designs in all four presence states', async () => {
    const styles = Object.keys(cardLayouts).flatMap((layout) =>
      Object.keys(redTreatments).map((treatment) => layout + '-' + treatment),
    );
    expect(styles).toHaveLength(36);

    const states = [
      ['playing', 'オンライン'],
      ['online', 'オンライン'],
      ['offline', 'オフライン'],
      ['unknown', '状態を取得できません'],
    ];
    for (const [PREVIEW_STATUS, label] of states) {
      const cards = await Promise.all(styles.map(async (style) => {
        const response = await app.request('/card.svg?style=' + style, {}, { PREVIEW_STATUS });
        expect(response.status).toBe(200);
        return response.text();
      }));
      expect(new Set(cards).size).toBe(36);
      for (const svg of cards) {
        expect(svg).toContain('<rect width="600" height="180" rx="18" fill="#E4000F"/>');
        expect(svg).toContain('>' + label + '</text>');
      }
    }
  });

  it('renders each of the 24 original compositions on red in every presence state', async () => {
    const styles = Object.keys(concepts);
    expect(styles).toHaveLength(24);

    for (const [PREVIEW_STATUS, label] of [
      ['playing', 'オンライン'],
      ['online', 'オンライン'],
      ['offline', 'オフライン'],
      ['unknown', '状態を取得できません'],
    ]) {
      const cards = await Promise.all(styles.map(async (style) => {
        const response = await app.request('/card.svg?style=' + style, {}, { PREVIEW_STATUS });
        expect(response.status).toBe(200);
        const svg = await response.text();
        expect(svg).toContain('<rect width="600" height="180" rx="18" fill="#E4000F"/>');
        expect(svg).toContain('>' + label + '</text>');
        return svg;
      }));
      expect(new Set(cards).size).toBe(24);
    }
  });

  it.each([
    ['minutes', '125分'],
    ['handheld', '合計プレイ時間 125分'],
  ])('keeps the full play time and unit in %s', async (style, time) => {
    const response = await app.request('/card.svg?style=' + style, {}, { PREVIEW_STATUS: 'playing' });
    expect(await response.text()).toContain('>' + time + '</text>');
  });

  it('falls back to the original design for unknown styles', async () => {
    const bindings = { PREVIEW_STATUS: 'playing' };
    const original = await app.request('/card.svg', {}, bindings);
    const unrecognized = await app.request('/card.svg?style=__proto__', {}, bindings);
    expect(await unrecognized.text()).toBe(await original.text());
  });

  it('renders different styles from the same KV snapshot and ignores extra parameters', async () => {
    const kv = memoryKv();
    const fetch = vi.fn().mockImplementation(async () => Response.json(playing));
    vi.stubGlobal('fetch', fetch);
    await refreshPresence({ ...env, PRESENCE_KV: kv });
    const bindings = { PRESENCE_KV: kv };
    const original = await (await app.request('/card.svg', {}, bindings)).text();
    const green = await (await app.request('/card.svg?style=green', {}, bindings)).text();
    const repeated = await app.request('/card.svg?extra=1&style=green', {}, bindings);
    expect(green).not.toBe(original);
    expect(green).toContain('Starlight Trails');
    expect(await repeated.text()).toBe(green);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('refresh and render nxapi-auth data', () => {
  it('fetches presence and embeds both images when the secret is configured', async () => {
    const imageResponse = () => new Response(Uint8Array.from(atob(png), (char) => char.charCodeAt(0)), {
      headers: { 'Content-Type': 'image/png' },
    });
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json(payload(gameImage, avatar)))
      .mockImplementation(imageResponse);
    vi.stubGlobal('fetch', fetch);

    const response = await refreshCard();
    const svg = await response.text();
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=90');
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([endpoint, avatar, gameImage]);
    expect(fetch.mock.calls.every(([, init]) => init.redirect === 'manual')).toBe(true);
    expect(svg).toContain('Starlight Trails');
    expect(svg).toContain('合計プレイ時間 125分');
    expect(svg.match(/<image /g)).toHaveLength(2);
    expect(svg).toContain('href="data:image/png;base64,' + png + '"');
    expect(svg).not.toContain(gameImage);
    expect(svg).not.toContain(avatar);
    expect(svg).not.toContain('sample-secret');
  });

  it('allows the configured nxapi-auth image proxy when explicitly selected', async () => {
    const proxyImage = 'https://presence.example.invalid/api/presence/resources/atum/game.png';
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json(payload(proxyImage)))
      .mockResolvedValueOnce(new Response(Uint8Array.from(atob(png), (char) => char.charCodeAt(0)), {
        headers: { 'Content-Type': 'image/png' },
      }));
    vi.stubGlobal('fetch', fetch);

    const response = await refreshCard({ ...env, PRESENCE_SOURCE: 'nxapi-auth' });
    expect(await response.text()).toContain('href="data:image/png;base64,' + png + '"');
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([endpoint, proxyImage]);
  });

  it('embeds a game image slightly larger than the avatar limit', async () => {
    const bytes = new Uint8Array(585_236);
    bytes.set(Uint8Array.from(atob(png), (char) => char.charCodeAt(0)));
    const largeImage = () => new Response(bytes, {
      headers: { 'Content-Type': 'image/png', 'Content-Length': String(bytes.length) },
    });
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json(payload(gameImage, avatar)))
      .mockImplementation(largeImage);
    vi.stubGlobal('fetch', fetch);

    const svg = await (await refreshCard()).text();
    expect(svg.match(/<image /g)).toHaveLength(1);
    expect(svg).toMatch(/<image\b[^>]*href="data:image\/png;base64,[^"]+" clip-path="url\(#art\)"/);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it.each([
    () => new Response(endpoint, { status: 503 }),
    () => Response.redirect('https://example.invalid/json'),
    () => new Response(endpoint, { headers: { 'Content-Type': 'text/html' } }),
    () => new Response('{', { headers: { 'Content-Type': 'application/json' } }),
  ])('falls back without disclosing upstream details or retrying', async (upstream) => {
    const fetch = vi.fn().mockResolvedValueOnce(upstream());
    vi.stubGlobal('fetch', fetch);

    const kv = memoryKv();
    const update = refreshPresence({ ...env, PRESENCE_KV: kv });
    await expect(update).rejects.toThrow('presence:');
    await expect(update).rejects.not.toThrow('sample-secret');
    expect(kv.put).not.toHaveBeenCalled();
    const response = await app.request('/card.svg', {}, { PRESENCE_KV: kv });
    const svg = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(svg).toContain('状態を取得できません');
    expect(svg).not.toContain('sample-secret');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('aborts the upstream request at its deadline', async () => {
    const nativeTimeout = AbortSignal.timeout.bind(AbortSignal);
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => nativeTimeout(10));
    const fetch = vi.fn((_url: URL, { signal }: { signal: AbortSignal }) =>
      new Promise<Response>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      }),
    );
    vi.stubGlobal('fetch', fetch);

    const kv = memoryKv();
    await expect(refreshPresence({ ...env, PRESENCE_KV: kv })).rejects.toThrow('presence: request-failed');
    expect(kv.put).not.toHaveBeenCalled();
    expect(timeout).toHaveBeenCalledWith(PRESENCE_TIMEOUT_MS);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    'http://atum-img-lp1.cdn.nintendo.net/game.png',
    'https://atum-img-lp1.cdn.nintendo.net.example.invalid/game.png',
    'https://name@atum-img-lp1.cdn.nintendo.net/game.png',
    'https://atum-img-lp1.cdn.nintendo.net:8443/game.png',
    'https://presence.example.invalid/redirect',
  ])('skips an unapproved image URL (%s)', async (url) => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json(payload(url)));
    vi.stubGlobal('fetch', fetch);

    const svg = await (await refreshCard()).text();
    expect(svg).toContain('オンライン');
    expect(svg).not.toContain('<image ');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    () => new Response('missing', { status: 404 }),
    () => Response.redirect('https://example.invalid/image.png'),
    () => new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } }),
    () => new Response(new Uint8Array(1024 * 1024 + 1), { headers: { 'Content-Type': 'image/png' } }),
    () => new Response('too large by header', {
      headers: { 'Content-Type': 'image/png', 'Content-Length': '1048577' },
    }),
  ])('keeps the card when a permitted image request fails validation', async (imageResponse) => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json(payload(gameImage)))
      .mockResolvedValueOnce(imageResponse());
    vi.stubGlobal('fetch', fetch);

    const svg = await (await refreshCard()).text();
    expect(svg).toContain('オンライン');
    expect(svg).not.toContain('<image ');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
