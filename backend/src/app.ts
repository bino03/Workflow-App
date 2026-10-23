import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config.js';
import { authRoutes } from './auth/auth.routes.js';
import { PasskeyStore } from './auth/passkeyStore.js';
import { SessionStore } from './auth/sessionStore.js';
import { registerAuthGuard } from './common/authGuard.js';
import { AppError, registerErrorHandler } from './common/errors.js';
import { healthRoutes } from './common/health.routes.js';
import { hasSpaBuild, registerSpa, selfOrigins } from './common/spa.js';
import { keybindingsRoutes } from './keybindings/keybindings.routes.js';
import { KeybindingsService } from './keybindings/keybindingsService.js';
import { libraryRoutes } from './library/library.routes.js';
import { MAX_SKILL_UPLOAD_BYTES, LibraryService } from './library/libraryService.js';
import { foldersRoutes } from './folders/folders.routes.js';
import { FoldersService } from './folders/foldersService.js';
import { projectsRoutes } from './projects/projects.routes.js';
import { devPortsOf } from './preview/listeningPorts.js';
import { previewRoutes } from './preview/preview.routes.js';
import { PreviewService, type PreviewServiceDeps } from './preview/previewService.js';
import { TailscaleCli } from './preview/tailscale.js';
import { ProjectsService } from './projects/projectsService.js';
import { ClaudeSessions } from './sessions/claudeSessions.js';
import { isTrustedFolder } from './sessions/claudeTrust.js';
import { sessionsRoutes } from './sessions/sessions.routes.js';
import type { StateStore } from './state/stateStore.js';
import { terminalsGateway } from './terminals/terminals.gateway.js';
import { terminalsRoutes } from './terminals/terminals.routes.js';
import { TerminalsService } from './terminals/terminalsService.js';
import { usageRoutes } from './usage/usage.routes.js';
import { readUsage, writeUsageFiles } from './usage/usageFiles.js';
import { type BotAction, BotActions } from './telegram/botActions.js';
import { MenuStore } from './telegram/menuStore.js';
import { TelegramApi } from './telegram/telegramApi.js';
import { TelegramBot } from './telegram/telegramBot.js';
import type { TerminalManager } from './terminals/terminalManager.js';

export type AppDeps = {
  config: Config;
  terminalManager: TerminalManager;
  sessionStore?: SessionStore;
  stateStore: StateStore;
  /** Default: loaded from config.dataDir (tests point DATA_DIR at a temporary folder). */
  passkeyStore?: PasskeyStore;
  logger?: boolean;
  /** Where the log goes (tests read it to prove terminal content never reaches it). Default: stdout. */
  logStream?: NodeJS.WritableStream;
  /** Previews only (ADR 0018): tests replace the Tailscale CLI and the port discovery. Default: the real ones. */
  preview?: { tailscale?: PreviewServiceDeps['tailscale']; devPorts?: PreviewServiceDeps['devPorts'] };
};

export async function buildApp({ config, terminalManager, sessionStore, stateStore, passkeyStore, logger = true, logStream, preview }: AppDeps): Promise<FastifyInstance> {
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
  // Only routes that opt in (the logins) are limited.
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => new AppError('AUTH_004'),
  });
  // A paste bigger than this is not typing; the default (100 MiB) would let one frame fill the PTY.
  await app.register(websocket, { options: { maxPayload: 1024 * 1024 } });
  // Only the skill upload takes multipart (ADR 0014); the route sets its own limits on top of these.
  await app.register(multipart, { limits: { fileSize: MAX_SKILL_UPLOAD_BYTES, files: 1, fields: 0 } });

  // A page served by this backend opens its WebSocket with the backend's own origin. Only the
  // WebSocket needs it: same-origin REST calls never depend on CORS.
  const websocketOrigins = serveSpa
    ? [...new Set([...config.corsAllowedOrigins, ...selfOrigins(config.port)])]
    : config.corsAllowedOrigins;
  registerAuthGuard(app, { sessionStore: sessions, allowedOrigins: websocketOrigins });

  await app.register(healthRoutes);
  await app.register(authRoutes, {
    config,
    sessionStore: sessions,
    passkeyStore: passkeyStore ?? (await PasskeyStore.load(config.dataDir)),
  });
  await app.register(libraryRoutes, { libraryService: new LibraryService(config.workflowPath) });
  const projectsService = new ProjectsService(config.workflowPath, config.terminals.allowedRoots);
  await app.register(projectsRoutes, { projectsService });

  const sessionsReader = new ClaudeSessions(config.terminals.claudeConfigDir);

  // Dev-server previews over `tailscale serve` (ADR 0018): only with TAILSCALE_BIN.
  const previewService = config.preview
    ? new PreviewService({
        terminals: terminalManager,
        tailscale: preview?.tailscale ?? new TailscaleCli(config.preview.tailscaleBin),
        devPorts: preview?.devPorts ?? ((pid) => devPortsOf(pid, { exclude: [config.port] })),
        httpsPorts: config.preview.httpsPorts,
        log: app.log.child({ module: 'preview' }),
      })
    : undefined;
  if (previewService) {
    // `serve --bg` outlives the backend: a crash leaves ports served — turn them off before anything else.
    app.addHook('onReady', async () => void (await previewService.cleanupOwnPorts()));
    app.addHook('onClose', async () => previewService.shutdown());
  }

  const terminalsService = new TerminalsService({
    stateStore,
    terminalManager,
    sessions: sessionsReader,
    allowedRoots: config.terminals.allowedRoots,
    // Every claude gets the status line that keeps the quota in DATA_DIR/usage.json (ADR 0012).
    settingsPath: writeUsageFiles(config.dataDir),
    isTrustedFolder: (cwd) => isTrustedFolder(cwd, config.terminals.claudeConfigDir),
    previews: previewService,
  });
  await app.register(terminalsRoutes, { terminalsService });
  await app.register(previewRoutes, { terminalsService, previewService });
  await app.register(terminalsGateway, { terminalManager, sessionStore: sessions });
  await app.register(usageRoutes, { dataDir: config.dataDir });
  await app.register(sessionsRoutes, { sessions: sessionsReader, stateStore, terminalsService, allowedRoots: config.terminals.allowedRoots });
  await app.register(foldersRoutes, {
    foldersService: new FoldersService({ stateStore, sessions: sessionsReader, allowedRoots: config.terminals.allowedRoots }),
  });
  await app.register(keybindingsRoutes, { keybindingsService: new KeybindingsService(stateStore) });

  // The Telegram bot (ADR 0017): only with TELEGRAM_BOT_TOKEN, a client of the same services as the routes.
  if (config.telegram) {
    const menus = new MenuStore<BotAction>();
    const bot = new TelegramBot({
      api: new TelegramApi(config.telegram.botToken),
      allowedUserId: config.telegram.allowedUserId,
      menus,
      actions: new BotActions({
        projects: projectsService,
        sessions: sessionsReader,
        terminals: terminalsService,
        readUsage: () => readUsage(config.dataDir),
        menus,
      }),
      log: app.log.child({ module: 'telegram' }),
    });
    app.addHook('onReady', async () => bot.start());
    app.addHook('onClose', async () => bot.stop());
  }

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
