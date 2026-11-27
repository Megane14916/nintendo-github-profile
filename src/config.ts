export interface Bindings extends Partial<Pick<Env, 'PREVIEW_STATUS' | 'PRESENCE_SOURCE' | 'PRESENCE_KV'>> {
  MAIN_NSA_ID?: string;
  NXAPI_AUTH_CLIENT_ID?: string;
  NXAPI_PRESENCE_URL?: string;
  NINTENDO_SESSION_TOKEN?: string;
  NXAPI_AUTH_CLIENT_SECRET?: string;
}

export const CACHE_SECONDS = 90;
export const PRESENCE_TIMEOUT_MS = 4000;
export const IMAGE_TIMEOUT_MS = 2500;
