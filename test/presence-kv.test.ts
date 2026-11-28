import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import offline from '../fixtures/offline.json';
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
    const lastPlayed = { title: 'Starlight Trails', seenAt: new Date(now).toISOString() };
    expect(kv.put).toHaveBeenCalledExactlyOnceWith(PRESENCE_KEY, expect.any(String), {
      metadata: { refreshedAt: new Date(now).toISOString(), lastPlayed },
    });
    const stored = await kv.get(PRESENCE_KEY);
    expect(JSON.parse(stored)).toEqual({ ...snapshot(), lastPlayed });
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
    expect(svg).toContain('合計プレイ時間 2.1時間');
    expect(svg.match(/<image /g)).toHaveLength(2);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('localizes both the current game and the last played game from one snapshot', async () => {
    const titleId = '0100c2500fc20000';
    const kv = memoryKv();
    const env = { PRESENCE_KV: kv, NXAPI_PRESENCE_URL: endpoint };
    let payload: unknown = {
      friend: {
        ...playing.friend,
        presence: { state: 'PLAYING', game: { name: 'Source title', shopUri: 'https://ec.nintendo.com/apps/' + titleId + '/JP' } },
      },
    };
    const jp = 'https://store-jp.nintendo.com/item/software/D70010000046394';
    const jpRedirect = 'https://ec.nintendo.com/JP/ja/titles/70010000046394';
    const us = 'https://www.nintendo.com/us/store/products/splatoon-3-switch/';
    const usRedirect = 'https://www.nintendo.com/pos-redirect/70010000046395';
    const html = (title: string) => new Response('<head><title>' + title + '</title></head>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
    const fetch = vi.fn(async (url: URL) => {
      switch (url.toString()) {
        case endpoint: return Response.json(payload);
        case 'https://ec.nintendo.com/apps/' + titleId + '/JP': return Response.redirect(jpRedirect, 307);
        case jpRedirect: return Response.redirect(jp, 307);
        case 'https://ec.nintendo.com/apps/' + titleId + '/US': return Response.redirect(usRedirect, 307);
        case usRedirect: return Response.redirect(usRedirect + '/', 308);
        case usRedirect + '/': return Response.redirect('https://www.nintendo.com/us/pos-redirect/70010000046395/', 301);
        case 'https://www.nintendo.com/us/pos-redirect/70010000046395/': return Response.redirect(us, 308);
        case jp: return html('スプラトゥーン3 | Nintendo Store');
        case us: return html('Splatoon&trade; 3 for Nintendo Switch - Nintendo Official Site');
        default: throw new Error('Unexpected fetch ' + url);
      }
    });
    vi.stubGlobal('fetch', fetch);

    await refreshPresence(env);
    for (const [lang, status, title] of [
      ['ja', 'オンライン', 'スプラトゥーン3'],
      ['en', 'Online', 'Splatoon™ 3'],
    ]) {
      const svg = await (await app.request('/card.svg?lang=' + lang, {}, env)).text();
      expect(svg).toContain('xml:lang="' + lang + '"');
      expect(svg).toContain('>' + status + '</text>');
      expect(svg).toContain('>' + title + '</text>');
    }
    expect(fetch).toHaveBeenCalledTimes(9);
    expect(kv.put).toHaveBeenCalledOnce();

    vi.setSystemTime(now + 120_000);
    await refreshPresence(env);
    expect(fetch).toHaveBeenCalledTimes(10);

    payload = offline;
    vi.setSystemTime(now + SNAPSHOT_MAX_AGE_MS + 120_000);
    await refreshPresence(env);
    const stored = JSON.parse(await kv.get(PRESENCE_KEY));
    expect(stored.lastPlayed).toEqual({
      title: 'Source title',
      titleId,
      titles: { ja: 'スプラトゥーン3', en: 'Splatoon™ 3' },
      seenAt: new Date(now + 120_000).toISOString(),
    });
    expect(stored.presence.game).toBeNull();
    const svg = await (await app.request('/card.svg?lang=en', {}, env)).text();
    for (const text of ['Offline', 'No game in progress', 'Recently played: Splatoon™ 3']) {
      expect(svg).toContain('>' + text + '</text>');
    }
    expect(fetch).toHaveBeenCalledTimes(11);
    expect(kv.put).toHaveBeenCalledTimes(3);
  });

  it('keeps the upstream title for a missing locale and skips untrusted redirects', async () => {
    const titleId = '0100000000000000';
    const kv = memoryKv();
    const env = { PRESENCE_KV: kv, NXAPI_PRESENCE_URL: endpoint };
    const fetch = vi.fn(async (url: URL) => {
      if (url.toString() === endpoint) {
        return Response.json({ friend: { presence: { state: 'PLAYING', game: {
          name: 'Source & Name', shopUri: 'https://ec.nintendo.com/apps/' + titleId + '/JP',
        } } } });
      }
      if (url.pathname.endsWith('/JP')) {
        return Response.redirect('https://untrusted.example.invalid/product');
      }
      if (url.hostname === 'ec.nintendo.com') {
        return Response.redirect('https://www.nintendo.com/store/products/example/');
      }
      return new Response('<title>Example &amp; Game for Nintendo Switch 2 - Nintendo Official Site</title>', {
        headers: { 'Content-Type': 'text/html' },
      });
    });
    vi.stubGlobal('fetch', fetch);

    await refreshPresence(env);
    const ja = await (await app.request('/card.svg', {}, env)).text();
    const en = await (await app.request('/card.svg?lang=en', {}, env)).text();
    expect(ja).toContain('>Source &amp; Name</text>');
    expect(en).toContain('>Example &amp; Game</text>');
    expect(fetch.mock.calls.map(([url]) => url.hostname)).not.toContain('untrusted.example.invalid');
    expect(fetch).toHaveBeenCalledTimes(4);
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
    const svg = await response.text();
    expect(svg).toContain('オフライン');
    expect(svg).toContain('プレイ中のゲームはありません');
    expect(svg).not.toContain('最近プレイしたゲーム');
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
