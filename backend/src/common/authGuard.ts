import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Session, SessionStore } from '../auth/sessionStore.js';
import { AppError } from './errors.js';

export const SESSION_COOKIE = 'session';

declare module 'fastify' {
  interface FastifyRequest {
    session: Session | null;
  }
  interface FastifyContextConfig {
    /** Marks a route as reachable without a session. Everything else requires one. */
    public?: boolean;
  }
}

export type AuthGuardOptions = {
  sessionStore: SessionStore;
  allowedOrigins: string[];
};

/** Reads the signed session cookie and returns the live session, if any. */
export function sessionFromRequest(request: FastifyRequest, sessionStore: SessionStore): Session | undefined {
  const raw = request.cookies[SESSION_COOKIE];
  if (!raw) return undefined;
  const unsigned = request.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value) return undefined;
  return sessionStore.touch(unsigned.value);
}

/**
 * The single auth guard, for REST routes and the WebSocket upgrade alike. Runs on every request
 * (unknown routes included): a route is only public if it says so with `config: { public: true }`.
 * On a WebSocket upgrade it also checks `Origin` — cookies go with cross-site requests too.
 */
export function registerAuthGuard(app: FastifyInstance, { sessionStore, allowedOrigins }: AuthGuardOptions): void {
  app.decorateRequest('session', null);

  app.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    if (request.ws) {
      const origin = request.headers.origin;
      if (!origin || !allowedOrigins.includes(origin)) throw new AppError('AUTH_003');
    }
    if (request.routeOptions.config?.public) return;

    const session = sessionFromRequest(request, sessionStore);
    if (!session) throw new AppError('AUTH_002');
    request.session = session;
  });
}
