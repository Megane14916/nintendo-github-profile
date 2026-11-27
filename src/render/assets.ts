import { Buffer } from 'node:buffer';
import { IMAGE_TIMEOUT_MS } from '../config';
import type { GamePresence } from '../model/presence';
import { readLimitedBody } from '../utils/read-limited-body';

export interface CardAssets {
  avatarDataUri: string | null;
  gameImageDataUri: string | null;
}

const IMAGE_HOSTS = new Set([
  'atum-img-lp1.cdn.nintendo.net',
  'cdn-image-e0d67c509fb203858ebcb2fe3f88c2aa.baas.nintendo.com',
]);
const MAX_AVATAR_BYTES = 512 * 1024;
const MAX_GAME_IMAGE_BYTES = 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PROXY_RESOURCE = /^\/api\/presence\/resources\/(baas|atum)\/[\w.-]+$/;

function isAllowedImage(url: URL, presenceOrigin: string | undefined): boolean {
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return false;
  return IMAGE_HOSTS.has(url.hostname)
    || (url.origin === presenceOrigin && PROXY_RESOURCE.test(url.pathname) && !url.search);
}

async function loadImage(source: string | null, presenceOrigin: string | undefined, maxBytes: number): Promise<string | null> {
  if (!source) return null;

  try {
    const url = new URL(source);
    if (!isAllowedImage(url, presenceOrigin)) return null;

    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    });
    const mime = response.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase();
    if (!response.ok || !mime || !IMAGE_MIME_TYPES.has(mime)) {
      void response.body?.cancel().catch(() => {});
      return null;
    }

    const bytes = await readLimitedBody(response, maxBytes);
    if (bytes.length === 0) return null;

    const encoded = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
    return 'data:' + mime + ';base64,' + encoded;
  } catch {
    return null;
  }
}

export async function loadCardAssets(presence: GamePresence, imageProxyOrigin?: string): Promise<CardAssets> {
  const [avatarDataUri, gameImageDataUri] = await Promise.all([
    loadImage(presence.user.avatarUrl, imageProxyOrigin, MAX_AVATAR_BYTES),
    loadImage(presence.game?.imageUrl ?? null, imageProxyOrigin, MAX_GAME_IMAGE_BYTES),
  ]);
  return { avatarDataUri, gameImageDataUri };
}
