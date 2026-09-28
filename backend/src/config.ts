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

  APP_PASSWORD_HASH: z.string().startsWith('$argon2id$', 'must be an argon2id hash (npm run hash-password)'),
  SESSION_SECRET: z.string().min(64, 'must have at least 64 characters'),
  SESSION_IDLE_HOURS: z.coerce.number().positive().default(12),
  SESSION_MAX_DAYS: z.coerce.number().positive().default(7),
  COOKIE_SECURE: booleanString,
  CORS_ALLOWED_ORIGINS: z
    .string()
    .transform(splitList(','))
    .pipe(z.array(z.url()).min(1, 'at least one origin is required')),

  CLAUDE_BIN: z.string().trim().min(1).default('claude'),
  ALLOWED_ROOTS: z
    .string()
    .transform(splitList(';'))
    .pipe(z.array(existingDirectory).min(1, 'at least one root is required')),
  DEFAULT_CWD: optionalString,
  CLAUDE_CONFIG_DIR: optionalString,
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
    passwordHash: string;
    sessionSecret: string;
    sessionIdleMs: number;
    sessionMaxMs: number;
    cookieSecure: boolean;
  };
  corsAllowedOrigins: string[];
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

  return {
    host: e.HOST,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    auth: {
      passwordHash: e.APP_PASSWORD_HASH,
      sessionSecret: e.SESSION_SECRET,
      sessionIdleMs: e.SESSION_IDLE_HOURS * HOUR_MS,
      sessionMaxMs: e.SESSION_MAX_DAYS * 24 * HOUR_MS,
      cookieSecure: e.COOKIE_SECURE,
    },
    corsAllowedOrigins: e.CORS_ALLOWED_ORIGINS.map((origin) => new URL(origin).origin),
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
