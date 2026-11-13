import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import { fileURLToPath } from 'node:url';
import { appRunRoutes } from './appRuns/appRun.routes.js';
import { AppRunService, type AppRunServiceDeps } from './appRuns/appRunService.js';
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
import { LibraryService } from './library/libraryService.js';
import { foldersRoutes } from './folders/folders.routes.js';
import { FoldersService } from './folders/foldersService.js';
import { creationRoutes } from './creation/creation.routes.js';
import { CreationService } from './creation/creationService.js';
import { guidedRoutes } from './guided/guided.routes.js';
import { writeGuidedFiles } from './guided/guidedFiles.js';
import { GuidedService } from './guided/guidedService.js';
import { writeImportFiles } from './imports/importFiles.js';
import { importsRoutes } from './imports/imports.routes.js';
import { MAX_IMPORT_FILES } from './imports/imports.schemas.js';
import { ImportService } from './imports/importService.js';
import { MAX_IMPORT_BYTES } from './imports/stagingFiles.js';
import { WorkflowGit } from './imports/workflowGit.js';
import { projectsRoutes } from './projects/projects.routes.js';
import { devPortsOf } from './preview/listeningPorts.js';
import { previewRoutes } from './preview/preview.routes.js';
import { type PreviewNotifier, PreviewService, type PreviewServiceDeps } from './preview/previewService.js';
import { TailscaleCli } from './preview/tailscale.js';
import { ProjectsService } from './projects/projectsService.js';
import { ClaudeSessions } from './sessions/claudeSessions.js';
import { isTrustedFolder } from './sessions/claudeTrust.js';
import { projectInfoRoutes } from './projectInfo/projectInfo.routes.js';
import { ProjectInfoService } from './projectInfo/projectInfoService.js';
import { AccountDirs } from './accounts/accountDirs.js';
import { accountsRoutes } from './accounts/accounts.routes.js';
import { AccountsService } from './accounts/accountsService.js';
import { sessionsRoutes } from './sessions/sessions.routes.js';
import type { StateStore } from './state/stateStore.js';
import { terminalsGateway } from './terminals/terminals.gateway.js';
import { terminalsRoutes } from './terminals/terminals.routes.js';
import { TerminalsService } from './terminals/terminalsService.js';
import { upworkRoutes } from './upwork/upwork.routes.js';
import { UpworkService } from './upwork/upworkService.js';
import { usageRoutes } from './usage/usage.routes.js';
import { readUsage, writeUsageFiles } from './usage/usageFiles.js';
import { type BotAction, BotActions } from './telegram/botActions.js';
import { MenuStore } from './telegram/menuStore.js';
import { type InlineKeyboard, TelegramApi } from './telegram/telegramApi.js';
import { TelegramBot, type TelegramBotDeps } from './telegram/telegramBot.js';
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
  /** App runs only (ADR 0030): tests replace the port discovery, the app's own folder and the skills check. */
  appRuns?: Partial<Pick<AppRunServiceDeps, 'devPorts' | 'selfPath' | 'hasRunAndStop'>>;
  /** Tests only: a fake Telegram API (the bot's long polling and the preview notices go through it). */
  telegramApi?: TelegramBotDeps['api'];
  /** Preparar anexos (ADR 0025): shows a folder to the owner. Default: none — tests never open a window. */
  openFolder?: (folder: string) => boolean;
};

