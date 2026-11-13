import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRunService, type AppRunServiceDeps } from '../src/appRuns/appRunService.js';
import { AppError, type ErrorCode } from '../src/common/errors.js';
import type { DevPort } from '../src/preview/listeningPorts.js';
import type { CreateAppRunTerminal, TerminalView } from '../src/terminals/terminalsService.js';
import { removeDir } from './helpers.js';

const base = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfa-apprun-')));
const root = join(base, 'root');
const project = join(root, 'loja');
const bare = join(root, 'sem-stop');
const self = join(root, 'workflow-app');
const outside = join(base, 'outside');
for (const dir of [project, bare, self, outside]) mkdirSync(dir, { recursive: true });
function skill(dir: string, name: string) {
  mkdirSync(join(dir, '.claude', 'skills', name), { recursive: true });
  writeFileSync(join(dir, '.claude', 'skills', name, 'SKILL.md'), `# ${name}\n`);
}
skill(project, 'run');
skill(project, 'stop');
skill(bare, 'run'); // no /stop
skill(self, 'run');
skill(self, 'stop');

afterAll(() => removeDir(base));

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

/** The terminals an app run talks to, in memory: a pid per terminal and what was typed into it. */
function fakeTerminals() {
  const views = new Map<string, TerminalView>();
  const pids = new Map<string, number>();
  const typed: { id: string; text: string }[] = [];
  const created: CreateAppRunTerminal[] = [];
  let next = 0;
  let nextPid = 4000;
  return {
    typed,
    created,
    views,
    pids,
    exit: (id: string) => void (views.get(id)!.status = 'exited'),
    pidOf: (id: string) => pids.get(id),
    terminals: {
      createAppRun: vi.fn(async (request: CreateAppRunTerminal) => {
        created.push(request);
        const id = `run-${++next}`;
        const view = { id, cwd: request.cwd, status: 'running', hidden: true } as TerminalView;
        views.set(id, view);
        pids.set(id, ++nextPid);
        return view;
      }),
      get: (id: string) => views.get(id),
      paste: vi.fn(async (id: string, text: string) => {
        if (views.get(id)?.status !== 'running') throw new AppError('TERMINAL_006');
        typed.push({ id, text });
      }),
      waitForQuiet: vi.fn(async () => true),
      reveal: vi.fn((id: string) => {
        views.get(id)!.hidden = false;
        return views.get(id)!;
      }),
      close: vi.fn(async (id: string) => {
        views.delete(id);
        pids.delete(id);
      }),
    },
  };
}

