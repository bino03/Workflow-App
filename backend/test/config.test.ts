import { realpathSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config.js';
import { testEnv } from './helpers.js';

function issuesOf(env: NodeJS.ProcessEnv): string[] {
  try {
    loadConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) return error.issues;
    throw error;
  }
  throw new Error('expected a ConfigError');
}

describe('loadConfig', () => {
  it('applies the documented defaults', () => {
    const config = loadConfig(testEnv());
    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(7400);
    expect(config.auth.cookieSecure).toBe(false);
    expect(config.auth.sessionIdleMs).toBe(12 * 60 * 60 * 1000);
    expect(config.auth.sessionMaxMs).toBe(7 * 24 * 60 * 60 * 1000);
    expect(config.terminals.claudeBin).toBe('claude');
    expect(config.terminals.maxTerminals).toBe(8);
    expect(config.terminals.scrollbackBytes).toBe(1_048_576);
    expect(config.terminals.defaultCwd).toBe(realpathSync(tmpdir()));
  });

  it('fails listing every missing required variable, without values', () => {
    const issues = issuesOf({});
    for (const name of ['APP_PASSWORD_HASH', 'SESSION_SECRET', 'CORS_ALLOWED_ORIGINS', 'ALLOWED_ROOTS', 'WORKFLOW_PATH']) {
      expect(issues.some((issue) => issue.startsWith(`${name}:`))).toBe(true);
    }
  });

  it('rejects a short session secret and a non-argon2id hash', () => {
    const issues = issuesOf(testEnv({ SESSION_SECRET: 'short', APP_PASSWORD_HASH: '$2b$10$bcrypt' }));
    expect(issues.some((issue) => issue.startsWith('SESSION_SECRET:'))).toBe(true);
    expect(issues.some((issue) => issue.startsWith('APP_PASSWORD_HASH:'))).toBe(true);
    expect(issues.join()).not.toContain('short');
  });

  it('rejects relative and missing roots', () => {
    expect(issuesOf(testEnv({ ALLOWED_ROOTS: 'relative\\path' })).join()).toContain('absolute');
    expect(issuesOf(testEnv({ ALLOWED_ROOTS: 'C:\\does\\not\\exist\\wfa' })).join()).toContain('does not exist');
  });

  it('splits roots on ; and origins on ,', () => {
    const config = loadConfig(
      testEnv({
        ALLOWED_ROOTS: `${tmpdir()} ; ${tmpdir()};`,
        CORS_ALLOWED_ORIGINS: 'http://localhost:7401, http://127.0.0.1:7401/',
      }),
    );
    expect(config.terminals.allowedRoots).toHaveLength(2);
    expect(config.corsAllowedOrigins).toEqual(['http://localhost:7401', 'http://127.0.0.1:7401']);
  });

  it('DATA_DIR defaults to ~/.workflow-app and must be absolute', () => {
    expect(loadConfig(testEnv({ DATA_DIR: undefined })).dataDir).toBe(join(homedir(), '.workflow-app'));
    expect(loadConfig(testEnv({ DATA_DIR: 'C:\\data' })).dataDir).toBe('C:\\data');
    expect(issuesOf(testEnv({ DATA_DIR: 'relative' })).join()).toContain('DATA_DIR');
  });

  it('parses COOKIE_SECURE strictly', () => {
    expect(loadConfig(testEnv({ COOKIE_SECURE: 'true' })).auth.cookieSecure).toBe(true);
    expect(issuesOf(testEnv({ COOKIE_SECURE: 'yes' })).join()).toContain('COOKIE_SECURE');
  });
});
