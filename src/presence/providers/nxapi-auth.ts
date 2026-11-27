import { PRESENCE_TIMEOUT_MS } from '../../config';
import { readLimitedBody } from '../../utils/read-limited-body';
import { PresenceError } from '../error';
import { normalizePresence } from '../normalize';
import type { PresenceProvider } from '../provider';

const MAX_JSON_BYTES = 128 * 1024;

async function fetchPresence(url: URL): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(PRESENCE_TIMEOUT_MS),
    });
  } catch {
    throw new PresenceError('presence', 'request-failed');
  }
  const mime = response.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase();
  if (!response.ok || mime !== 'application/json') {
    void response.body?.cancel().catch(() => {});
    const code = response.status === 401 || response.status === 403 ? 'authentication' : 'http';
    throw response.ok
      ? new PresenceError('presence', 'invalid-response')
      : new PresenceError('presence', code, response.status);
  }
  try {
    const bytes = await readLimitedBody(response, MAX_JSON_BYTES);
    return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes));
  } catch {
    throw new PresenceError('presence', 'invalid-response');
  }
}

export function createNxapiAuthProvider(endpoint: string): PresenceProvider {
  const url = URL.parse(endpoint);
  if (!url || url.protocol !== 'https:' || url.username || url.password) {
    throw new PresenceError('configuration', 'invalid-setting');
  }
  return {
    source: 'nxapi-auth',
    imageProxyOrigin: url.origin,
    async getPresence() {
      const payload = await fetchPresence(url);
      const presence = normalizePresence(payload, new Date().toISOString());
      if (presence.status === 'unknown') throw new PresenceError('presence', 'invalid-response');
      return presence;
    },
  };
}
