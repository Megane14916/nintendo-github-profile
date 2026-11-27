import { describe, expect, it } from 'vitest';
import playing from '../fixtures/playing.json';
import { normalizePresence } from '../src/presence/normalize';

const fetchedAt = '2026-11-24T00:00:00.000Z';

describe('normalizePresence', () => {
  it('maps the public nxapi shape to the card model and keeps the cumulative minutes', () => {
    expect(normalizePresence(playing, fetchedAt)).toEqual({
      status: 'playing',
      user: { name: 'Sample Player', avatarUrl: null },
      game: { title: 'Starlight Trails', imageUrl: null, totalPlayTimeMinutes: 125 },
      fetchedAt,
    });
  });

  it.each([
    ['https://ec.nintendo.com/apps/0100C2500FC20000/JP?private=x', '0100c2500fc20000'],
    ['https://ec.nintendo.com.example.invalid/apps/0100c2500fc20000/JP', undefined],
    ['https://ec.nintendo.com/apps/70010000046394/JP', undefined],
  ])('recognizes application IDs from eShop URLs: %s', (shopUri, titleId) => {
    const payload = { friend: { presence: { state: 'PLAYING', game: { name: 'Sample', shopUri } } } };
    const game = normalizePresence(payload, fetchedAt).game;
    expect(game?.titleId).toBe(titleId);
    expect(game).not.toHaveProperty('shopUri');
  });

  it.each([
    ['PLAYING', null, 'playing'],
    ['ONLINE', null, 'online'],
    ['INACTIVE', 'Stale title', 'online'],
    ['OFFLINE', 'Stale title', 'offline'],
    ['FUTURE_STATUS', 'Stale title', 'unknown'],
  ])('handles %s with game title %s', (state, name, status) => {
    const payload = { friend: { presence: { state, game: { name } } } };
    expect(normalizePresence(payload, fetchedAt)).toMatchObject({ status, game: null });
  });

  it.each([null, [], { friend: { presence: 'OFFLINE' } }, { error: 'invalid_request' }])(
    'falls back for malformed or error responses',
    (payload) => {
      expect(normalizePresence(payload, fetchedAt)).toMatchObject({
        status: 'unknown',
        user: { name: null, avatarUrl: null },
        game: null,
      });
    },
  );

  it.each([undefined, 0, -1, 1.5, '60', NaN])('omits unreported or invalid minutes (%s)', (totalPlayTime) => {
    const payload = {
      friend: {
        name: ' ',
        image2Uri: '',
        imageUri: 'https://example.invalid/avatar.png',
        presence: { state: 'PLAYING', game: { name: 'Sample', imageUri: null, totalPlayTime } },
      },
    };
    expect(normalizePresence(payload, fetchedAt)).toMatchObject({
      status: 'playing',
      user: { name: null, avatarUrl: 'https://example.invalid/avatar.png' },
      game: { title: 'Sample', imageUrl: null, totalPlayTimeMinutes: null },
    });
  });
});
