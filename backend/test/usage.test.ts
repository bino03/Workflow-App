import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { USAGE_FILES, readUsage, writeUsageFiles } from '../src/usage/usageFiles.js';
import { TEST_USERNAME, testConfig, testStateStore } from './helpers.js';

// The shape seen in the spike of step 1 (claude 2.1.283), trimmed.
const withLimits = {
  session_id: '118f54da-b4c4-4c0b-9491-d5e3077ff882',
  transcript_path: 'C:\\Users\\me\\.claude\\projects\\x\\118f54da.jsonl',
  cwd: 'C:\\dev\\api-faturas',
  model: { id: 'claude-opus-5-5', display_name: 'Opus 5.5' },
  rate_limits: { five_hour: { used_percentage: 44, resets_at: 1790607000 }, seven_day: { used_percentage: 61, resets_at: 1790780400 } },
};
// JSON.stringify drops undefined: the same JSON as a fresh session, which has no rate_limits yet.
const withoutLimits = { ...withLimits, rate_limits: undefined };

let dataDir: string;
beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'wfa-usage-'));
});
afterEach(() => rmSync(dataDir, { recursive: true, force: true }));

/** Runs the status line script the way Claude Code does: JSON on stdin, one line out. */
function runStatusLine(settingsPath: string, input: string, configDir?: string) {
  const { statusLine } = JSON.parse(readFileSync(settingsPath, 'utf8')) as { statusLine: { type: string; command: string } };
  const [node, script] = [...statusLine.command.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
  // Like Claude Code: the status line inherits the claude's env — CLAUDE_CONFIG_DIR only for an extra account.
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => name.toUpperCase() !== 'CLAUDE_CONFIG_DIR'));
  const result = spawnSync(node!, [script!], { input, encoding: 'utf8', env: configDir ? { ...env, CLAUDE_CONFIG_DIR: configDir } : env });
  return { status: result.status, stdout: result.stdout };
}

describe('status line files', () => {
  it('settings point at this node and the script, both absolute', () => {
    const settingsPath = writeUsageFiles(dataDir);
    expect(settingsPath).toBe(join(dataDir, USAGE_FILES.settings));
    const { statusLine } = JSON.parse(readFileSync(settingsPath, 'utf8'));
    expect(statusLine).toEqual({ type: 'command', command: `"${process.execPath}" "${join(dataDir, USAGE_FILES.script)}"` });
  });

  it('keeps only rate_limits and when they were seen — no paths, no session id', () => {
    const settingsPath = writeUsageFiles(dataDir);
    const { status, stdout } = runStatusLine(settingsPath, JSON.stringify(withLimits));
    expect(status).toBe(0);
    expect(stdout).toBe('Opus 5.5 · api-faturas');
    const saved = JSON.parse(readFileSync(join(dataDir, USAGE_FILES.usage), 'utf8'));
    expect(Object.keys(saved).sort()).toEqual(['fetchedAt', 'rate_limits']);
    expect(saved.rate_limits).toEqual(withLimits.rate_limits);
    expect(JSON.stringify(saved)).not.toContain('118f54da');
  });

  it('a JSON without rate_limits (a fresh session) does not touch the saved value', () => {
    const settingsPath = writeUsageFiles(dataDir);
    runStatusLine(settingsPath, JSON.stringify(withLimits));
    const before = readFileSync(join(dataDir, USAGE_FILES.usage), 'utf8');
    expect(runStatusLine(settingsPath, JSON.stringify(withoutLimits)).status).toBe(0);
    expect(readFileSync(join(dataDir, USAGE_FILES.usage), 'utf8')).toBe(before);
  });

  it('never fails on odd input', () => {
    const settingsPath = writeUsageFiles(dataDir);
    for (const input of ['', 'not json', '[]', '{"rate_limits": 5}']) {
      expect(runStatusLine(settingsPath, input)).toEqual({ status: 0, stdout: '' });
    }
    expect(existsSync(join(dataDir, USAGE_FILES.usage))).toBe(false);
  });
});

describe('one quota file per account (ADR 0027)', () => {
  const EXTRA = '6F1E2D3C-4B5A-4987-8A6B-5C4D3E2F1A0B';
  const extraFile = `usage-${EXTRA.toLowerCase()}.json`;

  it("an extra account's claude writes usage-<id>.json and leaves the primary's untouched", () => {
    const settingsPath = writeUsageFiles(dataDir);
    runStatusLine(settingsPath, JSON.stringify(withLimits));
    const primaryBefore = readFileSync(join(dataDir, USAGE_FILES.usage), 'utf8');
    const other = { ...withLimits, rate_limits: { five_hour: { used_percentage: 3, resets_at: 1790607000 }, seven_day: { used_percentage: 1, resets_at: 1790780400 } } };
    expect(runStatusLine(settingsPath, JSON.stringify(other), join(dataDir, 'accounts', EXTRA)).status).toBe(0);
    expect(JSON.parse(readFileSync(join(dataDir, extraFile), 'utf8')).rate_limits).toEqual(other.rate_limits);
    expect(readFileSync(join(dataDir, USAGE_FILES.usage), 'utf8')).toBe(primaryBefore);
    expect(readUsage(dataDir, EXTRA).fiveHour?.usedPct).toBe(3);
    expect(readUsage(dataDir).fiveHour?.usedPct).toBe(44);
  });

  it('the primary, a folder outside accounts/, a nested one or a non-UUID name all write usage.json', () => {
    const settingsPath = writeUsageFiles(dataDir);
    for (const configDir of [
      join(tmpdir(), 'outro-claude'),
      join(dataDir, 'accounts', EXTRA, 'sub'),
      join(dataDir, 'accounts', 'nao-e-uuid'),
      join(dataDir, 'fora', EXTRA),
      'relativa\\pasta',
    ]) {
      rmSync(join(dataDir, USAGE_FILES.usage), { force: true });
      runStatusLine(settingsPath, JSON.stringify(withLimits), configDir);
      expect(existsSync(join(dataDir, USAGE_FILES.usage)), configDir).toBe(true);
    }
    expect(existsSync(join(dataDir, extraFile))).toBe(false);
  });

  it('readUsage of an account with no file yet → nulls; an id that is not a UUID reads the primary', () => {
    writeFileSync(join(dataDir, USAGE_FILES.usage), JSON.stringify({ rate_limits: withLimits.rate_limits, fetchedAt: '2026-09-28T14:30:00.000Z' }));
    expect(readUsage(dataDir, EXTRA)).toEqual({ fiveHour: null, weekly: null, fetchedAt: null });
    expect(readUsage(dataDir, '../usage').fiveHour?.usedPct).toBe(44);
  });
});

