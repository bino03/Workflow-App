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
});

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
  /** Where state.json lives (ADR 0009); created at startup if missing. */
  dataDir: string;
  /** Absolute path of the built SPA; served only if it has an index.html. */
  frontendDist: string;
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
    dataDir: e.DATA_DIR ?? join(homedir(), '.workflow-app'),
    frontendDist: e.FRONTEND_DIST ?? DEFAULT_FRONTEND_DIST,
  };
}
