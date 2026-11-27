import type { GamePresence, LastPlayedGame } from '../model/presence';
import type { CardAssets } from '../render/assets';

export interface PresenceSnapshot {
  schemaVersion: 1;
  presence: GamePresence;
  assets: CardAssets;
  refreshedAt: string;
  lastPlayed?: LastPlayedGame;
}

type SnapshotMetadata = Pick<PresenceSnapshot, 'refreshedAt' | 'lastPlayed'>;

export const PRESENCE_KEY = 'presence:current';
export const SNAPSHOT_MAX_AGE_MS = 10 * 60 * 1000;
const MAX_KV_VALUE_BYTES = 25 * 1024 * 1024;
const MAX_KV_METADATA_BYTES = 1024;

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

function isTitleId(value: unknown): boolean {
  return typeof value === 'string' && /^[0-9a-f]{16}$/.test(value);
}

function isHistoryTitle(value: unknown): boolean {
  return typeof value === 'string' && !!value.trim() && Array.from(value).length <= 64
    && !/[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(value);
}

function isLastPlayed(value: unknown, refreshedAt: string): value is LastPlayedGame {
  const lastPlayed = record(value);
  if (!isTimestamp(lastPlayed?.seenAt) || lastPlayed.seenAt > refreshedAt
    || !isHistoryTitle(lastPlayed.title)
    || (lastPlayed.titleId !== undefined && !isTitleId(lastPlayed.titleId))) return false;
  if (lastPlayed.titles === undefined) return true;
  const titles = record(lastPlayed.titles);
  return !!titles && isTitleId(lastPlayed.titleId)
    && (titles.ja === undefined || isHistoryTitle(titles.ja))
    && (titles.en === undefined || isHistoryTitle(titles.en));
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
  if (snapshot.lastPlayed !== undefined && !isLastPlayed(snapshot.lastPlayed, snapshot.refreshedAt)) return false;

  if (presence.game === null) return assets?.gameImageDataUri === null;
  const game = record(presence.game);
  const minutes = game?.totalPlayTimeMinutes;
  return presence.status === 'playing' && typeof game?.title === 'string' && !!game.title.trim()
    && (game.titleId === undefined || isTitleId(game.titleId))
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

export async function readPresenceMetadata(kv: Pick<KVNamespace, 'getWithMetadata'>): Promise<SnapshotMetadata | null> {
  const { value, metadata } = await kv.getWithMetadata<Record<string, unknown>>(PRESENCE_KEY, 'stream');
  await value?.cancel();
  if (!isTimestamp(metadata?.refreshedAt) || Date.parse(metadata.refreshedAt) > Date.now()) return null;
  const { refreshedAt, lastPlayed } = metadata;
  return { refreshedAt, lastPlayed: isLastPlayed(lastPlayed, refreshedAt) ? lastPlayed : undefined };
}

export async function writePresenceSnapshot(kv: Pick<KVNamespace, 'put'>, snapshot: PresenceSnapshot): Promise<void> {
  const { presence, assets, lastPlayed } = snapshot;
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
        titleId: presence.game.titleId,
        imageUrl: null,
        totalPlayTimeMinutes: presence.game.totalPlayTimeMinutes,
      },
    },
    assets: {
      avatarDataUri: assets.avatarDataUri,
      gameImageDataUri: assets.gameImageDataUri,
    },
    lastPlayed: lastPlayed && {
      title: lastPlayed.title,
      titleId: lastPlayed.titleId,
      titles: lastPlayed.titles && { ja: lastPlayed.titles.ja, en: lastPlayed.titles.en },
      seenAt: lastPlayed.seenAt,
    },
  };
  if (!isSnapshot(stored)) throw new Error('Invalid presence snapshot');
  const value = JSON.stringify(stored);
  const metadata = { refreshedAt: stored.refreshedAt, ...(stored.lastPlayed ? { lastPlayed: stored.lastPlayed } : {}) };
  const encoder = new TextEncoder();
  if (encoder.encode(value).byteLength > MAX_KV_VALUE_BYTES) throw new Error('Presence snapshot exceeds KV value limit');
  if (encoder.encode(JSON.stringify(metadata)).byteLength > MAX_KV_METADATA_BYTES) throw new Error('Presence metadata exceeds KV metadata limit');
  await kv.put(PRESENCE_KEY, value, { metadata });
}
