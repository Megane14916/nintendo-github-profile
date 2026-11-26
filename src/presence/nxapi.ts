import { PRESENCE_TIMEOUT_MS } from '../config';
import { readLimitedBody } from '../utils/read-limited-body';

const MAX_JSON_BYTES = 128 * 1024;

export async function fetchPresence(endpoint: string): Promise<unknown> {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || url.username || url.password) return null;

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(PRESENCE_TIMEOUT_MS),
    });
    const mime = response.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase();
    if (!response.ok || mime !== 'application/json') {
      void response.body?.cancel().catch(() => {});
      return null;
    }

    const bytes = await readLimitedBody(response, MAX_JSON_BYTES);
    return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes));
  } catch {
    return null;
  }
}
