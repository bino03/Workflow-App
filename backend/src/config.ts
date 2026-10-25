import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const splitList = (separator: string) => (value: string) =>
  value
    .split(separator)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const existingDirectory = z
  .string()
  .refine((path) => isAbsolute(path), 'must be an absolute path')
  .refine((path) => existsSync(path), 'path does not exist')
  .transform((path) => realpathSync(path));

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value && value.trim().length > 0 ? value.trim() : undefined));

const envSchema = z.object({
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(7400),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  APP_USERNAME: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/, 'only letters, digits, dot, underscore and hyphen'),
  APP_PASSWORD_HASH: z.string().startsWith('$argon2id$', 'must be an argon2id hash (npm run hash-password)'),
  SESSION_SECRET: z.string().min(64, 'must have at least 64 characters'),
  SESSION_IDLE_HOURS: z.coerce.number().positive().default(12),
  SESSION_MAX_DAYS: z.coerce.number().positive().default(7),
  COOKIE_SECURE: booleanString,
  CORS_ALLOWED_ORIGINS: z
    .string()
    .transform(splitList(','))
    .pipe(z.array(z.url()).min(1, 'at least one origin is required')),

  // Passkeys (ADR 0015). The rpID is a host name, never an IP: changing it invalidates every passkey.
  WEBAUTHN_RP_ID: z
    .string()
    .trim()
    .toLowerCase()
    .default('localhost')
    .refine((host) => /^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(host) && !/^[0-9.]+$/.test(host), 'must be a host name, not an IP'),
  WEBAUTHN_RP_NAME: z.string().trim().min(1).max(64).default('Workflow App'),
  WEBAUTHN_ORIGINS: z
    .string()
    .optional()
    .transform((value) => splitList(',')(value ?? ''))
    .pipe(z.array(z.url())),

  CLAUDE_BIN: z.string().trim().min(1).default('claude'),
  ALLOWED_ROOTS: z
    .string()
    .transform(splitList(';'))
    .pipe(z.array(existingDirectory).min(1, 'at least one root is required')),
  DEFAULT_CWD: optionalString,
  // Empty means "not set" (~/.claude). Relative is refused: the child would resolve it against its cwd.
  CLAUDE_CONFIG_DIR: optionalString.refine((path) => path === undefined || isAbsolute(path), 'must be an absolute path'),
  MAX_TERMINALS: z.coerce.number().int().min(1).max(64).default(8),
  SCROLLBACK_BYTES: z.coerce.number().int().min(1024).default(1_048_576),

  WORKFLOW_PATH: existingDirectory,

  DATA_DIR: optionalString.refine((path) => path === undefined || isAbsolute(path), 'must be an absolute path'),

  FRONTEND_DIST: optionalString.refine((path) => path === undefined || isAbsolute(path), 'must be an absolute path'),

  // Telegram bot (ADR 0017). Optional: no token → no bot. The token never reaches `claude` (spawnClaude denylist).
  TELEGRAM_BOT_TOKEN: optionalString.refine(
    (token) => token === undefined || /^\d+:[A-Za-z0-9_-]{30,}$/.test(token),
    'must look like a BotFather token (<digits>:<secret>)',
  ),
  TELEGRAM_ALLOWED_USER_ID: optionalString.refine(
    (id) => id === undefined || /^[1-9]\d{0,15}$/.test(id),
    'must be a positive Telegram user id',
  ),

  // Dev-server previews over `tailscale serve` (ADR 0018). Optional: no binary → no previews.
  TAILSCALE_BIN: optionalString,
  // The git that reviews an import in the Workflow repo (ADR 0019): only fixed arguments, cwd = WORKFLOW_PATH.
  GIT_BIN: z.string().trim().min(1).default('git'),
  PREVIEW_HTTPS_PORTS: z
    .string()
    .default('8443-8446')
    .transform((value, ctx) => {
      const ports = parsePortList(value);
      if (typeof ports === 'string') {
        ctx.addIssue({ code: 'custom', message: ports });
        return z.NEVER;
      }
      return ports;
    }),
});

const MAX_PREVIEW_PORTS = 32;

/** "8443-8446,9443" → [8443, 8444, 8445, 8446, 9443]. A string is the error. */
function parsePortList(value: string): number[] | string {
  const ports = new Set<number>();
  for (const part of splitList(',')(value)) {
    const match = /^(\d{1,5})(?:-(\d{1,5}))?$/.exec(part);
    if (!match) return `"${part}" is not a port nor a range`;
    const from = Number(match[1]);
    const to = Number(match[2] ?? match[1]);
    if (from < 1 || to > 65535 || from > to) return `"${part}" is outside 1-65535 or reversed`;
    for (let port = from; port <= to; port++) ports.add(port);
    if (ports.size > MAX_PREVIEW_PORTS) return `at most ${MAX_PREVIEW_PORTS} ports`;
  }
  return ports.size > 0 ? [...ports] : 'at least one port is required';
}

type Env = z.infer<typeof envSchema>;

