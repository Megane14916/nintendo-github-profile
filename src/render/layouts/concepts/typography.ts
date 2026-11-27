import { deepRed, ivory, white, type DrawConcept } from './drawing';

export const typography = {
  type: (d) => `
    ${d.profile(23, 31, 340)}
    ${d.pill(576, 19, { align: 'end' })}
    ${d.text(d.title, 22, 107, { width: 553, size: 48, weight: 850 })}
    ${d.text(d.time, 25, 148, { width: 460, size: 15 })}
    ${d.art(535, 126, 41, 34, 5)}`,

  folio: (d) => `
    <path d="M24 20H413M24 123H413" stroke="${ivory}" stroke-opacity="0.8"/>
    <rect x="436" y="20" width="139" height="140" rx="5" fill="none" stroke="${ivory}" stroke-opacity="0.8"/>
    ${d.art(444, 28, 123, 124, 1)}
    ${d.text(d.title, 24, 70, { width: 390, size: 35, face: 'serif', weight: 700 })}
    ${d.text(d.time, 25, 102, { width: 380, size: 15, face: 'serif', color: ivory })}
    ${d.profile(24, 148, 204)}
    ${d.text(d.status, 413, 153, { width: 175, size: 13, align: 'end', face: 'serif', color: ivory })}`,

  baseline: (d) => `
    <path d="M23 126H576" stroke="${white}" stroke-opacity="0.78"/>
    ${d.art(24, 32, 87, 87, 10)}
    ${d.profile(130, 41, 402)}
    ${d.text(d.title, 129, 107, { width: 444, size: 33, weight: 800 })}
    <circle cx="30" cy="149" r="3" fill="${white}"/>
    ${d.text(d.status, 42, 154, { width: 193, size: 13, weight: 800 })}
    ${d.text(d.time, 576, 154, { width: 302, size: 14, align: 'end' })}`,

  mono: (d) => `
    <path d="M390 23h15 M390 23v15 M580 23h-15 M580 23v15 M390 157h15 M390 157v-15 M580 157h-15 M580 157v-15"
      fill="none" stroke="${ivory}" stroke-width="1.4"/>
    ${d.art(401, 33, 168, 114, 0)}
    ${d.text(d.status, 23, 43, { width: 195, size: 13, weight: 800, face: 'mono' })}
    ${d.text(d.title, 23, 89, { width: 360, size: 28, weight: 700, face: 'mono' })}
    ${d.text(d.time, 23, 117, { width: 360, size: 15, face: 'mono' })}
    ${d.profile(23, 148, 360)}`,

  minutes: (d) => {
    const digits = d.minutes?.toString();
    const timeOrRecent = digits ? `
      <rect x="420" y="21" width="159" height="138" rx="18" fill="${deepRed}"/>
      ${d.text(digits + d.minutesSuffix, 499.5, 101, {
        width: 152,
        size: Math.min(38, Math.floor(152 / (digits.length * 0.75 + (d.minutesSuffix.length === 1 ? 2.15 : 4)))),
        align: 'middle',
        weight: 850,
      })}
      ${d.text(d.playTimeLabel, 499.5, 128, { width: 142, size: 13, align: 'middle' })}`
      : d.recent ? `
      <rect x="420" y="21" width="159" height="138" rx="18" fill="${deepRed}"/>
      ${d.text(d.recent.label, 499.5, 75, { width: 142, size: 11, align: 'middle' })}
      ${d.text(d.recent.title, 499.5, 104, { width: 142, size: 16, weight: 800, align: 'middle' })}` : '';

    return `
      ${d.art(22, 31, 117, 117, 14)}
      ${d.profile(155, 36, 243)}
      ${d.text(d.title, 154, 90, { width: 247, size: 25, weight: 800 })}
      ${d.pill(154, 118, { tone: 'mint' })}
      ${timeOrRecent}`;
  },

  quiet: (d) => `
    ${d.text(d.status, 300, 36, { width: 230, size: 13, align: 'middle', weight: 800, color: ivory })}
    ${d.text(d.title, 300, 99, { width: 550, size: 38, align: 'middle', weight: 750, face: 'rounded' })}
    ${d.text(d.time, 300, 131, { width: 260, size: 14, align: 'middle' })}
    ${d.profile(23, 144, 165)}
    ${d.art(538, 121, 40, 40, 7)}`,
} satisfies Record<string, DrawConcept>;
