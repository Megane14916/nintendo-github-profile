import type { Bindings } from '../config';
import type { GamePresence } from '../model/presence';
import { PresenceError } from './error';
import { createNxapiAuthProvider } from './providers/nxapi-auth';
import { createSelfProvider } from './providers/self';

export type PresenceSource = 'self' | 'nxapi-auth';

export interface PresenceProvider {
  source: PresenceSource;
  imageProxyOrigin?: string;
  getPresence(): Promise<GamePresence>;
}

export function createPresenceProvider(env: Bindings = {}): PresenceProvider | undefined {
  const source = env.PRESENCE_SOURCE?.trim();
  const endpoint = env.NXAPI_PRESENCE_URL?.trim();
  if (source === 'self') return createSelfProvider(env);
  if (source && source !== 'nxapi-auth') throw new PresenceError('configuration', 'invalid-setting');
  if (endpoint) return createNxapiAuthProvider(endpoint);
  if (source) throw new PresenceError('configuration', 'missing-setting');
}
