import { fileURLToPath } from 'node:url';
import { getPlatformProxy } from 'wrangler';
import { PresenceError, refreshPresence } from '../.wrangler/worker/refresh.mjs';

try {
  const local = await getPlatformProxy({
    configPath: fileURLToPath(new URL('../wrangler.jsonc', import.meta.url)),
    remoteBindings: false,
  });
  try {
    console.log('Presence updated at ' + await refreshPresence(local.env));
  } finally {
    await local.dispose();
  }
} catch (failure) {
  const reason = failure instanceof PresenceError ? failure.message : 'local KV or refresh failed';
  console.error('Presence update failed (' + reason + ').');
  process.exitCode = 1;
}
