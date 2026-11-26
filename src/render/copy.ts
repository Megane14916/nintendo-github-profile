import type { GamePresence } from '../model/presence';

const STATUS = {
  playing: 'オンライン',
  online: 'オンライン',
  offline: 'オフライン',
  unknown: '状態を取得できません',
};
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export function getCardCopy(presence: GamePresence) {
  const heading = presence.game?.title
    ?? (presence.status === 'playing' ? 'ゲーム名が不明です' : null)
    ?? (presence.status === 'online' ? 'プレイしていません' : null);
  const minutes = presence.game?.totalPlayTimeMinutes;

  return {
    status: STATUS[presence.status],
    heading,
    playTime: minutes ? '合計プレイ時間 ' + minutes + '分' : null,
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