describe('AppRunService (ADR 0030)', () => {
  let fake: ReturnType<typeof fakeTerminals>;
  /** Ports listening below each pid — what devPortsOf would read from the OS. */
  let ports: Map<number, number[]>;
  let clock: number;
  let service: AppRunService;

  function build(overrides: Partial<AppRunServiceDeps> = {}) {
    return new AppRunService({
      terminals: fake.terminals,
      pidOf: fake.pidOf,
      devPorts: async (pid) => (ports.get(pid) ?? []).map((port): DevPort => ({ port, pid, process: 'node.exe' })),
      allowedRoots: [root],
      selfPath: self,
      stopGraceMs: 300,
      stopPollMs: 10,
      now: () => new Date(clock),
      ...overrides,
    });
  }

  const listen = (terminalId: string, ...open: number[]) => ports.set(fake.pids.get(terminalId)!, open);
  const minutes = (n: number) => (clock += n * 60_000);

  beforeEach(() => {
    fake = fakeTerminals();
    ports = new Map();
    clock = Date.parse('2026-11-12T10:00:00Z');
    service = build();
  });

  it('idle → starting → running → stopping → idle, with /stop typed into the run and the terminal closed at the end', async () => {
    expect(await service.get(project)).toMatchObject({ path: project, phase: 'idle', unavailableReason: null, terminalId: null, ports: [] });

    const started = await service.start(project);
    expect(started).toMatchObject({ phase: 'starting', startedAt: '2026-11-12T10:00:00.000Z', runningSince: null });
    expect(fake.created).toEqual([{ cwd: project, label: 'loja · run', cols: 120, rows: 32 }]);
    const id = started.terminalId!;

    minutes(1);
    expect((await service.get(project)).phase).toBe('starting');
    listen(id, 5173, 3000);
    expect(await service.get(project)).toMatchObject({ phase: 'running', runningSince: '2026-11-12T10:01:00.000Z', ports: [5173, 3000] });
    minutes(10);
    expect((await service.get(project)).runningSince).toBe('2026-11-12T10:01:00.000Z');

    const stopping = await service.stop(project);
    expect(stopping.phase).toBe('stopping');
    expect(fake.typed).toEqual([{ id, text: '/stop' }]);
    // A second click while stopping changes nothing.
    expect((await service.stop(project)).phase).toBe('stopping');
    expect((await service.get(project)).phase).toBe('stopping');

    listen(id); // the /stop closed the ports
    await vi.waitFor(() => expect(fake.terminals.close).toHaveBeenCalledWith(id));
    expect(fake.terminals.waitForQuiet).toHaveBeenCalledWith(id, expect.objectContaining({ quietMs: 2_000 }));
    expect(await service.get(project)).toMatchObject({ phase: 'idle', terminalId: null });
  });

  it('the safety net: ports still open after the grace period → the terminal is closed anyway', async () => {
    const { terminalId } = await service.start(project);
    listen(terminalId!, 5173);
    await service.get(project);
    const before = Date.now();
    await service.stop(project);
    await vi.waitFor(() => expect(fake.terminals.close).toHaveBeenCalledWith(terminalId));
    expect(Date.now() - before).toBeGreaterThanOrEqual(250);
    expect(fake.terminals.waitForQuiet).not.toHaveBeenCalled();
    expect((await service.get(project)).phase).toBe('idle');
  });

  it('"Não arrancou": 3 min without a port, or the terminal ending before one', async () => {
    const first = await service.start(project);
    minutes(2.9);
    expect((await service.get(project)).phase).toBe('starting');
    minutes(0.2);
    expect(await service.get(project)).toMatchObject({ phase: 'failed', error: 'no-port', terminalId: first.terminalId });

    const second = await service.start(project);
    // Correr after a failure closes the old terminal and starts another.
    expect(fake.terminals.close).toHaveBeenCalledWith(first.terminalId);
    fake.exit(second.terminalId!);
    expect(await service.get(project)).toMatchObject({ phase: 'failed', error: 'exited' });
  });

  it('"Parou sozinha": the ports go while running, or the terminal ends while running', async () => {
    const run = await service.start(project);
    listen(run.terminalId!, 5173);
    await service.get(project);
    listen(run.terminalId!);
    expect(await service.get(project)).toMatchObject({ phase: 'failed', error: 'ports-gone', ports: [] });

    // Parar on a failed run just closes it.
    expect((await service.stop(project)).phase).toBe('idle');
    expect(fake.terminals.close).toHaveBeenCalledWith(run.terminalId);
    expect(fake.typed).toEqual([]);

    const again = await service.start(project);
    listen(again.terminalId!, 5173);
    await service.get(project);
    fake.exit(again.terminalId!);
    expect(await service.get(project)).toMatchObject({ phase: 'failed', error: 'ports-gone' });
  });

  it('a pid of 0 (the process is not up yet, ADR 0029) reads as no port, never as devPortsOf(0)', async () => {
    const devPorts = vi.fn(async () => [{ port: 1, pid: 0, process: 'System' }]);
    service = build({ devPorts });
    const { terminalId } = await service.start(project);
    fake.pids.set(terminalId!, 0);
    expect((await service.get(project)).phase).toBe('starting');
    expect(devPorts).not.toHaveBeenCalled();
  });

  it('one run per project: a second Correr is APPRUN_001, also while the first is still being created', async () => {
    await service.start(project);
    await expectAppError(() => service.start(project), 'APPRUN_001');

    fake = fakeTerminals();
    service = build();
    const both = await Promise.allSettled([service.start(project), service.start(project)]);
    expect(both.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(fake.created).toHaveLength(1);
  });

  it('a terminal limit (or any create error) leaves no run behind', async () => {
    fake.terminals.createAppRun.mockRejectedValueOnce(new AppError('TERMINAL_002'));
    await expectAppError(() => service.start(project), 'TERMINAL_002');
    expect((await service.get(project)).phase).toBe('idle');
    expect((await service.start(project)).phase).toBe('starting');
  });

  it('unavailable: without both skills (APPRUN_002), and the Workflow App itself — even a folder below it (APPRUN_004)', async () => {
    expect(await service.get(bare)).toMatchObject({ phase: 'unavailable', unavailableReason: 'missing-skills' });
    await expectAppError(() => service.start(bare), 'APPRUN_002');

    expect(await service.get(self)).toMatchObject({ phase: 'unavailable', unavailableReason: 'self' });
    await expectAppError(() => service.start(self), 'APPRUN_004');
    mkdirSync(join(self, 'frontend'), { recursive: true });
    await expectAppError(() => service.start(join(self, 'frontend')), 'APPRUN_004');
    expect(fake.created).toEqual([]);
  });

  it('only folders inside ALLOWED_ROOTS (FOLDER_001), and the same project whatever the casing on Windows', async () => {
    await expectAppError(() => service.get(outside), 'FOLDER_001');
    await expectAppError(() => service.start(join(root, '..', 'outside')), 'FOLDER_001');
    await expectAppError(() => service.start('relative/path'), 'FOLDER_001');
    if (process.platform === 'win32') {
      await service.start(project);
      await expectAppError(() => service.start(project.toUpperCase()), 'APPRUN_001');
    }
  });

  it('Parar and Ver terminal without a run are APPRUN_003', async () => {
    await expectAppError(() => service.stop(project), 'APPRUN_003');
    await expectAppError(() => service.reveal(project), 'APPRUN_003');
  });

  it('Ver terminal reveals the hidden terminal; closing it from the grid ends the run', async () => {
    const run = await service.start(project);
    minutes(4);
    expect((await service.get(project)).error).toBe('no-port');
    expect(await service.reveal(project)).toEqual({ terminalId: run.terminalId });
    expect(fake.views.get(run.terminalId!)?.hidden).toBe(false);
    // The run stays failed while the owner looks at it…
    expect((await service.get(project)).phase).toBe('failed');

    // …and a running one whose terminal is closed from elsewhere is simply gone.
    const again = await service.start(project);
    await fake.terminals.close(again.terminalId!);
    expect(await service.get(project)).toMatchObject({ phase: 'idle', terminalId: null });
  });

  it('while the terminal is still being closed the run stays "stopping", and Correr is a 409 — never a second terminal', async () => {
    let finishClose!: () => void;
    const run = await service.start(project);
    fake.terminals.close.mockImplementationOnce(async (id: string) => {
      await new Promise<void>((resolve) => (finishClose = resolve));
      fake.views.delete(id);
    });
    await service.stop(project);
    await vi.waitFor(() => expect(fake.terminals.close).toHaveBeenCalledWith(run.terminalId));
    expect((await service.get(project)).phase).toBe('stopping');
    await expectAppError(() => service.start(project), 'APPRUN_001');

    finishClose();
    await vi.waitFor(async () => expect((await service.get(project)).phase).toBe('idle'));
    expect(fake.created).toHaveLength(1);
  });

  it('a /stop that cannot be typed (the terminal already ended) closes straight away', async () => {
    const run = await service.start(project);
    listen(run.terminalId!, 5173);
    await service.get(project);
    fake.views.get(run.terminalId!)!.status = 'exited';
    expect((await service.stop(project)).phase).toBe('stopping');
    await vi.waitFor(() => expect(fake.terminals.close).toHaveBeenCalledWith(run.terminalId));
    expect(fake.terminals.waitForQuiet).not.toHaveBeenCalled();
  });
});