export async function buildApp({
  config,
  terminalManager,
  sessionStore,
  stateStore,
  passkeyStore,
  logger = true,
  logStream,
  preview,
  appRuns,
  telegramApi,
  openFolder,
}: AppDeps): Promise<FastifyInstance> {
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
  // Only the imports take multipart (ADR 0019); each route sets its own limits on top of these.
  await app.register(multipart, {
    limits: { fileSize: MAX_IMPORT_BYTES, files: MAX_IMPORT_FILES, fields: 1, fieldSize: 64 * 1024 },
  });

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
  await app.register(projectInfoRoutes, { projectInfoService: new ProjectInfoService({ stateStore, projects: projectsService }) });

  const sessionsReader = new ClaudeSessions(config.terminals.claudeConfigDir);

  // Dev-server previews over `tailscale serve` (ADR 0018): only with TAILSCALE_BIN. The bot, built further down,
  // fills in who hears about a link starting or stopping.
  let previewNotifier: PreviewNotifier | undefined;
  const previewService = config.preview
    ? new PreviewService({
        terminals: terminalManager,
        tailscale: preview?.tailscale ?? new TailscaleCli(config.preview.tailscaleBin),
        devPorts: preview?.devPorts ?? ((pid) => devPortsOf(pid, { exclude: [config.port] })),
        httpsPorts: config.preview.httpsPorts,
        notifier: {
          started: (...args) => previewNotifier?.started(...args),
          stopped: (...args) => previewNotifier?.stopped(...args),
        },
        log: app.log.child({ module: 'preview' }),
      })
    : undefined;
  if (previewService) {
    // `serve --bg` outlives the backend: a crash leaves ports served — turn them off before anything else.
    app.addHook('onReady', async () => void (await previewService.cleanupOwnPorts()));
    app.addHook('onClose', async () => previewService.shutdown());
  }

  // The accounts and the terminals need each other: the terminals reach the accounts directly, the accounts reach
  // the terminals through a function (only called after both exist).
  const accountsService = new AccountsService({
    stateStore,
    dirs: AccountDirs.fromConfig(config),
    dataDir: config.dataDir,
    defaultCwd: config.terminals.defaultCwd,
    terminals: () => terminalsService,
  });
  const terminalsService: TerminalsService = new TerminalsService({
    stateStore,
    terminalManager,
    sessions: sessionsReader,
    allowedRoots: config.terminals.allowedRoots,
    // Every claude gets the status line that keeps the quota in DATA_DIR/usage.json (ADR 0012).
    settingsPath: writeUsageFiles(config.dataDir),
    // An import's hidden terminal: the same status line plus the hooks it is followed by (ADR 0019).
    importSettingsPath: writeImportFiles(config.dataDir),
    // A guided session's hidden terminal: the status line, blocking hooks and two narrow permissions (ADR 0020);
    // the hook also allows alone in auto mode or inside a new declared destination, never in the Workflow (ADR 0021).
    guidedSettingsPath: writeGuidedFiles(config.dataDir, config.terminals.allowedRoots, config.workflowPath),
    // The trust is per account: an extra one reads its own .claude.json (ADR 0027).
    isTrustedFolder: (cwd, configDir) => isTrustedFolder(cwd, configDir ?? config.terminals.claudeConfigDir),
    accounts: accountsService,
    previews: previewService,
  });
  // An app run's terminal died with the previous backend, and its app with it (ADR 0030 point 8).
  terminalsService.dropAppRuns();
  await app.register(terminalsRoutes, { terminalsService });
  await app.register(accountsRoutes, { accountsService });
  await app.register(importsRoutes, {
    importService: new ImportService({
      dataDir: config.dataDir,
      workflowPath: config.workflowPath,
      allowedRoots: config.terminals.allowedRoots,
      terminals: terminalsService,
      git: new WorkflowGit({ gitBin: config.gitBin, repo: config.workflowPath }),
    }),
  });
  const guidedService = new GuidedService({ dataDir: config.dataDir, terminals: terminalsService, sessions: sessionsReader });
  await app.register(guidedRoutes, { guidedService });
  const creationService = new CreationService({ guided: guidedService, terminals: terminalsService, workflowPath: config.workflowPath });
  await app.register(creationRoutes, { creationService });
  await app.register(upworkRoutes, {
    upworkService: new UpworkService({
      dataDir: config.dataDir,
      workflowPath: config.workflowPath,
      portfolioPath: config.portfolioPath,
      openFolder,
      guided: guidedService,
      creation: creationService,
    }),
  });
  await app.register(previewRoutes, { terminalsService, previewService });
  // Correr / Parar a project's app (ADR 0030): a hidden terminal with /run; never the Workflow App itself.
  const appRunService = new AppRunService({
    terminals: terminalsService,
    pidOf: (id) => terminalManager.get(id)?.pid,
    devPorts: appRuns?.devPorts ?? ((pid) => devPortsOf(pid, { exclude: [config.port] })),
    allowedRoots: config.terminals.allowedRoots,
    // backend/src/app.ts and backend/dist/app.js are both two levels below the repository root.
    selfPath: appRuns?.selfPath ?? fileURLToPath(new URL('../..', import.meta.url)),
    hasRunAndStop: appRuns?.hasRunAndStop,
    log: app.log.child({ module: 'app-runs' }),
  });
  await app.register(appRunRoutes, { appRunService });
  await app.register(terminalsGateway, { terminalManager, sessionStore: sessions });
  await app.register(usageRoutes, { dataDir: config.dataDir, activeAccountId: () => accountsService.activeAccountId() });
  await app.register(sessionsRoutes, { sessions: sessionsReader, stateStore, terminalsService, allowedRoots: config.terminals.allowedRoots });
  await app.register(foldersRoutes, {
    foldersService: new FoldersService({ stateStore, sessions: sessionsReader, allowedRoots: config.terminals.allowedRoots }),
  });
  await app.register(keybindingsRoutes, { keybindingsService: new KeybindingsService(stateStore) });

  // The Telegram bot (ADR 0017): only with TELEGRAM_BOT_TOKEN, a client of the same services as the routes.
  if (config.telegram) {
    const menus = new MenuStore<BotAction>();
    const api = telegramApi ?? new TelegramApi(config.telegram.botToken);
    const allowedUserId = config.telegram.allowedUserId;
    const log = app.log.child({ module: 'telegram' });
    const actions = new BotActions({
      projects: projectsService,
      sessions: sessionsReader,
      terminals: terminalsService,
      readUsage: () => readUsage(config.dataDir),
      previews: previewService,
      menus,
    });
    // A private chat's id is the user's id: the only place the bot writes without being asked (ADR 0018 point 5).
    const notify = ({ text, keyboard }: { text: string; keyboard?: InlineKeyboard }) =>
      void api.sendMessage(allowedUserId, text, keyboard).catch((error: unknown) => log.warn({ err: String(error) }, 'telegram: preview notice failed'));
    previewNotifier = {
      started: (terminalId, started) => notify(actions.previewStarted(terminalId, started)),
      stopped: (terminalId, stopped, reason) => notify(actions.previewStopped(terminalId, stopped, reason)),
    };
    const bot = new TelegramBot({ api, allowedUserId, menus, actions, log });
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
