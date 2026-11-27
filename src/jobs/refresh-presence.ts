import type { Bindings } from '../config';
import { loadCardAssets } from '../render/assets';
import { writePresenceSnapshot } from '../storage/presence';
import { PresenceError } from '../presence/error';
import { createPresenceProvider } from '../presence/provider';

export { PresenceError };

export async function refreshPresence(env: Bindings): Promise<string> {
  const kv = env.PRESENCE_KV;
  const provider = createPresenceProvider(env);
  if (!kv || !provider) throw new PresenceError('configuration', 'missing-setting');

  const presence = await provider.getPresence();
  const assets = await loadCardAssets(presence, provider.imageProxyOrigin);
  const refreshedAt = new Date().toISOString();
  try {
    await writePresenceSnapshot(kv, { schemaVersion: 1, presence, assets, refreshedAt });
  } catch {
    throw new PresenceError('storage', 'request-failed');
  }
  return refreshedAt;
}