describe('readUsage', () => {
  it('turns resets_at (Unix seconds) into ISO', () => {
    writeFileSync(join(dataDir, USAGE_FILES.usage), JSON.stringify({ rate_limits: withLimits.rate_limits, fetchedAt: '2026-09-28T14:30:00.000Z' }));
    expect(readUsage(dataDir)).toEqual({
      fiveHour: { usedPct: 44, resetsAt: new Date(1790607000 * 1000).toISOString() },
      weekly: { usedPct: 61, resetsAt: new Date(1790780400 * 1000).toISOString() },
      fetchedAt: '2026-09-28T14:30:00.000Z',
    });
  });

  it('missing, invalid or odd files → nulls, never an error', () => {
    const none = { fiveHour: null, weekly: null, fetchedAt: null };
    expect(readUsage(dataDir)).toEqual(none);
    writeFileSync(join(dataDir, USAGE_FILES.usage), '{not json');
    expect(readUsage(dataDir)).toEqual(none);
    writeFileSync(join(dataDir, USAGE_FILES.usage), JSON.stringify({ rate_limits: { five_hour: { used_percentage: '44' } }, fetchedAt: 'yesterday' }));
    expect(readUsage(dataDir)).toEqual(none);
  });
});

describe('GET /api/usage', () => {
  it('needs a session, then returns the last value', async () => {
    const password = 'usage route password';
    const config = testConfig({ APP_PASSWORD_HASH: await argon2.hash(password, { type: argon2.argon2id }), DATA_DIR: dataDir });
    const terminalManager = new TerminalManager({ spawn: () => { throw new Error('no spawn'); }, maxTerminals: 1, scrollbackBytes: 1024 });
    const app = await buildApp({ stateStore: await testStateStore(), config, terminalManager, logger: false });
    expect(existsSync(join(dataDir, USAGE_FILES.settings))).toBe(true);

    expect((await app.inject({ method: 'GET', url: '/api/usage' })).statusCode).toBe(401);
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: TEST_USERNAME, password } });
    const cookie = `session=${login.cookies.find((c) => c.name === 'session')!.value}`;
    expect((await app.inject({ method: 'GET', url: '/api/usage', headers: { cookie } })).json()).toEqual({ fiveHour: null, weekly: null, fetchedAt: null });

    runStatusLine(join(dataDir, USAGE_FILES.settings), JSON.stringify(withLimits));
    const body = (await app.inject({ method: 'GET', url: '/api/usage', headers: { cookie } })).json();
    expect(body.fiveHour).toEqual({ usedPct: 44, resetsAt: new Date(1790607000 * 1000).toISOString() });
    await app.close();
  });

  it("returns the active account's quota; an active id that no longer exists reads the primary's (ADR 0027)", async () => {
    const EXTRA = '6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b';
    const password = 'usage route password';
    const config = testConfig({ APP_PASSWORD_HASH: await argon2.hash(password, { type: argon2.argon2id }), DATA_DIR: dataDir });
    const terminalManager = new TerminalManager({ spawn: () => { throw new Error('no spawn'); }, maxTerminals: 1, scrollbackBytes: 1024 });
    const stateStore = await testStateStore();
    const app = await buildApp({ stateStore, config, terminalManager, logger: false });
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: TEST_USERNAME, password } });
    const cookie = `session=${login.cookies.find((c) => c.name === 'session')!.value}`;
    const usage = async () => (await app.inject({ method: 'GET', url: '/api/usage', headers: { cookie } })).json().fiveHour?.usedPct;

    const settings = join(dataDir, USAGE_FILES.settings);
    runStatusLine(settings, JSON.stringify(withLimits));
    const extraLimits = { five_hour: { used_percentage: 7, resets_at: 1790607000 }, seven_day: { used_percentage: 2, resets_at: 1790780400 } };
    runStatusLine(settings, JSON.stringify({ ...withLimits, rate_limits: extraLimits }), join(dataDir, 'accounts', EXTRA));

    expect(await usage()).toBe(44);
    stateStore.update((draft) => {
      draft.accounts.push({ id: EXTRA, label: 'Trabalho', createdAt: '2026-11-01T10:00:00.000Z' });
      draft.activeAccountId = EXTRA;
    });
    expect(await usage()).toBe(7);
    stateStore.update((draft) => void (draft.accounts = []));
    expect(await usage()).toBe(44);
    await app.close();
  });
});
