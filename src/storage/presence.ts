import type { GamePresence } from '../model/presence';
import type { CardAssets } from '../render/assets';

export interface PresenceSnapshot {
  schemaVersion: 1;
  presence: GamePresence;
  assets: CardAssets;
  refreshedAt: string;
}

export const PRESENCE_KEY = 'presence:current';
export const SNAPSHOT_MAX_AGE_MS = 10 * 60 * 1000;
const MAX_KV_VALUE_BYTES = 25 * 1024 * 1024;

function record(value: unknown): Record<string, unknown> | undefined {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isAsset(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value !== 'string') return false;
  const encoded = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)?.[1];
  return !!encoded && encoded.length % 4 === 0;
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

function isSnapshot(value: unknown): value is PresenceSnapshot {
  const snapshot = record(value);
  const presence = record(snapshot?.presence);
  const user = record(presence?.user);
  const assets = record(snapshot?.assets);
  if (snapshot?.schemaVersion !== 1 || !isTimestamp(snapshot.refreshedAt) || !isTimestamp(presence?.fetchedAt)
    || (presence.status !== 'playing' && presence.status !== 'online' && presence.status !== 'offline')
    || !isNullableString(user?.name) || !isNullableString(user?.avatarUrl)
    || !isAsset(assets?.avatarDataUri) || !isAsset(assets?.gameImageDataUri)) return false;

  if (presence.game === null) return assets?.gameImageDataUri === null;
  const game = record(presence.game);
  const minutes = game?.totalPlayTimeMinutes;
  return presence.status === 'playing' && typeof game?.title === 'string' && !!game.title.trim()
    && isNullableString(game.imageUrl)
    && (minutes === null || (typeof minutes === 'number' && Number.isSafeInteger(minutes) && minutes > 0));
}

export async function readPresenceSnapshot(kv: Pick<KVNamespace, 'get'>): Promise<PresenceSnapshot | null> {
  const value = await kv.get(PRESENCE_KEY);
  if (value === null) return null;
  let snapshot: unknown;
  try {
    snapshot = JSON.parse(value);
  } catch {
    return null;
  }
  if (!isSnapshot(snapshot)) return null;
  const age = Date.now() - Date.parse(snapshot.refreshedAt);
  return age >= 0 && age < SNAPSHOT_MAX_AGE_MS ? snapshot : null;
}

export async function writePresenceSnapshot(kv: Pick<KVNamespace, 'put'>, snapshot: PresenceSnapshot): Promise<void> {
  const { presence, assets } = snapshot;
  // The card only uses embedded images. Exclude image URLs and any upstream fields.
  const stored: PresenceSnapshot = {
    schemaVersion: 1,
    refreshedAt: snapshot.refreshedAt,
    presence: {
      status: presence.status,
      fetchedAt: presence.fetchedAt,
      user: { name: presence.user.name, avatarUrl: null },
      game: presence.game && {
        title: presence.game.title,
        imageUrl: null,
        totalPlayTimeMinutes: presence.game.totalPlayTimeMinutes,
      },
    },
    assets: {
      avatarDataUri: assets.avatarDataUri,
      gameImageDataUri: assets.gameImageDataUri,
    },
  };
  if (!isSnapshot(stored)) throw new Error('Invalid presence snapshot');
  const value = JSON.stringify(stored);
  if (new TextEncoder().encode(value).byteLength > MAX_KV_VALUE_BYTES) throw new Error('Presence snapshot exceeds KV value limit');
  await kv.put(PRESENCE_KEY, value);
}
