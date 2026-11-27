export const nsaId = '0123456789abcdef';
export const nintendoEnv = {
  PRESENCE_SOURCE: 'self',
  MAIN_NSA_ID: nsaId,
  NINTENDO_SESSION_TOKEN: 'test-session-token',
  NXAPI_AUTH_CLIENT_ID: 'test-client-id',
  NXAPI_AUTH_CLIENT_SECRET: 'test-client-secret',
};

export function mockNintendo(ResponseClass = Response) {
  const calls = [];
  let decryptedResponse;
  const upstream = {
    calls,
    presence: { state: 'ONLINE', game: { name: 'Coral Test Game', totalPlayTime: 145 } },
    avatarUrl: undefined,
    error: undefined,
    expired: false,
    async fetch(request) {
      const { pathname } = new URL(request.url);
      calls.push(pathname);
      const json = (data, status) => ResponseClass.json(data, { status });
      const coralResponse = (data) => {
        decryptedResponse = data;
        return new ResponseClass('encrypted', { headers: { 'Content-Type': 'application/json' } });
      };
      if (upstream.error?.path === pathname) return json(upstream.error.body, upstream.error.status);

      switch (pathname) {
        case '/api/nxapi/config':
          if (request.headers.get('X-znca-Compatible-Version') !== '3.5.0') throw new Error('Missing Coral compatibility');
          return json({
            require_version: ['1.6.1'],
            coral: { znca_version: '3.6.0' },
            coral_auth: { default: ['nxapi', 'https://nxapi-znca-api.fancy.org.uk/api/znca'] },
          });
        case '/connect/1.0.0/api/token':
          if (!(await request.json()).session_token.startsWith(nintendoEnv.NINTENDO_SESSION_TOKEN)) throw new Error('Missing Nintendo token');
          return json({ id_token: 'test-id-token', access_token: 'test-nintendo-access-token' });
        case '/2.0.0/users/me':
          return json({ id: 'test-account', language: 'ja-JP' });
        case '/.well-known/oauth-protected-resource':
          return json({ authorization_servers: ['https://nxapi-auth.fancy.org.uk'] });
        case '/.well-known/oauth-authorization-server':
          return json({ issuer: 'https://nxapi-auth.fancy.org.uk', token_endpoint: 'https://nxapi-auth.fancy.org.uk/api/oauth/token' });
        case '/api/oauth/token': {
          const form = new URLSearchParams(await request.text());
          if (form.get('client_id') !== nintendoEnv.NXAPI_AUTH_CLIENT_ID
            || form.get('client_secret') !== nintendoEnv.NXAPI_AUTH_CLIENT_SECRET
            || form.get('scope') !== 'ca:gf ca:er ca:dr') throw new Error('Missing OAuth credentials');
          return json({ access_token: 'test-helper-access-token', expires_in: 3600 });
        }
        case '/api/znca/f':
          return json({ encrypted_token_request: 'ZGF0YQ==' });
        case '/v4/Account/Login':
          return coralResponse({ status: 0, result: {
            user: { id: 123 },
            webApiServerCredential: { accessToken: 'test-coral-access-token', expiresIn: 7200 },
          } });
        case '/api/znca/encrypt-request': {
          const input = await request.json();
          if (JSON.parse(input.data).parameter.nsaId !== nsaId) throw new Error('Wrong friend');
          return json({ data: 'ZGF0YQ' });
        }
        case '/v4/Friend/Show':
          if (upstream.expired) {
            upstream.expired = false;
            return coralResponse({ status: 9404, errorMessage: 'expired test-coral-access-token' });
          }
          return coralResponse({ status: 0, result: {
            nsaId, name: 'Coral Player', image2Uri: upstream.avatarUrl, presence: upstream.presence,
          } });
        case '/api/znca/decrypt-response':
          return new ResponseClass(JSON.stringify(decryptedResponse));
        default:
          throw new Error('Unexpected upstream request');
      }
    },
  };
  return upstream;
}
