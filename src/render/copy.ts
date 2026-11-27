import type { CardLanguage, GamePresence, LastPlayedGame } from '../model/presence';

const COPY = {
  ja: {
    status: { playing: 'オンライン', online: 'オンライン', offline: 'オフライン', unknown: '状態を取得できません' },
    unknownGame: 'ゲーム名が不明です',
    idle: 'プレイしていません',
    offline: 'プレイ中のゲームはありません',
    recent: '最近プレイしたゲーム',
    time: '合計プレイ時間',
    minutesSuffix: '分',
    separator: '：',
  },
  en: {
    status: { playing: 'Online', online: 'Online', offline: 'Offline', unknown: 'Status unavailable' },
    unknownGame: 'Unknown game',
    idle: 'Not playing',
    offline: 'No game in progress',
    recent: 'Recently played',
    time: 'Total play time',
    minutesSuffix: ' min',
    separator: ': ',
  },
};
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export interface CardCopyOptions {
  language?: CardLanguage;
  lastPlayed?: LastPlayedGame;
}

export type CardCopy = ReturnType<typeof getCardCopy>;

export function getCardCopy(presence: GamePresence, { language = 'ja', lastPlayed }: CardCopyOptions = {}) {
  const copy = COPY[language];
  const { game, status: state } = presence;
  const status = copy.status[state];
  const localizedTitle = game?.titleId && game.titleId === lastPlayed?.titleId
    ? lastPlayed.titles?.[language]
    : undefined;
  const heading = localizedTitle ?? game?.title
    ?? (state === 'playing' ? copy.unknownGame : null)
    ?? (state === 'online' ? copy.idle : null)
    ?? (state === 'offline' ? copy.offline : null);
  const minutes = game?.totalPlayTimeMinutes;
  const recent = state === 'offline' && lastPlayed
    ? { label: copy.recent, title: lastPlayed.titles?.[language] ?? lastPlayed.title }
    : null;
  const recentLine = recent ? recent.label + ': ' + recent.title : null;
  const duration = minutes ? minutes + copy.minutesSuffix : null;

  return {
    language,
    status,
    heading,
    playTime: duration ? copy.time + ' ' + duration : null,
    playTimeLabel: copy.time,
    minutesSuffix: copy.minutesSuffix,
    recent,
    recentLine,
    compactDetail: duration ?? recent?.title ?? null,
    description: [status, heading, recentLine].filter(Boolean).join(copy.separator),
  };
}

export function shorten(text: string, maxWidth: number, fontSize: number): string {
  let width = 0;
  let result = '';
  for (const { segment } of segmenter.segment(text.replace(/\s+/gu, ' '))) {
    width += /^[\x20-\x7E]$/.test(segment) ? fontSize * 0.75 : fontSize * 1.15;
    if (width > maxWidth - fontSize) return result.trimEnd() + '…';
    result += segment;
  }
  return result;
}

export function fitCardDetail(copy: CardCopy, maxWidth: number, fontSize: number): string | null {
  const detail = copy.playTime ?? copy.recentLine;
  if (!detail) return null;
  const fitted = shorten(detail, maxWidth, fontSize);
  return fitted !== detail && copy.compactDetail ? shorten(copy.compactDetail, maxWidth, fontSize) : fitted;
}
