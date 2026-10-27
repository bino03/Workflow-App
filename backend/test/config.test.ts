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
    for (const name of ['APP_USERNAME', 'APP_PASSWORD_HASH', 'SESSION_SECRET', 'CORS_ALLOWED_ORIGINS', 'ALLOWED_ROOTS', 'WORKFLOW_PATH']) {
      expect(issues.some((issue) => issue.startsWith(`${name}:`))).toBe(true);
    }
  });

  it('rejects a short session secret and a non-argon2id hash', () => {
    const issues = issuesOf(testEnv({ SESSION_SECRET: 'short', APP_PASSWORD_HASH: '$2b$10$bcrypt' }));
    expect(issues.some((issue) => issue.startsWith('SESSION_SECRET:'))).toBe(true);
    expect(issues.some((issue) => issue.startsWith('APP_PASSWORD_HASH:'))).toBe(true);
    expect(issues.join()).not.toContain('short');
  });

  it('rejects a username with characters outside the allowed set', () => {
    for (const username of ['bino 03', 'bino<03>', 'x'.repeat(65), '   ']) {
      expect(issuesOf(testEnv({ APP_USERNAME: username })).some((issue) => issue.startsWith('APP_USERNAME:'))).toBe(true);
    }
    expect(loadConfig(testEnv({ APP_USERNAME: 'bino03' })).auth.username).toBe('bino03');
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

  it('CLAUDE_CONFIG_DIR: empty means not set; relative is refused', () => {
    expect(loadConfig(testEnv({ CLAUDE_CONFIG_DIR: '' })).terminals.claudeConfigDir).toBeUndefined();
    expect(issuesOf(testEnv({ CLAUDE_CONFIG_DIR: '.claude' })).join()).toContain('CLAUDE_CONFIG_DIR');
  });

  it('DATA_DIR defaults to ~/.workflow-app and must be absolute', () => {
    expect(loadConfig(testEnv({ DATA_DIR: undefined })).dataDir).toBe(join(homedir(), '.workflow-app'));
    expect(loadConfig(testEnv({ DATA_DIR: 'C:\\data' })).dataDir).toBe('C:\\data');
    expect(issuesOf(testEnv({ DATA_DIR: 'relative' })).join()).toContain('DATA_DIR');
  });

  it('PORTFOLIO_PATH: unset or empty → undefined; an existing absolute folder → its real path; relative or missing refused', () => {
    expect(loadConfig(testEnv({ PORTFOLIO_PATH: undefined })).portfolioPath).toBeUndefined();
    expect(loadConfig(testEnv({ PORTFOLIO_PATH: '' })).portfolioPath).toBeUndefined();
    expect(loadConfig(testEnv({ PORTFOLIO_PATH: tmpdir() })).portfolioPath).toBe(realpathSync(tmpdir()));
    expect(issuesOf(testEnv({ PORTFOLIO_PATH: 'portfolio' })).join()).toContain('PORTFOLIO_PATH');
    expect(issuesOf(testEnv({ PORTFOLIO_PATH: 'C:\\does\\not\\exist\\wfa' })).join()).toContain('does not exist');
  });

  it('OPEN_FOLDERS: on by default, false turns it off, anything else refused', () => {
    expect(loadConfig(testEnv()).openFolders).toBe(true);
    expect(loadConfig(testEnv({ OPEN_FOLDERS: 'false' })).openFolders).toBe(false);
    expect(issuesOf(testEnv({ OPEN_FOLDERS: 'no' })).join()).toContain('OPEN_FOLDERS');
  });

  it('parses COOKIE_SECURE strictly', () => {
    expect(loadConfig(testEnv({ COOKIE_SECURE: 'true' })).auth.cookieSecure).toBe(true);
    expect(issuesOf(testEnv({ COOKIE_SECURE: 'yes' })).join()).toContain('COOKIE_SECURE');
  });

  describe('WebAuthn (ADR 0015)', () => {
    it('defaults to rpID localhost and the localhost origins (never 127.0.0.1)', () => {
      const config = loadConfig(testEnv({ CORS_ALLOWED_ORIGINS: 'http://localhost:7401,http://127.0.0.1:7401' }));
      expect(config.webauthn).toEqual({
        rpId: 'localhost',
        rpName: 'Workflow App',
        origins: ['http://localhost:7401', 'http://localhost:7400'],
      });
    });

    it('refuses an IP as rpID', () => {
      expect(issuesOf(testEnv({ WEBAUTHN_RP_ID: '127.0.0.1' })).join()).toContain('WEBAUTHN_RP_ID');
    });

    it('explicit origins must be under the rpID', () => {
      const env = { WEBAUTHN_RP_ID: 'desktop.tail1234.ts.net' };
      expect(loadConfig(testEnv({ ...env, WEBAUTHN_ORIGINS: 'https://desktop.tail1234.ts.net' })).webauthn.origins).toEqual([
        'https://desktop.tail1234.ts.net',
      ]);
      expect(issuesOf(testEnv({ ...env, WEBAUTHN_ORIGINS: 'https://evil.example' })).join()).toContain('not under WEBAUTHN_RP_ID');
      // No explicit origins and none of the CORS ones match: refuse to start rather than accept nothing.
      expect(issuesOf(testEnv(env)).join()).toContain('set it explicitly');
    });
  });

  describe('Telegram bot (ADR 0017)', () => {
    const TOKEN = '7012345678:AAFv1x2y3z4ABCDEFghijklmnopqrstuvwx';

    it('no token → no bot; empty lines count as unset', () => {
      expect(loadConfig(testEnv()).telegram).toBeUndefined();
      expect(loadConfig(testEnv({ TELEGRAM_BOT_TOKEN: '', TELEGRAM_ALLOWED_USER_ID: '' })).telegram).toBeUndefined();
    });

    it('token + user id → the bot config, with the id as a number', () => {
      expect(loadConfig(testEnv({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_ALLOWED_USER_ID: '123456789' })).telegram).toEqual({
        botToken: TOKEN,
        allowedUserId: 123456789,
      });
    });

    it('a token without the allowed user id does not start — the bot would answer anyone', () => {
      expect(issuesOf(testEnv({ TELEGRAM_BOT_TOKEN: TOKEN }))).toEqual(['TELEGRAM_ALLOWED_USER_ID: required when TELEGRAM_BOT_TOKEN is set']);
    });

    it('rejects malformed values without echoing them', () => {
      const issues = issuesOf(testEnv({ TELEGRAM_BOT_TOKEN: 'not-a-token-secret', TELEGRAM_ALLOWED_USER_ID: '-5' }));
      expect(issues.some((issue) => issue.startsWith('TELEGRAM_BOT_TOKEN:'))).toBe(true);
      expect(issues.some((issue) => issue.startsWith('TELEGRAM_ALLOWED_USER_ID:'))).toBe(true);
      expect(issues.join()).not.toContain('not-a-token-secret');
    });
  });

  describe('previews (ADR 0018)', () => {
    const BIN = 'C:\\Program Files\\Tailscale\\tailscale.exe';

    it('no TAILSCALE_BIN → previews off; an empty line counts as unset', () => {
      expect(loadConfig(testEnv()).preview).toBeUndefined();
      expect(loadConfig(testEnv({ TAILSCALE_BIN: '  ' })).preview).toBeUndefined();
    });

    it('TAILSCALE_BIN → previews on, with the default HTTPS range 8443-8446', () => {
      expect(loadConfig(testEnv({ TAILSCALE_BIN: BIN })).preview).toEqual({ tailscaleBin: BIN, httpsPorts: [8443, 8444, 8445, 8446] });
    });

    it('reads lists and ranges, without duplicates', () => {
      expect(loadConfig(testEnv({ TAILSCALE_BIN: BIN, PREVIEW_HTTPS_PORTS: '9443, 8443-8444,8443' })).preview?.httpsPorts).toEqual([9443, 8443, 8444]);
    });

    it('refuses malformed, out-of-range, reversed, empty or too large port lists', () => {
      for (const bad of ['abc', '0', '70000', '8446-8443', ' , ', '1000-2000', '8443;8444']) {
        expect(issuesOf(testEnv({ TAILSCALE_BIN: BIN, PREVIEW_HTTPS_PORTS: bad })).some((i) => i.startsWith('PREVIEW_HTTPS_PORTS:'))).toBe(true);
      }
    });

    it("refuses a range that includes the backend's own PORT — the app itself would land on the tailnet", () => {
      expect(issuesOf(testEnv({ TAILSCALE_BIN: BIN, PORT: '8444' }))).toEqual(['PREVIEW_HTTPS_PORTS: must not include PORT (8444)']);
    });
  });
});
