import type { PlayingStatus } from '../model/presence';

export interface CardTheme {
  background: string;
  text: string;
  muted: string;
  statusBackground: string;
  placeholder: string;
  status: Record<PlayingStatus, string>;
  fontFamily: string;
  titleSize: number;
  labelSize: number;
  detailSize: number;
  padding: number;
  radius: number;
}

export const switchTheme: CardTheme = {
  background: '#E4000F',
  text: '#FFFFFF',
  muted: '#FFF6F6',
  statusBackground: '#FFFFFF',
  placeholder: '#C9000D',
  status: {
    playing: '#C4000D',
    online: '#C4000D',
    offline: '#5D4D50',
    unknown: '#733F46',
  },
  fontFamily: 'Noto Sans JP, Hiragino Sans, Meiryo, Yu Gothic, Noto Sans CJK JP, sans-serif',
  titleSize: 28,
  labelSize: 13,
  detailSize: 15,
  padding: 22,
  radius: 18,
};

export const greenTheme: CardTheme = {
  ...switchTheme,
  statusBackground: '#EEFBF0',
  status: { ...switchTheme.status, playing: '#14643C', online: '#14643C' },
};

export interface RedTreatment extends CardTheme {
  artworkRadius: number;
  badgeRadius: number;
  titleWeight: number;
}

export const redTreatments = {
  white: {
    ...switchTheme,
    artworkRadius: 12,
    badgeRadius: 12.5,
    titleWeight: 800,
  },
  mint: {
    ...greenTheme,
    statusBackground: '#E7F8EB',
    placeholder: '#C3000E',
    fontFamily: "Hiragino Maru Gothic ProN, 'M PLUS Rounded 1c', Noto Sans JP, Meiryo, sans-serif",
    titleSize: 27,
    artworkRadius: 20,
    badgeRadius: 6,
    titleWeight: 750,
  },
  serif: {
    ...switchTheme,
    text: '#FFFAF3',
    muted: '#FFF6EB',
    statusBackground: '#FFF1DB',
    placeholder: '#B90012',
    status: {
      playing: '#7D331D',
      online: '#7D331D',
      offline: '#544941',
      unknown: '#733F46',
    },
    fontFamily: 'Noto Serif JP, Yu Mincho, Hiragino Mincho ProN, MS PMincho, Noto Serif CJK JP, serif',
    titleSize: 30,
    detailSize: 14,
    artworkRadius: 5,
    badgeRadius: 3,
    titleWeight: 700,
  },
} satisfies Record<string, RedTreatment>;
