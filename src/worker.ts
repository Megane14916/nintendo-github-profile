import type { Bindings } from './config';
import app from './index';
import { refreshPresence } from './jobs/refresh-presence';
import { PresenceError } from './presence/error';

// KV metadata covers already-finished runs. This guard covers overlap in the same isolate.
let refreshInProgress = false;

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },

  async scheduled(controller, env) {
    controller.noRetry();
    if (refreshInProgress) return;
    refreshInProgress = true;

    try {
      await refreshPresence(env, controller.scheduledTime);
    } catch (failure) {
      const safe = failure instanceof PresenceError ? failure : new PresenceError('storage', 'request-failed');
      console.error('presence_refresh_failed', { stage: safe.stage, code: safe.code, status: safe.status });
      throw new Error('Presence refresh failed');
    } finally {
      refreshInProgress = false;
    }
  },
} satisfies ExportedHandler<Bindings>;
