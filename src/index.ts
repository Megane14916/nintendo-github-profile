import { Hono } from 'hono';
import error from '../fixtures/error.json';
import offline from '../fixtures/offline.json';
import online from '../fixtures/online.json';
import playing from '../fixtures/playing.json';
import { CACHE_SECONDS, type Bindings } from './config';
import { normalizePresence } from './presence/normalize';
import { renderCard, resolveCardStyle } from './render/card';
import { readPresenceSnapshot, SNAPSHOT_MAX_AGE_MS } from './storage/presence';

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
  const language = c.req.query('lang') === 'en' ? 'en' : 'ja';
  const fixture = fixtures.get(c.env?.PREVIEW_STATUS ?? '');
  if (fixture !== undefined) {
    return svgResponse(renderCard(normalizePresence(fixture, new Date().toISOString()), undefined, style, { language }));
  }

  const kv = c.env?.PRESENCE_KV;
  try {
    const snapshot = kv && await readPresenceSnapshot(kv);
    if (snapshot) {
      const remainingSeconds = Math.floor((Date.parse(snapshot.refreshedAt) + SNAPSHOT_MAX_AGE_MS - Date.now()) / 1000);
      const cacheSeconds = Math.max(0, Math.min(CACHE_SECONDS, remainingSeconds));
      return svgResponse(renderCard(snapshot.presence, snapshot.assets, style, {
        language,
        lastPlayed: snapshot.lastPlayed,
      }), 'public, max-age=' + cacheSeconds);
    }
  } catch {
    console.warn('presence_kv_unavailable');
  }
  return svgResponse(renderCard(normalizePresence(error, new Date().toISOString()), undefined, style, { language }));
});

export default app;
