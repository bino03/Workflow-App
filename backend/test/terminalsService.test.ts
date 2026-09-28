import { mkdirSync, mkdtempSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppError, type ErrorCode } from '../src/common/errors.js';
import { ClaudeSessions } from '../src/sessions/claudeSessions.js';
import { StateStore } from '../src/state/stateStore.js';
import { ClaudeBinError } from '../src/terminals/spawnClaude.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { TerminalsService } from '../src/terminals/terminalsService.js';
import { fakeClaude, waitFor } from './fakeClaude.js';

const SAVED = '9089b683-e79e-4bd7-9d4b-69f6fd40cc0a';
const OTHER = '4c11a40a-9c91-4a62-9d86-00197ae5a535';

const base = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfa-terminals-')));
const root = join(base, 'root');
const project = join(root, 'api-faturas');
const emptyProject = join(root, 'sandbox');
const outside = join(base, 'outside');
const claudeConfig = join(base, 'claude');
mkdirSync(project, { recursive: true });
mkdirSync(emptyProject);
mkdirSync(outside);

const sessions = new ClaudeSessions(claudeConfig);

function writeSession(cwd: string, id: string, title: string, mtime: Date) {
  const folder = sessions.folderOf(cwd);
  mkdirSync(folder, { recursive: true });
  const file = join(folder, `${id}.jsonl`);
  writeFileSync(file, `${JSON.stringify({ type: 'ai-title', aiTitle: title })}\n`);
  utimesSync(file, mtime, mtime);
}
writeSession(project, OTHER, 'Sessão antiga', new Date('2026-09-20T10:00:00Z'));
writeSession(project, SAVED, 'Migração para prisma', new Date('2026-09-26T18:42:00Z')); // the latest

afterAll(() => rmSync(base, { recursive: true, force: true }));

async function expectAppError(action: () => unknown, code: ErrorCode) {
  let caught: unknown;
  try {
    await action();
  } catch (error) {
    caught = error;
  }
  expect(caught, `expected ${code}`).toBeInstanceOf(AppError);
  expect((caught as AppError).code).toBe(code);
}

