import { deepRed, ivory, redInk, white, type DrawConcept } from './drawing';

export const people = {
  identity: (d) => `
    ${d.avatar(59, 55, 56)}
    ${d.text(d.name, 105, 61, { width: 317, size: 33, face: 'rounded' })}
    <circle cx="108" cy="80" r="3" fill="${ivory}"/>
    ${d.text(d.status, 119, 85, { width: 220, size: 13, color: ivory })}
    ${d.text(d.title, 24, 127, { width: 391, size: 25 })}
    ${d.text(d.time, 25, 153, { width: 390, size: 14 })}
    ${d.art(442, 24, 132, 132, 15)}`,

  speech: (d) => `
    ${d.avatar(46, 47, 41)}
    <path d="M88 22h157a13 13 0 0 1 13 13v10a13 13 0 0 1-13 13H99l-15 9v-9a13 13 0 0 1-9-13V35a13 13 0 0 1 13-13Z"
      fill="${ivory}"/>
    ${d.text(d.status, 89, 44, { width: 161, size: 12, color: redInk })}
    ${d.text(d.name, 86, 83, { width: 320, size: 15, face: 'rounded' })}
    ${d.text(d.title, 24, 124, { width: 395, size: 29 })}
    ${d.text(d.time, 25, 153, { width: 392, size: 14 })}
    ${d.art(440, 22, 136, 136, 15)}`,

  corner: (d) => `
    <path d="M390 0H582Q600 0 600 18v38H418Z" fill="${ivory}"/>
    ${d.profile(423, 28, 154, redInk)}
    ${d.art(22, 22, 136, 136, 14)}
    ${d.pill(180, 29, { tone: 'mint' })}
    ${d.text(d.title, 180, 103, { width: 393, size: 31 })}
    ${d.text(d.time, 181, 131, { width: 393, size: 15 })}`,

  live: (d) => `
    <rect x="20" y="23" width="177" height="64" rx="15" fill="#E8F8EB"/>
    <circle cx="35" cy="45" r="4" fill="${redInk}"/>
    ${d.text(d.status, 32, 70, { width: 152, size: 12, color: '#145D36' })}
    ${d.profile(24, 127, 169)}
    ${d.art(213, 23, 134, 134, 16)}
    ${d.text(d.title, 366, 86, { width: 213, size: 23 })}
    ${d.text(d.time, 366, 112, { width: 210, size: 13 })}`,

  ribbon: (d) => `
    <path d="M0 124H600v37H0Z" fill="${deepRed}"/>
    <path d="M0 124H600" stroke="${ivory}" stroke-opacity="0.6"/>
    ${d.art(23, 16, 100, 100, 12)}
    ${d.text(d.title, 151, 63, { width: 425, size: 31, face: 'rounded' })}
    ${d.text(d.time, 152, 91, { width: 425, size: 15 })}
    ${d.profile(23, 142, 355)}
    ${d.pill(578, 130, { tone: 'mint', align: 'end' })}`,

  pass: (d) => `
    <rect x="20" y="18" width="165" height="144" rx="14" fill="${ivory}"/>
    <path d="M34 119H171" stroke="${redInk}" stroke-opacity="0.55" stroke-dasharray="2 3"/>
    ${d.avatar(102.5, 58, 41)}
    ${d.text(d.name, 102.5, 103, { width: 144, size: 20, align: 'middle', color: redInk, face: 'rounded' })}
    ${d.text(d.status, 102.5, 141, { width: 148, size: 11, align: 'middle', color: redInk })}
    ${d.text(d.title, 205, 83, { width: 219, size: 23 })}
    ${d.text(d.time, 205, 113, { width: 219, size: 13 })}
    ${d.art(444, 23, 133, 133, 12)}`,
} satisfies Record<string, DrawConcept>;
