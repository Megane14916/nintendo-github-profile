import type { Bindings } from '../config';
import { loadCardAssets } from '../render/assets';
import { writePresenceSnapshot } from '../storage/presence';
import { PresenceError } from './error';
import { createPresenceProvider } from './provider';

export { PresenceError };

export async function refreshPresence(env: Bindings): Promise<string> {
  const kv = env.PRESENCE_KV;
  const provider = createPresenceProvider(env);
  if (!kv || !provider) throw new PresenceError('configuration', 'missing-setting');

  const presence = await provider.getPresence();
  const assets = await loadCardAssets(presence, provider.imageProxyOrigin);
  const refreshedAt = new Date().toISOString();
  await writePresenceSnapshot(kv, { schemaVersion: 1, presence, assets, refreshedAt });
  return refreshedAt;
}
