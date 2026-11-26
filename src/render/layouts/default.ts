import type { GamePresence } from '../../model/presence';
import { escapeXml } from '../../utils/escape-xml';
import type { CardAssets } from '../assets';
import { getCardCopy, shorten } from '../copy';
import type { CardTheme } from '../themes';

const WIDTH = 600;
const HEIGHT = 180;
const ART_SIZE = 136;
const ART_GAP = 22;
const AVATAR_SIZE = 24;
const STATUS_HEIGHT = 26;
export function renderDefaultCard(presence: GamePresence, assets: CardAssets, theme: CardTheme): string {
  const { padding, radius, background, statusBackground, placeholder, text, muted } = theme;
  const x = padding + ART_SIZE + ART_GAP;
  const textWidth = WIDTH - x - padding;
  const { status, heading, playTime } = getCardCopy(presence);
  const accent = theme.status[presence.status];
  const title = heading && escapeXml(shorten(heading, textWidth, theme.titleSize));
  const statusY = title ? padding : 66;
  const statusWidth = status.length * theme.labelSize + 36;

  const avatarX = x;
  const avatarY = 128;
  const avatarCenterX = avatarX + AVATAR_SIZE / 2;
  const avatarCenterY = avatarY + AVATAR_SIZE / 2;
  const nameX = avatarX + AVATAR_SIZE + 9;
  const name = presence.user.name
    && escapeXml(shorten(presence.user.name, WIDTH - nameX - padding, theme.detailSize));

  const artCenter = padding + ART_SIZE / 2;
  const art = assets.gameImageDataUri
    ? `<image x="${padding}" y="${padding}" width="${ART_SIZE}" height="${ART_SIZE}"
        href="${escapeXml(assets.gameImageDataUri)}" clip-path="url(#art)" preserveAspectRatio="xMidYMid slice"/>`
    : `<g transform="translate(${artCenter} ${artCenter})" fill="none" stroke="${muted}" stroke-width="2" stroke-linecap="round">
        <rect x="-21" y="-12" width="42" height="24" rx="8"/>
        <path d="M-14 0h10 M-9 -5v10"/>
        <circle cx="10" cy="0" r="2.5"/>
      </g>`;
  const avatar = assets.avatarDataUri
    ? `<image x="${avatarX}" y="${avatarY}" width="${AVATAR_SIZE}" height="${AVATAR_SIZE}"
        href="${escapeXml(assets.avatarDataUri)}" clip-path="url(#avatar)" preserveAspectRatio="xMidYMid slice"/>`
    : name
      ? `<g transform="translate(${avatarCenterX} ${avatarCenterY})" aria-hidden="true">
          <circle r="${AVATAR_SIZE / 2}" fill="${placeholder}"/>
          <circle cy="-3" r="2.5" fill="${muted}"/>
          <path d="M-6 6c0-3 2.7-5 6-5s6 2 6 5Z" fill="${muted}"/>
        </g>`
      : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xml:lang="ja" role="img" aria-labelledby="card-title">
  <title id="card-title">Nintendo Switch ${status}${title ? '：' + title : ''}</title>
  <defs>
    <clipPath id="art"><rect x="${padding}" y="${padding}" width="${ART_SIZE}" height="${ART_SIZE}" rx="12"/></clipPath>
    <clipPath id="avatar"><circle cx="${avatarCenterX}" cy="${avatarCenterY}" r="${AVATAR_SIZE / 2}"/></clipPath>
    <clipPath id="copy"><rect x="${x}" y="0" width="${textWidth}" height="${HEIGHT}"/></clipPath>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" rx="${radius}" fill="${background}"/>
  <rect x="${padding}" y="${padding}" width="${ART_SIZE}" height="${ART_SIZE}" rx="12" fill="${placeholder}"/>
  ${art}
  ${avatar}
  <g clip-path="url(#copy)" font-family="${theme.fontFamily}" stroke-width="0.32" stroke-linejoin="round">
    <rect x="${x}" y="${statusY}" width="${statusWidth}" height="${STATUS_HEIGHT}" rx="${STATUS_HEIGHT / 2}" fill="${statusBackground}"/>
    <circle cx="${x + 12}" cy="${statusY + STATUS_HEIGHT / 2}" r="3" fill="${accent}"/>
    <text x="${x + 23}" y="${statusY + 18}" fill="${accent}" stroke="${accent}" font-size="${theme.labelSize}" font-weight="800">${status}</text>
    ${title ? `<text x="${x}" y="85" fill="${text}" stroke="${text}" font-size="${theme.titleSize}" font-weight="800">${title}</text>` : ''}
    ${playTime ? `<text x="${x}" y="109" fill="${muted}" stroke="${muted}" font-size="${theme.detailSize}" font-weight="500">${playTime}</text>` : ''}
    ${name ? `<text x="${nameX}" y="145" fill="${muted}" stroke="${muted}" font-size="${theme.detailSize}" font-weight="500">${name}</text>` : ''}
  </g>
</svg>`;
}
