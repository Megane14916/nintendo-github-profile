import { Hono } from 'hono';
import error from '../fixtures/error.json';
import offline from '../fixtures/offline.json';
import online from '../fixtures/online.json';
import playing from '../fixtures/playing.json';
import { CACHE_SECONDS, type Bindings } from './config';
import { fetchPresence } from './presence/nxapi';
import { normalizePresence } from './presence/normalize';
import { loadCardAssets } from './render/assets';
import { renderCard, resolveCardStyle } from './render/card';

const fixtures = new Map<string, unknown>([['playing', playing], ['online', online], ['offline', offline], ['unknown', error]]);
const app = new Hono<{ Bindings: Bindings }>();

function svgResponse(svg: string, cacheControl = 'no-store'): Response {
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

app.get('/card.svg', async (c) => {
  const style = resolveCardStyle(c.req.query('style'));
  const endpoint = c.env?.NXAPI_PRESENCE_URL?.trim();
  if (!endpoint) {
    const fixture = fixtures.get(c.env?.PREVIEW_STATUS ?? '');
    return svgResponse(renderCard(normalizePresence(fixture, new Date().toISOString()), undefined, style));
  }

  const cache = typeof caches === 'undefined' ? undefined : caches.default;
  const cacheUrl = new URL('/card.svg', c.req.url);
  if (style !== 'default') cacheUrl.searchParams.set('style', style);
  const cacheKey = new Request(cacheUrl);
  const cached = await cache?.match(cacheKey).catch(() => undefined);
  if (cached) return cached;

  const payload = await fetchPresence(endpoint);
  const presence = normalizePresence(payload, new Date().toISOString());
  if (presence.status === 'unknown') return svgResponse(renderCard(presence, undefined, style));

  const assets = await loadCardAssets(presence, endpoint);
  const response = svgResponse(renderCard(presence, assets, style), 'public, max-age=' + CACHE_SECONDS);
  if (cache) c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}));
  return response;
});

export default app;
