import type { CookieSerializeOptions } from '@fastify/cookie';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../config.js';
import { SESSION_COOKIE, sessionFromRequest } from '../common/authGuard.js';
import { AppError } from '../common/errors.js';
import { parseWith } from '../common/validation.js';
import { loginSchema } from './auth.schemas.js';
import { verifyCredentials } from './authService.js';
import { ChallengeStore } from './challengeStore.js';
import { passkeyRoutes } from './passkey.routes.js';
import type { PasskeyStore } from './passkeyStore.js';
import type { SessionStore } from './sessionStore.js';

export const LOGIN_RATE_LIMIT = { max: 5, timeWindow: '1 minute' } as const;

export type AuthRoutesOptions = {
  config: Config;
  sessionStore: SessionStore;
  passkeyStore: PasskeyStore;
  challenges?: ChallengeStore;
};

/** Opens a session and sets its cookie — the same for the password and a passkey. */
export type StartSession = (request: FastifyRequest, reply: FastifyReply, passkeyId?: string) => FastifyReply;

export async function authRoutes(
  app: FastifyInstance,
  { config, sessionStore, passkeyStore, challenges = new ChallengeStore() }: AuthRoutesOptions,
): Promise<void> {
  // Same attributes to set and to clear, or the browser keeps the cookie.
  const cookieOptions: CookieSerializeOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: config.auth.cookieSecure,
    signed: true,
  };

  // One counter for everything that proves identity: the password login, the passkey login and the
  // password asked before registering a passkey (ADR 0015). A per-route limit would give each its own.
  const identityAttempts = app.rateLimit(LOGIN_RATE_LIMIT);

  const startSession: StartSession = (request, reply, passkeyId) => {
    // A fresh id on every login; an old session carried by this browser ends here.
    const previous = sessionFromRequest(request, sessionStore);
    if (previous) sessionStore.destroy(previous.id);

    const session = sessionStore.create({ passkeyId: passkeyId ?? null });
    request.log.info({ method: passkeyId ? 'passkey' : 'password' }, 'login');
    return reply
      .setCookie(SESSION_COOKIE, session.id, { ...cookieOptions, maxAge: Math.floor(config.auth.sessionMaxMs / 1000) })
      .status(204)
      .send();
  };

  app.post('/api/auth/login', { config: { public: true }, onRequest: identityAttempts }, async (request, reply) => {
    const credentials = parseWith(loginSchema, request.body);
    // Wrong username or wrong password: the same AUTH_001, never saying which (ADR 0011).
    if (!(await verifyCredentials(config.auth, credentials))) {
      throw new AppError('AUTH_001');
    }
    return startSession(request, reply);
  });

  app.post('/api/auth/logout', async (request, reply) => {
    if (request.session) sessionStore.destroy(request.session.id);
    request.log.info('logout');
    return reply.clearCookie(SESSION_COOKIE, cookieOptions).status(204).send();
  });

  app.get('/api/auth/me', async () => ({ authenticated: true }));

  await passkeyRoutes(app, { config, sessionStore, passkeyStore, challenges, identityAttempts, startSession });
}
