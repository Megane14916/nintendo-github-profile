import { describe, expect, it } from 'vitest';
import error from '../fixtures/error.json';
import offline from '../fixtures/offline.json';
import online from '../fixtures/online.json';
import playing from '../fixtures/playing.json';
import { normalizePresence } from '../src/presence/normalize';
import { renderCard } from '../src/render/card';

const fetchedAt = '2026-11-24T00:00:00.000Z';

describe('renderCard', () => {
  it.each([
    [playing, 'オンライン'],
    [online, 'オンライン'],
    [offline, 'オフライン'],
    [error, '状態を取得できません'],
  ])('renders a 600 by 180 SVG for %j', (fixture, label) => {
    const svg = renderCard(normalizePresence(fixture, fetchedAt));
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="600" height="180"/);
    expect(svg).toContain('>' + label + '</text>');
    expect(svg).toContain('<rect width="600" height="180" rx="11" fill="#E4000F"/>');
    expect(svg).toContain('<clipPath id="art"><rect x="22" y="22" width="136" height="136" rx="7"/>');
    expect(svg).toContain('xml:lang="ja"');
    expect(svg.match(/\bfont-weight="[^"]+"/g)).toEqual(['font-weight="400"']);
    expect(svg).not.toMatch(/<text\b[^>]*\bstroke=/);
    expect(svg).toContain('font-family="Noto Sans JP,');
    expect(svg).toMatch(/<\/svg>$/);
  });

  it('places the offline badge at the top and shows the latest game on the play-time row', () => {
    const svg = renderCard(normalizePresence(offline, fetchedAt), undefined, 'default', {
      lastPlayed: { title: 'Starlight Trails', seenAt: fetchedAt },
    });
    expect(svg).toContain('<rect x="180" y="22" width="101" height="26"');
    expect(svg).toMatch(/<text x="180" y="80"[^>]*>プレイ中のゲームはありません<\/text>/);
    expect(svg).toMatch(/<text x="180" y="109"[^>]*font-size="15">最近プレイしたゲーム: Starlight Trails<\/text>/);
  });

  it('places a default profile icon to the left of the name when the avatar is missing', () => {
    const svg = renderCard(normalizePresence(playing, fetchedAt));
    expect(svg).toContain('<g transform="translate(192 140)" aria-hidden="true">');
    expect(svg).toContain('<text x="213" y="145"');
    expect(svg).toContain('>Sample Player</text>');
  });

  it('shortens long titles and escapes XML text including invalid characters', () => {
    const presence = normalizePresence(playing, fetchedAt);
    if (!presence.game) throw new Error('Playing fixture is missing a game');
    const family = '👩‍👩‍👧‍👦';
    presence.game.title = '<&" ' + family.repeat(60);
    presence.user.name = 'A\u0000\uD800<&"\uFFFE B';
    const svg = renderCard(presence);
    expect(svg).toContain('&lt;&amp;&quot; ' + family);
    expect(svg).toContain(family + '…');
    expect(svg).toContain('A&lt;&amp;&quot; B');
    expect(svg).not.toContain('\u0000');
    expect(svg).not.toContain('\uD800');
    expect(svg).not.toContain('\uFFFE');
    expect(svg).not.toContain('<image ');
  });
});
