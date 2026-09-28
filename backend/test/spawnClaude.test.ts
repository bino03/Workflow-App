import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ClaudeBinError, childEnv, resolveClaudeBin } from '../src/terminals/spawnClaude.js';

describe('childEnv', () => {
  it('drops Anthropic credentials, Claude Code session variables and the app config', () => {
    const env = childEnv({
      PATH: 'C:\\bin',
      USERPROFILE: 'C:\\Users\\me',
      ANTHROPIC_API_KEY: 'sk-ant-leak',
      anthropic_auth_token: 'lowercase-leak',
      ANTHROPIC_BASE_URL: 'https://proxy',
      CLAUDECODE: '1',
      CLAUDE_PID: '123',
      CLAUDE_CODE_SESSION_ID: 'abc',
      CLAUDE_CODE_MESSAGING_TOKEN: 'secret',
      SESSION_SECRET: 'x'.repeat(64),
      APP_PASSWORD_HASH: '$argon2id$…',
      PORT: '7400',
      HOST: '127.0.0.1',
      DATA_DIR: 'C:\\Users\\me\\.workflow-app',
      FRONTEND_DIST: 'C:\\dist',
      CLAUDE_CONFIG_DIR: 'C:\\Users\\me\\.claude',
    });
    expect(env).toEqual({
      PATH: 'C:\\bin',
      USERPROFILE: 'C:\\Users\\me',
      CLAUDE_CONFIG_DIR: 'C:\\Users\\me\\.claude',
    });
  });
});

describe('resolveClaudeBin', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfa-bin-'));
  writeFileSync(join(dir, 'fakeclaude.exe'), '');
  writeFileSync(join(dir, 'npmclaude.cmd'), '');

  it('finds a bare name on PATH using PATHEXT', () => {
    expect(resolveClaudeBin('fakeclaude', { PATH: dir, PATHEXT: '.COM;.EXE;.CMD' })).toBe(join(dir, 'fakeclaude.exe'));
  });

  it('accepts an existing absolute path', () => {
    expect(resolveClaudeBin(join(dir, 'fakeclaude.exe'), {})).toBe(join(dir, 'fakeclaude.exe'));
  });

  it('refuses a .cmd shim and a missing binary', () => {
    if (process.platform === 'win32') {
      expect(() => resolveClaudeBin('npmclaude', { PATH: dir, PATHEXT: '.EXE;.CMD' })).toThrow(ClaudeBinError);
    }
    expect(() => resolveClaudeBin('nope', { PATH: dir })).toThrow(ClaudeBinError);
    expect(() => resolveClaudeBin(join(dir, 'missing.exe'), {})).toThrow(ClaudeBinError);
  });
});
