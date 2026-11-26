import type { GamePresence, PlayingStatus } from '../model/presence';

function record(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() || null : null;
}

function statusFor(state: unknown, title: string | null): PlayingStatus {
  switch (state) {
    case 'PLAYING': return 'playing';
    case 'ONLINE': return title ? 'playing' : 'online';
    case 'INACTIVE': return 'online';
    case 'OFFLINE': return 'offline';
    default: return 'unknown';
  }
}

export function normalizePresence(payload: unknown, fetchedAt: string): GamePresence {
  const friend = record(record(payload)?.friend);
  const presence = record(friend?.presence);
  const game = record(presence?.game);
  const title = text(game?.name);
  const status = statusFor(presence?.state, title);
  const minutes = game?.totalPlayTime;

  return {
    status,
    user: {
      name: text(friend?.name),
      avatarUrl: text(friend?.image2Uri) ?? text(friend?.imageUri),
    },
    game: status === 'playing' && title ? {
      title,
      imageUrl: text(game?.imageUri),
      totalPlayTimeMinutes: typeof minutes === 'number' && Number.isSafeInteger(minutes) && minutes > 0
        ? minutes
        : null,
    } : null,
    fetchedAt,
  };
}
