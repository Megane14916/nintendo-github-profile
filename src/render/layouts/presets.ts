export interface CardLayout {
  art: { x: number; y: number; size: number };
  summary: { x: number; width: number; titleY: number; timeY: number; centered?: true };
  profile: { x: number; y: number; width: number; stacked?: true };
  badge: { x: number; y: number; align?: 'right' | 'center' };
  rule?: { path: string; dashed?: true };
  frame?: true;
}

export const cardLayouts = {
  cover: {
    art: { x: 20, y: 20, size: 140 },
    summary: { x: 182, width: 392, titleY: 77, timeY: 103 },
    profile: { x: 182, y: 127, width: 392 },
    badge: { x: 182, y: 20 },
  },
  profile: {
    art: { x: 22, y: 75, size: 84 },
    summary: { x: 128, width: 450, titleY: 113, timeY: 140 },
    profile: { x: 22, y: 20, width: 365 },
    badge: { x: 578, y: 20, align: 'right' },
    rule: { path: 'M22 59H578' },
  },
  reverse: {
    art: { x: 440, y: 20, size: 140 },
    summary: { x: 24, width: 394, titleY: 89, timeY: 116 },
    profile: { x: 24, y: 136, width: 394 },
    badge: { x: 24, y: 22 },
  },
  footer: {
    art: { x: 24, y: 17, size: 100 },
    summary: { x: 150, width: 426, titleY: 68, timeY: 96 },
    profile: { x: 24, y: 138, width: 355 },
    badge: { x: 576, y: 137, align: 'right' },
    rule: { path: 'M24 127H576' },
  },
  compact: {
    art: { x: 25, y: 51, size: 78 },
    summary: { x: 123, width: 270, titleY: 77, timeY: 103 },
    profile: { x: 123, y: 122, width: 270 },
    badge: { x: 575, y: 77, align: 'right' },
  },
  rail: {
    art: { x: 445, y: 22, size: 136 },
    summary: { x: 167, width: 255, titleY: 94, timeY: 122 },
    profile: { x: 82, y: 56, width: 124, stacked: true },
    badge: { x: 167, y: 27 },
    rule: { path: 'M150 22V158' },
  },
  headline: {
    art: { x: 24, y: 99, size: 62 },
    summary: { x: 24, width: 550, titleY: 56, timeY: 80 },
    profile: { x: 108, y: 118, width: 272 },
    badge: { x: 576, y: 118, align: 'right' },
  },
  frame: {
    art: { x: 35, y: 35, size: 110 },
    summary: { x: 167, width: 380, titleY: 94, timeY: 118 },
    profile: { x: 167, y: 34, width: 380 },
    badge: { x: 167, y: 130 },
    frame: true,
  },
  ticket: {
    art: { x: 20, y: 42, size: 96 },
    summary: { x: 133, width: 242, titleY: 85, timeY: 111 },
    profile: { x: 403, y: 100, width: 175 },
    badge: { x: 403, y: 46 },
    rule: { path: 'M389 20V160', dashed: true },
  },
  centered: {
    art: { x: 23, y: 50, size: 80 },
    summary: { x: 300, width: 350, titleY: 94, timeY: 121, centered: true },
    profile: { x: 536, y: 58, width: 102, stacked: true },
    badge: { x: 300, y: 28, align: 'center' },
  },
  stacked: {
    art: { x: 270, y: 101, size: 60 },
    summary: { x: 300, width: 550, titleY: 54, timeY: 79, centered: true },
    profile: { x: 24, y: 119, width: 220 },
    badge: { x: 576, y: 118, align: 'right' },
  },
  gallery: {
    art: { x: 22, y: 26, size: 128 },
    summary: { x: 334, width: 244, titleY: 91, timeY: 119 },
    profile: { x: 237, y: 58, width: 126, stacked: true },
    badge: { x: 334, y: 27 },
    rule: { path: 'M170 26V154 M304 26V154' },
  },
} as const satisfies Record<string, CardLayout>;
