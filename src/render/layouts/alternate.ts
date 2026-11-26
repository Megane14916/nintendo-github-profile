import type { GamePresence } from '../../model/presence';
import { escapeXml } from '../../utils/escape-xml';
import type { CardAssets } from '../assets';
import { getCardCopy, shorten } from '../copy';
import type { RedTreatment } from '../themes';
import type { CardLayout } from './presets';

const WIDTH = 600;
const HEIGHT = 180;
const AVATAR_SIZE = 24;
const BADGE_HEIGHT = 25;

export function renderAlternateCard(presence: GamePresence, assets: CardAssets, theme: RedTreatment, layout: CardLayout): string {
  const { art, summary, profile, badge, rule, frame } = layout;
  const { status, heading, playTime } = getCardCopy(presence);
  const { background, muted, text, statusBackground, placeholder, radius } = theme;
  const accent = theme.status[presence.status];

  const titleSize = Math.min(theme.titleSize, Math.floor(summary.width / 9));
  const title = heading && escapeXml(shorten(heading, summary.width, titleSize));
  const summaryLeft = summary.centered ? summary.x - summary.width / 2 : summary.x;
  const summaryAnchor = summary.centered ? 'middle' : 'start';
  const nameWidth = profile.stacked ? profile.width : profile.width - AVATAR_SIZE - 9;
  const name = presence.user.name && escapeXml(shorten(presence.user.name, nameWidth, theme.detailSize));
  const profileLeft = profile.stacked ? profile.x - profile.width / 2 : profile.x;
  const nameX = profile.stacked ? profile.x : profile.x + AVATAR_SIZE + 9;
  const nameY = profile.y + (profile.stacked ? 44 : 17);
  const nameAnchor = profile.stacked ? 'middle' : 'start';

  const avatarX = profile.stacked ? profile.x : profile.x + AVATAR_SIZE / 2;
  const avatarY = profile.y + AVATAR_SIZE / 2;
  const artX = art.x + art.size / 2;
  const artY = art.y + art.size / 2;
  const badgeWidth = status.length * theme.labelSize + 35;
  const badgeX = badge.x - (badge.align === 'center' ? badgeWidth / 2 : badge.align === 'right' ? badgeWidth : 0);

  const image = assets.gameImageDataUri
    ? `<image x="${art.x}" y="${art.y}" width="${art.size}" height="${art.size}" href="${escapeXml(assets.gameImageDataUri)}"
        clip-path="url(#art)" preserveAspectRatio="xMidYMid slice"/>`
    : `<g transform="translate(${artX} ${artY})" fill="none" stroke="${muted}" stroke-width="1.5" stroke-linecap="round">
        <rect x="-17" y="-10" width="34" height="20" rx="6"/>
        <path d="M-11 0h8 M-7 -4v8"/>
        <circle cx="8" r="2"/>
      </g>`;
  const avatar = assets.avatarDataUri
    ? `<image x="${avatarX - AVATAR_SIZE / 2}" y="${profile.y}" width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" href="${escapeXml(assets.avatarDataUri)}"
        clip-path="url(#avatar)" preserveAspectRatio="xMidYMid slice"/>`
    : name
      ? `<g transform="translate(${avatarX} ${avatarY})" aria-hidden="true">
          <circle r="${AVATAR_SIZE / 2}" fill="${placeholder}"/>
          <circle cy="-3" r="2.5" fill="${muted}"/>
          <path d="M-6 6c0-3 2.7-5 6-5s6 2 6 5Z" fill="${muted}"/>
        </g>`
      : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xml:lang="ja" role="img" aria-labelledby="card-title">
  <title id="card-title">Nintendo Switch ${status}${title ? '：' + title : ''}</title>
  <defs>
    <clipPath id="art"><rect x="${art.x}" y="${art.y}" width="${art.size}" height="${art.size}" rx="${theme.artworkRadius}"/></clipPath>
    <clipPath id="avatar"><circle cx="${avatarX}" cy="${avatarY}" r="${AVATAR_SIZE / 2}"/></clipPath>
    <clipPath id="summary"><rect x="${summaryLeft}" width="${summary.width}" height="${HEIGHT}"/></clipPath>
    <clipPath id="profile"><rect x="${profileLeft}" width="${profile.width}" height="${HEIGHT}"/></clipPath>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" rx="${radius}" fill="${background}"/>
  ${rule ? `<path d="${rule.path}" stroke="${muted}" stroke-opacity="0.55"${rule.dashed ? ' stroke-dasharray="4 5"' : ''}/>` : ''}
  ${frame ? `<rect x="16" y="16" width="568" height="148" rx="12" fill="none" stroke="${muted}" stroke-opacity="0.65"/>` : ''}
  <rect x="${art.x}" y="${art.y}" width="${art.size}" height="${art.size}" rx="${theme.artworkRadius}" fill="${placeholder}"/>
  ${image}
  ${avatar}
  <g font-family="${theme.fontFamily}" stroke-width="0.25" stroke-linejoin="round">
    <rect x="${badgeX}" y="${badge.y}" width="${badgeWidth}" height="${BADGE_HEIGHT}" rx="${theme.badgeRadius}" fill="${statusBackground}"/>
    <circle cx="${badgeX + 11}" cy="${badge.y + BADGE_HEIGHT / 2}" r="3" fill="${accent}"/>
    <text x="${badgeX + 22}" y="${badge.y + 17}" fill="${accent}" stroke="${accent}" font-size="${theme.labelSize}" font-weight="700">${status}</text>
    <g clip-path="url(#summary)" text-anchor="${summaryAnchor}">
      ${title ? `<text x="${summary.x}" y="${summary.titleY}" fill="${text}" stroke="${text}" font-size="${titleSize}" font-weight="${theme.titleWeight}">${title}</text>` : ''}
      ${playTime ? `<text x="${summary.x}" y="${summary.timeY}" fill="${muted}" stroke="${muted}" font-size="${theme.detailSize}" font-weight="500">${playTime}</text>` : ''}
    </g>
    ${name ? `<text x="${nameX}" y="${nameY}" fill="${muted}" stroke="${muted}" text-anchor="${nameAnchor}"
      font-size="${theme.detailSize}" font-weight="600" clip-path="url(#profile)">${name}</text>` : ''}
  </g>
</svg>`;
}
