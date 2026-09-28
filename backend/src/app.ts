import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config.js';
import { authRoutes } from './auth/auth.routes.js';
import { SessionStore } from './auth/sessionStore.js';
import { registerAuthGuard } from './common/authGuard.js';
import { AppError, registerErrorHandler } from './common/errors.js';
import { healthRoutes } from './common/health.routes.js';
import { hasSpaBuild, registerSpa, selfOrigins } from './common/spa.js';
import { libraryRoutes } from './library/library.routes.js';
import { LibraryService } from './library/libraryService.js';
import { ClaudeSessions } from './sessions/claudeSessions.js';
import type { StateStore } from './state/stateStore.js';
import { terminalsGateway } from './terminals/terminals.gateway.js';
import { terminalsRoutes } from './terminals/terminals.routes.js';
import { TerminalsService } from './terminals/terminalsService.js';
import type { TerminalManager } from './terminals/terminalManager.js';

export type AppDeps = {
  config: Config;
  terminalManager: TerminalManager;
  sessionStore?: SessionStore;
  stateStore: StateStore;
  logger?: boolean;
  /** Where the log goes (tests read it to prove terminal content never reaches it). Default: stdout. */
  logStream?: NodeJS.WritableStream;
};

export async function buildApp({ config, terminalManager, sessionStore, stateStore, logger = true, logStream }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: logger && {
      level: config.logLevel,
      redact: ['req.headers.cookie', 'req.headers.authorization'],
      ...(logStream ? { stream: logStream } : {}),
    },
  });

  const sessions =
    sessionStore ?? new SessionStore({ idleMs: config.auth.sessionIdleMs, maxMs: config.auth.sessionMaxMs });

  stateStore.logger = app.log;

  const serveSpa = hasSpaBuild(config.frontendDist);
  registerErrorHandler(app, { spaFallback: serveSpa });

  await app.register(cors, {
    origin: config.corsAllowedOrigins,
    credentials: true,
  });
  await app.register(cookie, { secret: config.auth.sessionSecret });
  // Only routes that opt in (the login) are limited.
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => new AppError('AUTH_004'),
  });
  // A paste bigger than this is not typing; the default (100 MiB) would let one frame fill the PTY.
  await app.register(websocket, { options: { maxPayload: 1024 * 1024 } });

  // A page served by this backend opens its WebSocket with the backend's own origin. Only the
  // WebSocket needs it: same-origin REST calls never depend on CORS.
  const websocketOrigins = serveSpa
    ? [...new Set([...config.corsAllowedOrigins, ...selfOrigins(config.port)])]
    : config.corsAllowedOrigins;
  registerAuthGuard(app, { sessionStore: sessions, allowedOrigins: websocketOrigins });

  await app.register(healthRoutes);
  await app.register(authRoutes, { config, sessionStore: sessions });
  await app.register(libraryRoutes, { libraryService: new LibraryService(config.workflowPath) });

  const sessionsReader = new ClaudeSessions(config.terminals.claudeConfigDir);
  const terminalsService = new TerminalsService({
    stateStore,
    terminalManager,
    sessions: sessionsReader,
    allowedRoots: config.terminals.allowedRoots,
  });
  await app.register(terminalsRoutes, { terminalsService });
  await app.register(terminalsGateway, { terminalManager, sessionStore: sessions });

  if (serveSpa) {
    await registerSpa(app, config.frontendDist);
  } else {
    app.log.warn({ frontendDist: config.frontendDist }, 'no frontend build found — serving the API only');
  }

  app.addHook('onClose', async () => {
    sessions.close();
    await terminalManager.killAll();
    await stateStore.flush();
  });

  return app;
}
