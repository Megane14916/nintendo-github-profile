export class PresenceError extends Error {
  constructor(
    readonly stage: 'configuration' | 'nxapi-auth' | 'nxapi-config' | 'nintendo-account' | 'nintendo' | 'presence' | 'storage',
    readonly code: 'missing-setting' | 'invalid-setting' | 'unsupported' | 'request-failed'
      | 'authentication' | 'http' | 'invalid-response' | 'friend-not-found',
    readonly status?: number,
  ) {
    super(stage + ': ' + code);
  }
}