describe('TerminalsService', () => {
  let dataDir: string;
  let stateStore: StateStore;
  let manager: TerminalManager;
  let claude: ReturnType<typeof fakeClaude>;
  let clock: number;
  let service: TerminalsService;
  const size = { cols: 100, rows: 30 };

  function build(options: { settingsPath?: string } = {}) {
    return new TerminalsService({
      stateStore,
      terminalManager: manager,
      sessions,
      allowedRoots: [root],
      now: () => new Date((clock += 1000)),
      ...options,
    });
  }

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'wfa-terminals-data-'));
    stateStore = await StateStore.load(dataDir);
    claude = fakeClaude();
    manager = new TerminalManager({ spawn: claude.spawn, maxTerminals: 2, scrollbackBytes: 64 * 1024 });
    clock = Date.parse('2026-09-28T10:00:00Z');
    service = build();
  });

  afterEach(async () => {
    await manager.killAll();
    await stateStore.flush();
    rmSync(dataDir, { recursive: true, force: true });
  });

  describe('create', () => {
    it('a new terminal: --session-id with a fresh UUID, saved, and the folder becomes recent', async () => {
      const view = await service.create({ cwd: project, mode: 'new', label: '  api  ', ...size });
      expect(view).toMatchObject({ cwd: project, label: 'api', status: 'running', exitCode: null });
      expect(claude.launches).toEqual([{ cwd: project, ...size, args: ['--session-id', view.claudeSessionId] }]);
      expect(view.claudeSessionId).not.toBe(SAVED);

      const state = stateStore.read();
      expect(state.terminals).toEqual([
        { id: view.id, label: 'api', cwd: project, claudeSessionId: view.claudeSessionId, createdAt: view.createdAt, updatedAt: view.createdAt, lastOpenedAt: view.createdAt },
      ]);
      expect(state.folders).toEqual([{ path: project, favorite: false, lastUsedAt: view.createdAt }]);
    });

    it('refuses a folder outside ALLOWED_ROOTS before launching anything', async () => {
      await expectAppError(() => service.create({ cwd: outside, mode: 'new', ...size }), 'FOLDER_001');
      expect(claude.launches).toEqual([]);
      expect(stateStore.read().terminals).toEqual([]);
    });

    it('resume: --resume with the saved session; a missing .jsonl is TERMINAL_004', async () => {
      const view = await service.create({ cwd: project, mode: 'resume', sessionId: OTHER, ...size });
      expect(view.claudeSessionId).toBe(OTHER);
      expect(claude.launches.at(-1)!.args).toEqual(['--resume', OTHER]);
      await expectAppError(
        () => service.create({ cwd: project, mode: 'resume', sessionId: '55555555-5555-4555-8555-555555555555', ...size }),
        'TERMINAL_004',
      );
    });

    it('a session already used by a saved terminal cannot be opened again (TERMINAL_003)', async () => {
      await service.create({ cwd: project, mode: 'resume', sessionId: OTHER, ...size });
      await expectAppError(() => service.create({ cwd: project, mode: 'resume', sessionId: OTHER, ...size }), 'TERMINAL_003');
    });

    it('continue: resumes the most recent session of the folder; none → SESSION_001', async () => {
      const view = await service.create({ cwd: project, mode: 'continue', ...size });
      expect(view.claudeSessionId).toBe(SAVED);
      expect(claude.launches.at(-1)!.args).toEqual(['--resume', SAVED]);
      await expectAppError(() => service.create({ cwd: emptyProject, mode: 'continue', ...size }), 'SESSION_001');
    });

    it('MAX_TERMINALS → TERMINAL_002, and nothing is saved', async () => {
      await service.create({ cwd: project, mode: 'new', ...size });
      await service.create({ cwd: project, mode: 'new', ...size });
      await expectAppError(() => service.create({ cwd: emptyProject, mode: 'new', ...size }), 'TERMINAL_002');
      expect(stateStore.read().terminals).toHaveLength(2);
    });

    it('a missing claude binary → TERMINAL_005', async () => {
      manager = new TerminalManager({
        spawn: () => {
          throw new ClaudeBinError('CLAUDE_BIN not found');
        },
        maxTerminals: 2,
        scrollbackBytes: 1024,
      });
      await expectAppError(() => build().create({ cwd: project, mode: 'new', ...size }), 'TERMINAL_005');
      expect(stateStore.read().terminals).toEqual([]);
    });

    it('passes --settings when the quota status line is on', async () => {
      const settingsPath = join(dataDir, 'claude-settings.json');
      const view = await build({ settingsPath }).create({ cwd: project, mode: 'new', ...size });
      expect(claude.launches.at(-1)!.args).toEqual(['--session-id', view.claudeSessionId, '--settings', settingsPath]);
    });
  });

  describe('status and reopen', () => {
    it('a claude that exits on its own stays listed as exited; reopen resumes it with the same id', async () => {
      const view = await service.create({ cwd: project, mode: 'resume', sessionId: OTHER, ...size });
      manager.write(view.id, 'q');
      await waitFor(() => service.get(view.id)?.status === 'exited');
      expect(service.list()).toMatchObject([{ id: view.id, status: 'exited', exitCode: 3 }]);

      const reopened = await service.reopen(view.id, size);
      expect(reopened).toMatchObject({ id: view.id, status: 'running', createdAt: view.createdAt });
      expect(reopened.lastOpenedAt > view.lastOpenedAt).toBe(true);
      expect(claude.launches.at(-1)!.args).toEqual(['--resume', OTHER]);
      await expectAppError(() => service.reopen(view.id, size), 'TERMINAL_006');
    });

    it('after a backend restart saved terminals are stopped; reopen resumes, or starts fresh without a .jsonl', async () => {
      const kept = await service.create({ cwd: project, mode: 'resume', sessionId: OTHER, ...size });
      const fresh = await service.create({ cwd: emptyProject, mode: 'new', ...size });
      await manager.killAll();

      // A new manager is what a restart looks like: state.json survives, the PTYs do not.
      manager = new TerminalManager({ spawn: claude.spawn, maxTerminals: 2, scrollbackBytes: 1024 });
      const restarted = build();
      expect(restarted.list().map((t) => [t.id, t.status])).toEqual([
        [kept.id, 'stopped'],
        [fresh.id, 'stopped'],
      ]);

      const resumed = await restarted.reopen(kept.id, size);
      expect(resumed).toMatchObject({ status: 'running', freshSession: false });
      expect(claude.launches.at(-1)!.args).toEqual(['--resume', OTHER]);

      // Claude Code never saves a session without messages (the fake writes no .jsonl either): nothing to
      // resume, so the same terminal starts a new conversation with the same UUID.
      const reopenedFresh = await restarted.reopen(fresh.id, size);
      expect(reopenedFresh).toMatchObject({ id: fresh.id, status: 'running', freshSession: true, claudeSessionId: fresh.claudeSessionId });
      expect(claude.launches.at(-1)!.args).toEqual(['--session-id', fresh.claudeSessionId]);
      await expectAppError(() => restarted.reopen('00000000-0000-4000-8000-000000000000', size), 'TERMINAL_001');
    });

    it('reopen re-checks the folder against ALLOWED_ROOTS (they may have changed)', async () => {
      const view = await service.create({ cwd: project, mode: 'resume', sessionId: OTHER, ...size });
      await manager.kill(view.id);
      const narrowed = new TerminalsService({ stateStore, terminalManager: manager, sessions, allowedRoots: [emptyProject] });
      await expectAppError(() => narrowed.reopen(view.id, size), 'FOLDER_001');
    });
  });

  describe('rename and close', () => {
    it('rename trims; empty means "use the folder name" (null)', async () => {
      const view = await service.create({ cwd: project, mode: 'new', ...size });
      expect(service.rename(view.id, '  faturas ').label).toBe('faturas');
      expect(service.rename(view.id, '   ').label).toBeNull();
      await expectAppError(() => service.rename('00000000-0000-4000-8000-000000000000', 'x'), 'TERMINAL_001');
    });

    it('close kills the process and moves the terminal to the history with the summary of its .jsonl', async () => {
      const view = await service.create({ cwd: project, mode: 'resume', sessionId: OTHER, label: 'antiga', ...size });
      await service.close(view.id);
      expect(manager.get(view.id)).toBeUndefined();
      const state = stateStore.read();
      expect(state.terminals).toEqual([]);
      expect(state.closedTerminals).toEqual([
        {
          id: view.id,
          label: 'antiga',
          cwd: project,
          claudeSessionId: OTHER,
          openedAt: view.createdAt,
          closedAt: expect.any(String),
          summary: 'Sessão antiga',
          summarySource: 'ai-title',
        },
      ]);
    });

    it('closing never fails because of the summary: no .jsonl → summary null', async () => {
      const view = await service.create({ cwd: emptyProject, mode: 'new', ...size });
      await service.close(view.id);
      expect(stateStore.read().closedTerminals[0]).toMatchObject({ id: view.id, summary: null, summarySource: null });
      await expectAppError(() => service.close(view.id), 'TERMINAL_001');
    });
  });
});
