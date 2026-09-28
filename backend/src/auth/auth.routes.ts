import type { CookieSerializeOptions } from '@fastify/cookie';
import type { FastifyInstance } from 'fastify';
import type { Config } from '../config.js';
import { SESSION_COOKIE, sessionFromRequest } from '../common/authGuard.js';
import { AppError } from '../common/errors.js';
import { parseWith } from '../common/validation.js';
import { loginSchema } from './auth.schemas.js';
import { verifyPassword } from './authService.js';
import type { SessionStore } from './sessionStore.js';

export const LOGIN_RATE_LIMIT = { max: 5, timeWindow: '1 minute' } as const;

export type AuthRoutesOptions = {
  config: Config;
  sessionStore: SessionStore;
};

export async function authRoutes(app: FastifyInstance, { config, sessionStore }: AuthRoutesOptions): Promise<void> {
  // Same attributes to set and to clear, or the browser keeps the cookie.
  const cookieOptions: CookieSerializeOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: config.auth.cookieSecure,
    signed: true,
  };

  app.post(
    '/api/auth/login',
    { config: { public: true, rateLimit: LOGIN_RATE_LIMIT } },
    async (request, reply) => {
      const { password } = parseWith(loginSchema, request.body);
      if (!(await verifyPassword(config.auth.passwordHash, password))) {
        throw new AppError('AUTH_001');
      }
      // A fresh id on every login; an old session carried by this browser ends here.
      const previous = sessionFromRequest(request, sessionStore);
      if (previous) sessionStore.destroy(previous.id);

      const session = sessionStore.create();
      request.log.info('login');
      return reply
        .setCookie(SESSION_COOKIE, session.id, { ...cookieOptions, maxAge: Math.floor(config.auth.sessionMaxMs / 1000) })
        .status(204)
        .send();
    },
  );

  app.post('/api/auth/logout', async (request, reply) => {
    if (request.session) sessionStore.destroy(request.session.id);
    request.log.info('logout');
    return reply.clearCookie(SESSION_COOKIE, cookieOptions).status(204).send();
  });

  app.get('/api/auth/me', async () => ({ authenticated: true }));
}
