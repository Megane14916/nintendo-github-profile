import { deepRed, ivory, redInk, white, type DrawConcept } from './drawing';

export const playful = {
  ticket: (d) => `
    <rect x="16" y="17" width="568" height="146" rx="13" fill="none" stroke="${ivory}" stroke-opacity="0.75"/>
    <path d="M397 25V155" stroke="${ivory}" stroke-opacity="0.75" stroke-dasharray="3 5"/>
    <circle cx="397" cy="17" r="7" fill="${deepRed}"/>
    <circle cx="397" cy="163" r="7" fill="${deepRed}"/>
    ${d.text(d.title, 30, 66, { width: 348, size: 31, weight: 750, face: 'serif' })}
    ${d.text(d.time, 31, 98, { width: 342, size: 15, face: 'mono' })}
    ${d.profile(30, 135, 346)}
    ${d.art(417, 28, 151, 96, 6)}
    ${d.pill(492.5, 130, { tone: 'ivory', align: 'middle', radius: 4 })}`,

  handheld: (d) => `
    <rect x="16" y="15" width="568" height="150" rx="33" fill="none" stroke="${white}" stroke-width="1.65"/>
    <rect x="81" y="31" width="438" height="118" rx="13" fill="${deepRed}"/>
    <path d="M34 90h26M47 77v26" stroke="${white}" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="548" cy="84" r="5" fill="${white}"/>
    <circle cx="564" cy="96" r="5" fill="${white}"/>
    ${d.art(93, 43, 94, 94, 7)}
    ${d.pill(202, 39, { tone: 'mint', radius: 6 })}
    ${d.text(d.title, 202, 93, { width: 300, size: 27, weight: 800, face: 'rounded' })}
    ${d.text(d.time, 202, 120, { width: 162, size: 12 })}
    ${d.profile(365, 116, 139)}`,

  pixels: (d) => `
    <path d="M16 23h7v-7h554v7h7v134h-7v7H23v-7h-7Z"
      fill="none" stroke="${white}" stroke-width="2"/>
    ${d.art(34, 33, 111, 113, 0)}
    ${d.pill(169, 34, { radius: 0 })}
    ${d.text(d.title, 169, 96, { width: 389, size: 30, weight: 800, face: 'mono' })}
    ${d.text(d.time, 570, 137, { width: 204, size: 14, align: 'end', face: 'mono' })}
    ${d.profile(169, 132, 186)}`,

  scoreboard: (d) => `
    <rect x="16" y="13" width="568" height="49" rx="10" fill="${deepRed}"/>
    <path d="M297 21v33" stroke="${ivory}" stroke-opacity="0.6"/>
    <circle cx="33" cy="37.5" r="4" fill="${ivory}"/>
    ${d.text(d.status, 46, 45, { width: 242, size: 17, weight: 850 })}
    ${d.text(d.time, 569, 44, { width: 257, size: 14, align: 'end', face: 'mono' })}
    ${d.art(25, 81, 76, 76, 7)}
    ${d.text(d.title, 122, 118, { width: 451, size: 29, weight: 800 })}
    ${d.profile(123, 145, 449)}`,

  sunrise: (d) => `
    <path d="M339 152A153 153 0 0 1 587 21V156Z" fill="${deepRed}"/>
    <path d="M393 91a81 81 0 0 1 162-2" fill="none" stroke="${ivory}" stroke-opacity="0.72"/>
    <path d="M392 119l-11 8 M558 29l10-9 M568 57l12-3 M381 94h-13" stroke="${ivory}" stroke-linecap="round"/>
    ${d.art(401, 18, 145, 145, 72.5)}
    ${d.pill(24, 23, { tone: 'ivory' })}
    ${d.text(d.title, 23, 94, { width: 343, size: 31, weight: 800, face: 'rounded' })}
    ${d.text(d.time, 24, 121, { width: 342, size: 14 })}
    ${d.profile(24, 149, 342)}`,

  sticker: (d) => `
    <path d="M21 51H356l23 27-23 28H21Z" fill="${white}"/>
    <path d="M356 51v54l23-27Z" fill="#FFE6E8"/>
    ${d.pill(23, 16, { tone: 'mint', radius: 5 })}
    ${d.text(d.title, 34, 87, { width: 312, size: 29, color: redInk, weight: 850, face: 'rounded' })}
    ${d.text(d.time, 24, 130, { width: 356, size: 14 })}
    ${d.profile(23, 153, 355)}
    <rect x="427" y="35" width="145" height="113" rx="15" fill="none" stroke="${white}" stroke-width="1.3"/>
    ${d.art(434, 42, 131, 99, 10)}`,
} satisfies Record<string, DrawConcept>;
