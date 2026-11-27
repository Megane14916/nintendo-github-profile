import { AsyncLocalStorage } from 'node:async_hooks';
import { PresenceError } from '../presence/error';
import { readLimitedBody } from '../utils/read-limited-body';

const CONFIG_URL = 'https://fancy.org.uk/api/nxapi/config';
const OAUTH_TOKEN_URL = 'https://nxapi-auth.fancy.org.uk/api/oauth/token';
const REQUEST_TIMEOUT_MS = 15_000;
const ORIGINS = {
  'https://accounts.nintendo.com': 'nintendo-account',
  'https://api.accounts.nintendo.com': 'nintendo-account',
  'https://api-lp1.znc.srv.nintendo.net': 'nintendo',
  'https://nxapi-auth.fancy.org.uk': 'nxapi-auth',
  'https://nxapi-znca-api.fancy.org.uk': 'nxapi-auth',
} as const;

interface RemoteConfig {
  coral: { znca_version: string };
  coral_auth: { default: ['nxapi', string]; flapg: null; imink: null };
}
type ConfigModule = { default: RemoteConfig };
const request = new AsyncLocalStorage<{
  clientId: string;
  clientSecret?: string;
  signal: AbortSignal;
  config?: Promise<ConfigModule>;
}>();

const WorkerHeaders = Headers;
export { WorkerHeaders as Headers };
export const NXAPI_USER_AGENT = 'nintendo-github-presence/0.1.0 (+https://github.com/Megane14916/nintendo-github-profile)';

export function withNxapiRequest<T>(clientId: string, clientSecret: string | undefined, run: () => Promise<T>): Promise<T> {
  return request.run({ clientId, clientSecret, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }, run);
}

export function nxapiAuthEnv(): Record<string, string | undefined> {
  const current = request.getStore();
  return {
    NXAPI_ZNCA_API_CLIENT_ID: current?.clientId,
    NXAPI_ZNCA_API_CLIENT_SECRET: current?.clientSecret,
  };
}

export function nxapiStage(url: URL) {
  if (url.href === CONFIG_URL) return 'nxapi-config';
  return Object.hasOwn(ORIGINS, url.origin) ? ORIGINS[url.origin as keyof typeof ORIGINS] : undefined;
}

// Replaces undici for nxapi's imported fetch in the Worker bundle.
export async function fetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(input);
  const stage = nxapiStage(url);
  if (!stage || url.username || url.password || (init?.body instanceof URLSearchParams && url.href !== OAUTH_TOKEN_URL)) {
    throw new PresenceError('nxapi-auth', 'invalid-response');
  }
  const signal = request.getStore()?.signal;
  let response: Response;
  try {
    response = await globalThis.fetch(url, {
      ...init,
      redirect: 'manual',
      cache: 'no-store',
      signal: signal && init?.signal ? AbortSignal.any([signal, init.signal]) : signal ?? init?.signal,
    });
  } catch {
    throw new PresenceError(stage, 'request-failed');
  }
  if (response.status >= 300 && response.status < 400) {
    void response.body?.cancel().catch(() => {});
    throw new PresenceError(stage, 'http', response.status);
  }
  return response;
}

export function loadNxapiConfig(version: string, revision: string, coralVersion: string): Promise<ConfigModule> {
  const current = request.getStore();
  if (!current) throw new PresenceError('nxapi-config', 'request-failed');
  return current.config ??= fetchNxapiConfig(version, revision, coralVersion);
}

async function fetchNxapiConfig(version: string, revision: string, coralVersion: string): Promise<ConfigModule> {
  const response = await fetch(CONFIG_URL, {
    headers: {
      'User-Agent': 'nxapi/' + version + ' ' + NXAPI_USER_AGENT,
      'X-nxapi-Version': version,
      'X-nxapi-Revision': revision,
      'X-znca-Compatible-Version': coralVersion,
    },
  });
  if (!response.ok) {
    void response.body?.cancel().catch(() => {});
    throw new PresenceError('nxapi-config', 'http', response.status);
  }

  let data;
  try {
    const bytes = await readLimitedBody(response, 32 * 1024);
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new PresenceError('nxapi-config', 'invalid-response');
  }
  const helper = data?.coral_auth?.default;
  if (!Array.isArray(data?.require_version) || !Array.isArray(helper)) {
    throw new PresenceError('nxapi-config', 'invalid-response');
  }
  if (!data.require_version.includes(version) || data.coral === null) {
    throw new PresenceError('nxapi-config', 'unsupported');
  }
  if (typeof data.coral?.znca_version !== 'string' || !/^\d+\.\d+\.\d+$/.test(data.coral.znca_version)
    || helper[0] !== 'nxapi' || helper[1] !== 'https://nxapi-znca-api.fancy.org.uk/api/znca') {
    throw new PresenceError('nxapi-config', 'invalid-response');
  }
  return {
    default: {
      coral: { znca_version: data.coral.znca_version },
      coral_auth: { default: ['nxapi', helper[1]], flapg: null, imink: null },
    },
  };
}
