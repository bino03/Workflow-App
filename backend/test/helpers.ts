import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Config, loadConfig } from '../src/config.js';

export const TEST_ORIGIN = 'http://localhost:7401';

/** A complete, valid environment — tests override single variables from here. */
export function testEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    APP_PASSWORD_HASH: '$argon2id$v=19$m=65536,t=3,p=4$placeholder$placeholder',
    SESSION_SECRET: 'x'.repeat(64),
    CORS_ALLOWED_ORIGINS: TEST_ORIGIN,
    ALLOWED_ROOTS: tmpdir(),
    WORKFLOW_PATH: tmpdir(),
    // Tests must not depend on whether frontend/dist happens to be built; spa.test.ts sets its own.
    FRONTEND_DIST: join(tmpdir(), 'workflow-app-no-frontend-dist'),
    ...overrides,
  };
}

export function testConfig(overrides: Record<string, string | undefined> = {}): Config {
  return loadConfig(testEnv(overrides));
}
