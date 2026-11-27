import { addUserAgent, ErrorResponse } from 'nxapi';
import CoralApi, { type CoralAuthData } from 'nxapi/coral';
import { PresenceError } from '../presence/error';
import { NXAPI_USER_AGENT, nxapiStage } from './worker-runtime';

addUserAgent(NXAPI_USER_AGENT);

export interface NintendoCredentials {
  sessionToken: string;
  clientId: string;
  clientSecret?: string;
}

interface CoralToken {
  token: string;
  nsaUserId: number;
  accountId: string;
  version: string;
  userAgent: string;
  expiresAt: number;
}

// Only cache plain credential values. Each request gets its own SDK client and I/O.
let cached: { credentials: NintendoCredentials; token: CoralToken } | undefined;
const EXPIRY_BUFFER_MS = 30_000;

class RequestCoralApi extends CoralApi {
  constructor(token: CoralToken) {
    super(token.token, NXAPI_USER_AGENT, token.nsaUserId, token.accountId, token.version, token.userAgent);
  }
}

function asCoralToken(data: CoralAuthData, requestedAt: number): CoralToken {
  const token = data.credential?.accessToken;
  const expiresIn = data.credential?.expiresIn;
  const nsaUserId = data.nsoAccount?.user?.id;
  const accountId = data.user?.id;
  if (typeof token !== 'string' || !token || !Number.isSafeInteger(expiresIn) || expiresIn <= 0
    || !Number.isSafeInteger(nsaUserId) || typeof accountId !== 'string' || !accountId) {
    throw new PresenceError('nintendo', 'invalid-response');
  }
  return {
    token, nsaUserId, accountId,
    version: data.znca_version,
    userAgent: data.znca_useragent,
    expiresAt: requestedAt + expiresIn * 1000,
  };
}

export function nintendoError(error: unknown, stage: 'nintendo-account' | 'nintendo'): PresenceError {
  if (error instanceof PresenceError) return error;
  if (error instanceof ErrorResponse) {
    const url = URL.parse(error.response.url);
    const originStage = (url && nxapiStage(url)) || stage;
    const status = error.response.status;
    const code = typeof error.data === 'object' && error.data && 'error' in error.data ? error.data.error : undefined;
    if (status === 401 || status === 403 || code === 'invalid_grant' || code === 'invalid_client') {
      return new PresenceError(originStage, 'authentication', status);
    }
    return status >= 300
      ? new PresenceError(originStage, 'http', status)
      : new PresenceError(originStage, 'invalid-response');
  }
  return new PresenceError(stage, error instanceof SyntaxError || error instanceof TypeError ? 'invalid-response' : 'request-failed');
}

export async function authenticateNintendo(credentials: NintendoCredentials, rejectedClient?: CoralApi): Promise<CoralApi> {
  if (cached && cached.credentials.sessionToken === credentials.sessionToken
    && cached.credentials.clientId === credentials.clientId && cached.credentials.clientSecret === credentials.clientSecret) {
    // Another request may have already refreshed the token rejected by this request.
    if (cached.token.expiresAt - EXPIRY_BUFFER_MS > Date.now() && cached.token.token !== rejectedClient?.token) {
      return new RequestCoralApi(cached.token);
    }
    cached = undefined;
  }

  try {
    const requestedAt = Date.now();
    const { nso, data } = await CoralApi.createWithSessionToken(credentials.sessionToken);
    cached = { credentials, token: asCoralToken(data, requestedAt) };
    return nso;
  } catch (error) {
    throw nintendoError(error, 'nintendo-account');
  }
}
