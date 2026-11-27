import { Hono } from 'hono';
import error from '../fixtures/error.json';
import offline from '../fixtures/offline.json';
import online from '../fixtures/online.json';
import playing from '../fixtures/playing.json';
import { CACHE_SECONDS, type Bindings } from './config';
import { PresenceError } from './presence/error';
import { normalizePresence } from './presence/normalize';
import { createPresenceProvider } from './presence/provider';
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
  let source: string | undefined;
  try {
    const provider = createPresenceProvider(c.env);
    if (!provider) {
      const fixture = fixtures.get(c.env?.PREVIEW_STATUS ?? '');
      return svgResponse(renderCard(normalizePresence(fixture, new Date().toISOString()), undefined, style));
    }
    source = provider.source;

    const cache = typeof caches === 'undefined' ? undefined : caches.default;
    const cacheUrl = new URL('/card.svg', c.req.url);
    if (source === 'self') cacheUrl.searchParams.set('source', source);
    if (style !== 'default') cacheUrl.searchParams.set('style', style);
    const cacheKey = new Request(cacheUrl);
    const cached = await cache?.match(cacheKey).catch(() => undefined);
    if (cached) return cached;

    const presence = await provider.getPresence();
    const assets = await loadCardAssets(presence, provider.imageProxyOrigin);
    const response = svgResponse(renderCard(presence, assets, style), 'public, max-age=' + CACHE_SECONDS);
    if (cache) c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}));
    return response;
  } catch (failure) {
    const safe = failure instanceof PresenceError ? failure : new PresenceError('presence', 'request-failed');
    console.warn('presence_unavailable', { source, stage: safe.stage, code: safe.code, status: safe.status });
    return svgResponse(renderCard(normalizePresence(error, new Date().toISOString()), undefined, style));
  }
});

export default app;
