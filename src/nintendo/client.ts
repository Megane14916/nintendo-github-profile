import { CoralErrorResponse, CoralStatus, type Friend_4 } from 'nxapi/coral';
import { PresenceError } from '../presence/error';
import { authenticateNintendo, nintendoError, type NintendoCredentials } from './auth';
import { withNxapiRequest } from './worker-runtime';

function isExpiredToken(error: unknown): boolean {
  // nxapi's ErrorResponse custom instanceof also matches its sibling subclasses.
  return error instanceof CoralErrorResponse && CoralErrorResponse.prototype.isPrototypeOf(error)
    && (error.status === CoralStatus.TOKEN_EXPIRED || error.response.status === 401);
}

export function getNintendoFriend(credentials: NintendoCredentials, nsaId: string): Promise<Friend_4> {
  return withNxapiRequest(credentials.clientId, credentials.clientSecret, async () => {
    try {
      let client = await authenticateNintendo(credentials);
      const friend = await client.getFriend(nsaId).catch(async (error: unknown) => {
        if (!isExpiredToken(error)) throw error;
        client = await authenticateNintendo(credentials, client);
        return client.getFriend(nsaId);
      });
      if (typeof friend?.nsaId !== 'string') throw new PresenceError('nintendo', 'invalid-response');
      if (friend.nsaId.toLowerCase() !== nsaId) throw new PresenceError('nintendo', 'friend-not-found');
      return friend;
    } catch (error) {
      if (isExpiredToken(error)) throw new PresenceError('nintendo', 'authentication');
      throw nintendoError(error, 'nintendo');
    }
  });
}
