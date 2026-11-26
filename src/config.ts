export interface Bindings extends Omit<Env, 'NXAPI_PRESENCE_URL'> {
  NXAPI_PRESENCE_URL?: string;
}

export const CACHE_SECONDS = 90;
export const PRESENCE_TIMEOUT_MS = 4000;
export const IMAGE_TIMEOUT_MS = 2500;
