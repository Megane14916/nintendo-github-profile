import { deepRed, ivory, redInk, white, type DrawConcept } from './drawing';

export const artwork = {
  orbit: (d) => `
    <ellipse cx="100" cy="90" rx="86" ry="60" transform="rotate(-25 100 90)"
      fill="none" stroke="${ivory}" stroke-opacity="0.7"/>
    ${d.art(31, 21, 138, 138, 69)}
    <circle cx="100" cy="90" r="72" fill="none" stroke="${ivory}" stroke-width="1.2"/>
    <circle cx="167" cy="56" r="4" fill="${ivory}"/>
    ${d.profile(205, 39, 192)}
    ${d.pill(575, 27, { tone: 'mint', align: 'end' })}
    ${d.text(d.title, 205, 105, { width: 367, size: 29, weight: 800 })}
    ${d.text(d.time, 206, 137, { width: 368, size: 15 })}`,

  postcard: (d) => `
    <rect x="26" y="24" width="195" height="140" rx="7" fill="none" stroke="${ivory}" stroke-opacity="0.65"/>
    <rect x="21" y="19" width="195" height="140" rx="7" fill="${ivory}"/>
    ${d.art(29, 27, 179, 104, 3)}
    ${d.profile(33, 144, 166, redInk)}
    ${d.pill(243, 28, { tone: 'ivory', radius: 3 })}
    ${d.text(d.title, 243, 94, { width: 334, size: 29, weight: 700, face: 'serif' })}
    ${d.text(d.time, 244, 124, { width: 332, size: 15, color: ivory })}`,

  panorama: (d) => `
    ${d.art(313, 21, 267, 138, 16)}
    <rect x="312" y="20" width="269" height="140" rx="17" fill="none" stroke="${white}" stroke-opacity="0.65"/>
    ${d.pill(23, 22, { tone: 'mint' })}
    ${d.text(d.title, 23, 89, { width: 275, size: 27, weight: 800 })}
    ${d.text(d.time, 23, 115, { width: 275, size: 14 })}
    ${d.profile(23, 146, 277)}`,

  contact: (d) => `
    <rect x="150" y="18" width="183" height="144" rx="8" fill="${deepRed}"/>
    <path d="M158 29v122 M325 29v122" stroke="${ivory}" stroke-width="2.5" stroke-dasharray="4 7" stroke-opacity="0.8"/>
    ${d.art(167, 27, 149, 126, 3)}
    <circle cx="24" cy="47" r="3" fill="${white}"/>
    ${d.text(d.status, 21, 70, { width: 126, size: 10, weight: 750, face: 'mono' })}
    ${d.avatar(37, 102, 29)}
    ${d.text(d.name, 22, 133, { width: 122, size: 13, face: 'mono' })}
    ${d.text(d.title, 353, 87, { width: 223, size: 23, weight: 800 })}
    ${d.text(d.time, 353, 118, { width: 223, size: 13, face: 'mono' })}`,

  sleeve: (d) => `
    <rect x="23" y="19" width="155" height="142" rx="7" fill="${ivory}"/>
    ${d.art(39, 22, 136, 136, 5)}
    <path d="M31 32v21" stroke="${redInk}" stroke-width="2" stroke-linecap="round"/>
    ${d.text(d.title, 200, 71, { width: 376, size: 32, weight: 800, face: 'rounded' })}
    ${d.text(d.time, 201, 101, { width: 373, size: 15 })}
    ${d.profile(201, 143, 196)}
    ${d.pill(578, 131, { tone: 'ivory', radius: 5, align: 'end' })}`,

  instant: (d) => `
    <g transform="rotate(-6 95 90)">
      <rect x="28" y="24" width="140" height="138" rx="3" fill="${deepRed}"/>
      <rect x="24" y="20" width="140" height="138" rx="3" fill="${white}"/>
      ${d.art(32, 28, 124, 106, 1)}
    </g>
    ${d.pill(199, 23, { tone: 'mint', radius: 7 })}
    ${d.text(d.title, 198, 93, { width: 374, size: 29, weight: 800 })}
    ${d.text(d.time, 199, 120, { width: 377, size: 15 })}
    ${d.profile(199, 149, 367)}`,
} satisfies Record<string, DrawConcept>;
