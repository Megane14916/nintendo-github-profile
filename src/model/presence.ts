export type PlayingStatus = 'playing' | 'online' | 'offline' | 'unknown';
export type CardLanguage = 'ja' | 'en';

export interface LastPlayedGame {
  title: string;
  titleId?: string;
  titles?: Partial<Record<CardLanguage, string>>;
  seenAt: string;
}

export interface GamePresence {
  status: PlayingStatus;
  user: {
    name: string | null;
    avatarUrl: string | null;
  };
  game: {
    title: string;
    titleId?: string;
    imageUrl: string | null;
    totalPlayTimeMinutes: number | null;
  } | null;
  fetchedAt: string;
}
