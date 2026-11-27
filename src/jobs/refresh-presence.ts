import type { Bindings } from '../config';
import type { GamePresence, LastPlayedGame } from '../model/presence';
import { fetchGameTitles, limitGameTitle } from '../nintendo/game-titles';
import { loadCardAssets } from '../render/assets';
import { readPresenceMetadata, writePresenceSnapshot } from '../storage/presence';
import { PresenceError } from '../presence/error';
import { createPresenceProvider } from '../presence/provider';

export { PresenceError };

async function resolveLastPlayed(presence: GamePresence, previous?: LastPlayedGame): Promise<LastPlayedGame | undefined> {
  const game = presence.game;
  if (!game || (previous && previous.seenAt > presence.fetchedAt)) return previous;
  const title = limitGameTitle(game.title);
  if (!title) return previous;

  const { titleId } = game;
  if (!titleId) return { title, seenAt: presence.fetchedAt };
  const titles = titleId === previous?.titleId ? previous.titles : await fetchGameTitles(titleId);
  return { title, titleId, titles, seenAt: presence.fetchedAt };
}

export async function refreshPresence(env: Bindings, scheduledTime?: number): Promise<string> {
  const kv = env.PRESENCE_KV;
  if (!kv) throw new PresenceError('configuration', 'missing-setting');
  const previous = await readPresenceMetadata(kv).catch(() => {
    throw new PresenceError('storage', 'request-failed');
  });
  if (scheduledTime !== undefined && previous && Date.parse(previous.refreshedAt) >= scheduledTime) {
    return previous.refreshedAt;
  }
  const provider = createPresenceProvider(env);
  if (!provider) throw new PresenceError('configuration', 'missing-setting');

  const presence = await provider.getPresence();
  const [assets, lastPlayed] = await Promise.all([
    loadCardAssets(presence, provider.imageProxyOrigin),
    resolveLastPlayed(presence, previous?.lastPlayed),
  ]);
  const refreshedAt = new Date().toISOString();
  try {
    await writePresenceSnapshot(kv, { schemaVersion: 1, presence, assets, refreshedAt, lastPlayed });
  } catch {
    throw new PresenceError('storage', 'request-failed');
  }
  return refreshedAt;
}
