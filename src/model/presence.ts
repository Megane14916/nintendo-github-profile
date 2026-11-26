export type PlayingStatus = 'playing' | 'online' | 'offline' | 'unknown';

export interface GamePresence {
  status: PlayingStatus;
  user: {
    name: string | null;
    avatarUrl: string | null;
  };
  game: {
    title: string;
    imageUrl: string | null;
    totalPlayTimeMinutes: number | null;
  } | null;
  fetchedAt: string;
}
