import type { Bindings } from '../../config';
import { PresenceError } from '../error';
import { normalizePresence } from '../normalize';
import type { PresenceProvider } from '../provider';

export function createSelfProvider(env: Bindings): PresenceProvider {
  const nsaId = env.MAIN_NSA_ID?.trim().toLowerCase();
  const sessionToken = env.NINTENDO_SESSION_TOKEN?.trim();
  const clientId = env.NXAPI_AUTH_CLIENT_ID?.trim();
  const clientSecret = env.NXAPI_AUTH_CLIENT_SECRET?.trim() || undefined;
  if (!nsaId || !sessionToken || !clientId) throw new PresenceError('configuration', 'missing-setting');
  if (!/^[0-9a-f]{16}$/.test(nsaId)) throw new PresenceError('configuration', 'invalid-setting');

  return {
    source: 'self',
    async getPresence() {
      const { getNintendoFriend } = await import('../../nintendo/client');
      const friend = await getNintendoFriend({ sessionToken, clientId, clientSecret }, nsaId);
      // Coral returns the friend object directly. Its presence fields match the JSON provider.
      const presence = normalizePresence({ friend }, new Date().toISOString());
      if (presence.status === 'unknown') throw new PresenceError('nintendo', 'invalid-response');
      return presence;
    },
  };
}