export type Config = {
  host: string;
  port: number;
  logLevel: Env['LOG_LEVEL'];
  auth: {
    username: string;
    passwordHash: string;
    sessionSecret: string;
    sessionIdleMs: number;
    sessionMaxMs: number;
    cookieSecure: boolean;
  };
  corsAllowedOrigins: string[];
  webauthn: {
    rpId: string;
    rpName: string;
    /** Page origins a passkey ceremony may come from; each one is the rpId or a subdomain of it. */
    origins: string[];
  };
  terminals: {
    claudeBin: string;
    allowedRoots: string[];
    defaultCwd: string;
    claudeConfigDir: string | undefined;
    maxTerminals: number;
    scrollbackBytes: number;
  };
  workflowPath: string;
  /** git for the imports' review (ADR 0019): status/diff/add/commit/checkout in WORKFLOW_PATH, nothing else. */
  gitBin: string;
  /** Where state.json lives (ADR 0009); created at startup if missing. */
  dataDir: string;
  /** Absolute path of the built SPA; served only if it has an index.html. */
  frontendDist: string;
  /** The Telegram bot (ADR 0017); undefined = no TELEGRAM_BOT_TOKEN, the bot does not start. */
  telegram: { botToken: string; allowedUserId: number } | undefined;
  /** Dev-server previews (ADR 0018); undefined = no TAILSCALE_BIN, previews are off. */
  preview: { tailscaleBin: string; httpsPorts: number[] } | undefined;
};

export class ConfigError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid environment:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

const HOUR_MS = 60 * 60 * 1000;

function belongsToRpId(origin: string, rpId: string): boolean {
  const { hostname } = new URL(origin);
  return hostname === rpId || hostname.endsWith(`.${rpId}`);
}

/**
 * Explicit WEBAUTHN_ORIGINS must all belong to the rpID. Without it: the CORS origins plus the
 * backend's own localhost origin, keeping those under the rpID (127.0.0.1 never is). A string is the error.
 */
function webauthnOrigins(e: Env, corsOrigins: string[]): string[] | string {
  const explicit = e.WEBAUTHN_ORIGINS.map((origin) => new URL(origin).origin);
  if (explicit.length > 0) {
    const foreign = explicit.filter((origin) => !belongsToRpId(origin, e.WEBAUTHN_RP_ID));
    return foreign.length > 0 ? `WEBAUTHN_ORIGINS: ${foreign.join(', ')} not under WEBAUTHN_RP_ID` : explicit;
  }
  const derived = [...new Set([...corsOrigins, `http://localhost:${e.PORT}`])].filter((origin) =>
    belongsToRpId(origin, e.WEBAUTHN_RP_ID),
  );
  return derived.length > 0 ? derived : 'WEBAUTHN_ORIGINS: no origin is under WEBAUTHN_RP_ID; set it explicitly';
}

// Same relative path from src/ (tsx) and dist/ (node).
const DEFAULT_FRONTEND_DIST = fileURLToPath(new URL('../../frontend/dist', import.meta.url));

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    // Only names and reasons — never the values, which may be secrets.
    throw new ConfigError(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
  }
  const e = parsed.data;
  const [firstRoot] = e.ALLOWED_ROOTS as [string, ...string[]];
  const corsAllowedOrigins = e.CORS_ALLOWED_ORIGINS.map((origin) => new URL(origin).origin);
  const passkeyOrigins = webauthnOrigins(e, corsAllowedOrigins);
  if (typeof passkeyOrigins === 'string') throw new ConfigError([passkeyOrigins]);
  // A bot that answers anyone would let a stranger open terminals: the token alone is never enough.
  if (e.TELEGRAM_BOT_TOKEN && !e.TELEGRAM_ALLOWED_USER_ID) {
    throw new ConfigError(['TELEGRAM_ALLOWED_USER_ID: required when TELEGRAM_BOT_TOKEN is set']);
  }
  // Serving the backend's own port would put the Workflow App on the tailnet — not what a preview is (ADR 0018).
  if (e.PREVIEW_HTTPS_PORTS.includes(e.PORT)) {
    throw new ConfigError([`PREVIEW_HTTPS_PORTS: must not include PORT (${e.PORT})`]);
  }

  return {
    host: e.HOST,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    auth: {
      username: e.APP_USERNAME,
      passwordHash: e.APP_PASSWORD_HASH,
      sessionSecret: e.SESSION_SECRET,
      sessionIdleMs: e.SESSION_IDLE_HOURS * HOUR_MS,
      sessionMaxMs: e.SESSION_MAX_DAYS * 24 * HOUR_MS,
      cookieSecure: e.COOKIE_SECURE,
    },
    corsAllowedOrigins,
    webauthn: { rpId: e.WEBAUTHN_RP_ID, rpName: e.WEBAUTHN_RP_NAME, origins: passkeyOrigins },
    terminals: {
      claudeBin: e.CLAUDE_BIN,
      allowedRoots: e.ALLOWED_ROOTS,
      defaultCwd: e.DEFAULT_CWD ?? firstRoot,
      claudeConfigDir: e.CLAUDE_CONFIG_DIR,
      maxTerminals: e.MAX_TERMINALS,
      scrollbackBytes: e.SCROLLBACK_BYTES,
    },
    workflowPath: e.WORKFLOW_PATH,
    gitBin: e.GIT_BIN,
    dataDir: e.DATA_DIR ?? join(homedir(), '.workflow-app'),
    frontendDist: e.FRONTEND_DIST ?? DEFAULT_FRONTEND_DIST,
    telegram:
      e.TELEGRAM_BOT_TOKEN && e.TELEGRAM_ALLOWED_USER_ID
        ? { botToken: e.TELEGRAM_BOT_TOKEN, allowedUserId: Number(e.TELEGRAM_ALLOWED_USER_ID) }
        : undefined,
    preview: e.TAILSCALE_BIN ? { tailscaleBin: e.TAILSCALE_BIN, httpsPorts: e.PREVIEW_HTTPS_PORTS } : undefined,
  };
}
