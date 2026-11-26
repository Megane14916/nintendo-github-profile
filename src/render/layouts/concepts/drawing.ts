import type { GamePresence } from '../../../model/presence';
import { escapeXml } from '../../../utils/escape-xml';
import type { CardAssets } from '../../assets';
import { getCardCopy, shorten } from '../../copy';
import { greenTheme, redTreatments, switchTheme } from '../../themes';

export const white = '#FFFFFF';
export const ivory = '#FFF3DE';
export const redInk = '#AA000C';
export const deepRed = '#BD000F';

const fonts = {
  sans: switchTheme.fontFamily,
  rounded: redTreatments.mint.fontFamily,
  serif: redTreatments.serif.fontFamily,
  mono: 'BIZ UDGothic, MS Gothic, monospace',
};

interface TextStyle {
  width: number;
  size?: number;
  weight?: number;
  color?: string;
  face?: keyof typeof fonts;
  align?: 'middle' | 'end';
}

export interface Drawing {
  title: string | null;
  time: string | null;
  minutes: number | null;
  name: string | null;
  status: string;
  text(value: string | null, x: number, y: number, style: TextStyle): string;
  art(x: number, y: number, width: number, height?: number, radius?: number): string;
  avatar(x: number, y: number, size?: number): string;
  profile(x: number, y: number, width: number, color?: string): string;
  pill(x: number, y: number, options?: { tone?: 'mint' | 'ivory'; align?: 'middle' | 'end'; radius?: number }): string;
}

export type DrawConcept = (drawing: Drawing) => string;

export function renderConcept(presence: GamePresence, assets: CardAssets, draw: DrawConcept): string {
  const { status, heading: title, playTime: time } = getCardCopy(presence);
  const minutes = presence.game?.totalPlayTimeMinutes ?? null;
  const name = presence.user.name;
  const defs: string[] = [];

  function clip(shape: string): string {
    const id = 'shape-' + defs.length;
    defs.push(`<clipPath id="${id}">${shape}</clipPath>`);
    return `clip-path="url(#${id})"`;
  }

  function text(value: string | null, x: number, y: number, style: TextStyle): string {
    if (!value) return '';
    const { width, size = 14, weight = 600, color = white, face = 'sans', align = 'start' } = style;
    const left = x - (align === 'middle' ? width / 2 : align === 'end' ? width : 0);
    const mask = clip(`<rect x="${left}" y="${y - size - 5}" width="${width}" height="${size + 13}"/>`);
    return `<text x="${x}" y="${y}" text-anchor="${align}" font-family="${escapeXml(fonts[face])}"
      font-size="${size}" font-weight="${weight}" fill="${color}" stroke="${color}" stroke-width="0.22"
      stroke-linejoin="round" ${mask}>${escapeXml(shorten(value, width, size))}</text>`;
  }

  function art(x: number, y: number, width: number, height = width, radius = 12): string {
    const rect = `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}"`;
    const tile = `${rect} fill="${deepRed}"/>`;
    if (assets.gameImageDataUri) {
      return tile + `<image x="${x}" y="${y}" width="${width}" height="${height}"
        href="${escapeXml(assets.gameImageDataUri)}" ${clip(rect + '/>')} preserveAspectRatio="xMidYMid slice"/>`;
    }
    return tile + `<g transform="translate(${x + width / 2} ${y + height / 2})" fill="none" stroke="${white}" stroke-width="1.5" stroke-linecap="round">
      <rect x="-16" y="-9" width="32" height="18" rx="6"/>
      <path d="M-11 0h8 M-7 -4v8"/>
      <circle cx="8" r="2"/>
    </g>`;
  }

  function avatar(x: number, y: number, size = 24): string {
    if (assets.avatarDataUri) {
      const mask = clip(`<circle cx="${x}" cy="${y}" r="${size / 2}"/>`);
      return `<image x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}"
        href="${escapeXml(assets.avatarDataUri)}" ${mask} preserveAspectRatio="xMidYMid slice"/>`;
    }
    if (!name) return '';
    return `<g transform="translate(${x} ${y}) scale(${size / 24})" aria-hidden="true">
      <circle r="12" fill="${deepRed}"/>
      <circle cy="-3" r="2.5" fill="${white}"/>
      <path d="M-6 6c0-3 2.7-5 6-5s6 2 6 5Z" fill="${white}"/>
    </g>`;
  }

  function profile(x: number, y: number, width: number, color = white): string {
    return avatar(x + 12, y) + text(name, x + 32, y + 5, { width: width - 32, color });
  }

  function pill(x: number, y: number, options: Parameters<Drawing['pill']>[2] = {}): string {
    const { tone, align, radius = 12 } = options;
    const width = status.length * 13 + 34;
    const left = x - (align === 'end' ? width : align === 'middle' ? width / 2 : 0);
    const background = tone === 'mint' ? '#E8F8EB' : tone === 'ivory' ? ivory : white;
    const color = tone === 'mint' ? greenTheme.status[presence.status] : switchTheme.status[presence.status];

    return `<rect x="${left}" y="${y}" width="${width}" height="24" rx="${radius}" fill="${background}"/>
      <circle cx="${left + 11}" cy="${y + 12}" r="2.8" fill="${color}"/>
      ${text(status, left + 21, y + 16, { width: width - 13, size: 12, weight: 800, color })}`;
  }

  const body = draw({ title, time, minutes, name, status, text, art, avatar, profile, pill });
  const description = escapeXml(title ? status + '：' + title : status);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="180" viewBox="0 0 600 180" xml:lang="ja" role="img" aria-labelledby="card-title">
  <title id="card-title">Nintendo Switch ${description}</title>
  <defs>${defs.join('')}</defs>
  <rect width="600" height="180" rx="18" fill="${switchTheme.background}"/>
  ${body}
</svg>`;
}
