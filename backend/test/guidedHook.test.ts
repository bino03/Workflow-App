import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { BLOCKING_HOOK_TIMEOUT_S, GUIDED_FILES, permissionRulePath, writeGuidedFiles } from '../src/guided/guidedFiles.js';
import { waitFor } from './fakeClaude.js';
import { removeDir } from './helpers.js';

const dataDir = mkdtempSync(join(tmpdir(), 'wfa-guided-hook-'));
const root = join(tmpdir(), 'wfa-root');
const settingsPath = writeGuidedFiles(dataDir, [root]);
const hookPath = join(dataDir, GUIDED_FILES.hook);
const guidedDir = join(dataDir, GUIDED_FILES.dir);
afterAll(() => removeDir(dataDir));

/** A guided session folder and its by-session index, as GuidedService.start leaves them. */
function session() {
  const id = randomUUID();
  const sessionId = randomUUID();
  const dir = join(guidedDir, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(guidedDir, GUIDED_FILES.bySession, sessionId), id);
  return { id, sessionId, dir };
}

/** Runs the hook with `input` on stdin; resolves with what it printed once it exits. */
function runHook(input: object, hook = hookPath): { child: ChildProcess; done: Promise<{ stdout: string; code: number | null }> } {
  const child = spawn(process.execPath, [hook], { stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  child.stdout!.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
  const done = new Promise<{ stdout: string; code: number | null }>((resolve) => child.on('exit', (code) => resolve({ stdout, code })));
  child.stdin!.end(JSON.stringify(input));
  return { child, done };
}

const event = (dir: string) => (JSON.parse(readFileSync(join(dir, 'event.json'), 'utf8')) as { event: string }).event;
const pendingFiles = (dir: string) => readdirSync(dir).filter((name) => name.startsWith('pending-'));

describe('guided --settings', () => {
  it('permission rule paths: // + POSIX, the drive as /c', () => {
    expect(permissionRulePath('C:\\Users\\me\\data\\guided')).toBe('//c/Users/me/data/guided');
    expect(permissionRulePath('/home/me/data/')).toBe('//home/me/data');
  });

  it('blocking hooks for AskUserQuestion and PermissionRequest, writing in guided/ and reading in the roots', () => {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    expect(settings.permissions.allow).toEqual([`Edit(${permissionRulePath(guidedDir)}/**)`, `Read(${permissionRulePath(root)}/**)`]);
    expect(settings.hooks.PreToolUse).toEqual([
      { matcher: 'AskUserQuestion', hooks: [expect.objectContaining({ timeout: BLOCKING_HOOK_TIMEOUT_S })] },
      // Not blocking: it only denies WebFetch to the Upwork in upwork sessions (ADR 0022).
      { matcher: 'WebFetch', hooks: [expect.not.objectContaining({ timeout: expect.anything() })] },
    ]);
    expect(settings.hooks.PermissionRequest[0].hooks[0].timeout).toBe(BLOCKING_HOOK_TIMEOUT_S);
    expect(Object.keys(settings.hooks).sort()).toEqual(['Notification', 'PermissionRequest', 'PreToolUse', 'Stop', 'UserPromptSubmit']);
    expect(settings.statusLine).toBeDefined();
  });
});

describe('guided-hook.cjs', () => {
  it('ignores a session that is not guided, and a session_id that is not a UUID — prints nothing', async () => {
    const before = readdirSync(guidedDir).length;
    for (const input of [
      { session_id: randomUUID(), hook_event_name: 'Stop' },
      { session_id: '../../x', hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: { questions: [] } },
      { session_id: randomUUID(), hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'ls' } },
    ]) {
      const { stdout, code } = await runHook(input).done;
      expect({ stdout, code }).toEqual({ stdout: '', code: 0 });
    }
    expect(readdirSync(guidedDir)).toHaveLength(before);
  });

  it('records Stop and UserPromptSubmit; a Notification right after a Stop is idle, not recorded', async () => {
    const { sessionId, dir } = session();
    await runHook({ session_id: sessionId, hook_event_name: 'Stop' }).done;
    expect(event(dir)).toBe('Stop');
    await runHook({ session_id: sessionId, hook_event_name: 'Notification', message: 'Claude is waiting for your input' }).done;
    expect(event(dir)).toBe('Stop');
    await runHook({ session_id: sessionId, hook_event_name: 'UserPromptSubmit', prompt: 'x' }).done;
    expect(event(dir)).toBe('UserPromptSubmit');
    const { stdout } = await runHook({ session_id: sessionId, hook_event_name: 'Notification', message: 'needs permission' }).done;
    expect(event(dir)).toBe('Notification');
    expect(stdout).toBe('');
  });

  it('AskUserQuestion: writes the pending question, waits, answers with updatedInput.answers, cleans up', async () => {
    const { sessionId, dir } = session();
    const questions = [{ question: 'Which colour?', header: 'Colour', multiSelect: false, options: [{ label: 'Red', description: '' }] }];
    const { child, done } = runHook({ session_id: sessionId, hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: { questions } });
    await waitFor(() => pendingFiles(dir).length === 1);
    const pending = JSON.parse(readFileSync(join(dir, pendingFiles(dir)[0]!), 'utf8'));
    expect(pending).toMatchObject({ type: 'question', questions, pid: child.pid });
    expect(pendingFiles(dir)[0]).toBe(`pending-${pending.requestId}.json`);

    writeFileSync(join(dir, `answer-${pending.requestId}.json`), JSON.stringify({ requestId: pending.requestId, answers: { 'Which colour?': 'Red' } }));
    const { stdout, code } = await done;
    expect(code).toBe(0);
    expect(JSON.parse(stdout)).toEqual({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput: { questions, answers: { 'Which colour?': 'Red' } } },
    });
    expect(readdirSync(dir).filter((name) => name !== 'event.json')).toEqual([]);
    expect(event(dir)).toBe('Answered');
  });

  it('PermissionRequest: a summary instead of the whole input; allow and deny in the spike format', async () => {
    const { sessionId, dir } = session();
    for (const decision of ['allow', 'deny'] as const) {
      const { done } = runHook({ session_id: sessionId, hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'git init', description: 'x' } });
      await waitFor(() => pendingFiles(dir).length === 1);
      const pending = JSON.parse(readFileSync(join(dir, pendingFiles(dir)[0]!), 'utf8'));
      expect(pending).toMatchObject({ type: 'permission', tool: 'Bash', summary: 'git init' });
      writeFileSync(join(dir, `answer-${pending.requestId}.json`), JSON.stringify({ requestId: pending.requestId, decision }));
      const out = JSON.parse((await done).stdout);
      expect(out.hookSpecificOutput.hookEventName).toBe('PermissionRequest');
      expect(out.hookSpecificOutput.decision.behavior).toBe(decision);
    }
  });

  it('a Write permission shows the path, not the content', async () => {
    const { sessionId, dir } = session();
    const { done } = runHook({ session_id: sessionId, hook_event_name: 'PermissionRequest', tool_name: 'Write', tool_input: { file_path: 'C:\\p\\a.md', content: 'secret' } });
    await waitFor(() => pendingFiles(dir).length === 1);
    const raw = readFileSync(join(dir, pendingFiles(dir)[0]!), 'utf8');
    expect(JSON.parse(raw).summary).toBe('C:\\p\\a.md');
    expect(raw).not.toContain('secret');
    rmSync(dir, { recursive: true, force: true });
    await done;
  });

  it('the folder disappearing (a cancel) ends the wait without a decision', async () => {
    const { sessionId, dir } = session();
    const { done } = runHook({ session_id: sessionId, hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: { questions: [] } });
    await waitFor(() => pendingFiles(dir).length === 1);
    rmSync(dir, { recursive: true, force: true });
    expect(await done).toEqual({ stdout: '', code: 0 });
    expect(existsSync(dir)).toBe(false);
  });
});

describe('guided-hook.cjs — permissions without a card (ADR 0021)', () => {
  const controlDir = join(dataDir, GUIDED_FILES.control);

  function control(id: string, mode: 'ask' | 'auto', startedAt = new Date(Date.now() - 1000).toISOString()) {
    writeFileSync(join(controlDir, `${id}.json`), JSON.stringify({ version: 1, mode, startedAt }));
  }

  function declare(dir: string, projectPath: string) {
    writeFileSync(join(dir, GUIDED_FILES.destination), JSON.stringify({ version: 1, projectPath }));
  }

  /** The hook decides alone: allow, and no pending file. */
  async function allowsAlone(sessionId: string, dir: string, tool: string, toolInput: object) {
    const { stdout } = await runHook({ session_id: sessionId, hook_event_name: 'PermissionRequest', tool_name: tool, tool_input: toolInput }).done;
    expect(JSON.parse(stdout).hookSpecificOutput.decision).toEqual({ behavior: 'allow' });
    expect(pendingFiles(dir)).toEqual([]);
  }

  /** The hook asks the owner: a pending file appears (answered here with deny, to end it). */
  async function asks(sessionId: string, dir: string, tool: string, toolInput: object) {
    const { done } = runHook({ session_id: sessionId, hook_event_name: 'PermissionRequest', tool_name: tool, tool_input: toolInput });
    await waitFor(() => pendingFiles(dir).length === 1);
    const { requestId } = JSON.parse(readFileSync(join(dir, pendingFiles(dir)[0]!), 'utf8'));
    writeFileSync(join(dir, `answer-${requestId}.json`), JSON.stringify({ requestId, decision: 'deny' }));
    expect(JSON.parse((await done).stdout).hookSpecificOutput.decision.behavior).toBe('deny');
  }

  it('auto: any permission is allowed without a card; ask (or no control file) still asks', async () => {
    const { id, sessionId, dir } = session();
    await asks(sessionId, dir, 'Bash', { command: 'git init' });
    control(id, 'ask');
    await asks(sessionId, dir, 'Bash', { command: 'git init' });
    control(id, 'auto');
    await allowsAlone(sessionId, dir, 'Bash', { command: 'git init' });
    await allowsAlone(sessionId, dir, 'Write', { file_path: join(tmpdir(), 'anywhere.md'), content: 'x' });
  });

  it('a new destination inside a root: file tools inside it are allowed; Bash and paths outside still ask', async () => {
    const { id, sessionId, dir } = session();
    const dest = join(root, `novo-${randomUUID()}`);
    control(id, 'ask');
    declare(dir, dest);
    await allowsAlone(sessionId, dir, 'Write', { file_path: join(dest, 'docs', 'a.md'), content: 'x' });
    await allowsAlone(sessionId, dir, 'Edit', { file_path: join(dest, 'README.md'), old_string: 'a', new_string: 'b' });
    await allowsAlone(sessionId, dir, 'Glob', { pattern: '**/*', path: dest });
    await allowsAlone(sessionId, dir, 'Read', { file_path: join(dest.toUpperCase(), 'x.md') });
    await asks(sessionId, dir, 'Bash', { command: `git -C "${dest}" init` });
    await asks(sessionId, dir, 'Write', { file_path: join(root, 'outro', 'a.md'), content: 'x' });
    await asks(sessionId, dir, 'Write', { file_path: join(dest, '..', 'fora.md'), content: 'x' });
    await asks(sessionId, dir, 'Grep', { pattern: 'x' });
  });

  it('a destination the app does not accept keeps asking: a root, outside the roots, relative, an older folder, no start', async () => {
    const older = join(root, `antigo-${randomUUID()}`);
    mkdirSync(older, { recursive: true });
    const cases: { projectPath: string; startedAt?: string; noControl?: boolean }[] = [
      { projectPath: root },
      { projectPath: join(tmpdir(), `fora-${randomUUID()}`) },
      { projectPath: 'relativo/x' },
      // Born before the session started: a project that already existed.
      { projectPath: older, startedAt: new Date(Date.now() + 60_000).toISOString() },
      { projectPath: join(root, `novo-${randomUUID()}`), noControl: true },
    ];
    try {
      for (const c of cases) {
        const { id, sessionId, dir } = session();
        if (!c.noControl) control(id, 'ask', c.startedAt);
        declare(dir, c.projectPath);
        await asks(sessionId, dir, 'Write', { file_path: join(c.projectPath, 'a.md'), content: 'x' });
      }
    } finally {
      removeDir(older);
    }
  });
});

describe('guided-hook.cjs — the Workflow and DATA_DIR are never a destination (ADR 0021)', () => {
  // DATA_DIR and the Workflow inside the root: the only way a declared destination could reach them.
  const root2 = mkdtempSync(join(tmpdir(), 'wfa-root2-'));
  const dataDir2 = join(root2, 'data');
  const workflow = join(root2, 'Workflow');
  writeGuidedFiles(dataDir2, [root2], workflow);
  const hook2 = join(dataDir2, GUIDED_FILES.hook);
  afterAll(() => removeDir(root2));

  it('a destination that is, contains or sits inside the Workflow or DATA_DIR asks', async () => {
    for (const projectPath of [workflow, join(workflow, 'projects'), dataDir2, join(dataDir2, 'guided', 'x'), root2]) {
      const id = randomUUID();
      const sessionId = randomUUID();
      const dir = join(dataDir2, GUIDED_FILES.dir, id);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dataDir2, GUIDED_FILES.dir, GUIDED_FILES.bySession, sessionId), id);
      writeFileSync(join(dataDir2, GUIDED_FILES.control, `${id}.json`), JSON.stringify({ version: 1, mode: 'ask', startedAt: new Date(Date.now() - 1000).toISOString() }));
      writeFileSync(join(dir, GUIDED_FILES.destination), JSON.stringify({ version: 1, projectPath }));
      const { done } = runHook({ session_id: sessionId, hook_event_name: 'PermissionRequest', tool_name: 'Write', tool_input: { file_path: join(projectPath, 'a.md'), content: 'x' } }, hook2);
      await waitFor(() => pendingFiles(dir).length === 1);
      rmSync(dir, { recursive: true, force: true });
      expect((await done).stdout).toBe('');
    }
    // The control: the same setup with a fresh folder next to them is allowed.
    const id = randomUUID();
    const sessionId = randomUUID();
    const dir = join(dataDir2, GUIDED_FILES.dir, id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dataDir2, GUIDED_FILES.dir, GUIDED_FILES.bySession, sessionId), id);
    writeFileSync(join(dataDir2, GUIDED_FILES.control, `${id}.json`), JSON.stringify({ version: 1, mode: 'ask', startedAt: new Date(Date.now() - 1000).toISOString() }));
    writeFileSync(join(dir, GUIDED_FILES.destination), JSON.stringify({ version: 1, projectPath: join(root2, 'Novo') }));
    const { stdout } = await runHook({ session_id: sessionId, hook_event_name: 'PermissionRequest', tool_name: 'Write', tool_input: { file_path: join(root2, 'Novo', 'a.md'), content: 'x' } }, hook2).done;
    expect(JSON.parse(stdout).hookSpecificOutput.decision).toEqual({ behavior: 'allow' });
  });
});

describe('guided-hook.cjs — upwork sessions never open the Upwork (ADR 0022)', () => {
  const controlDir = join(dataDir, GUIDED_FILES.control);
  const control = (id: string, purpose?: string) =>
    writeFileSync(join(controlDir, `${id}.json`), JSON.stringify({ version: 1, mode: 'auto', startedAt: new Date().toISOString(), ...(purpose ? { purpose } : {}) }));
  const webFetch = (sessionId: string, url: unknown) =>
    runHook({ session_id: sessionId, hook_event_name: 'PreToolUse', tool_name: 'WebFetch', tool_input: { url, prompt: 'x' } }).done;

  it('WebFetch to upwork.com or a subdomain is denied — even in Automático', async () => {
    const { id, sessionId } = session();
    control(id, 'upwork');
    for (const url of ['https://www.upwork.com/jobs/~01abc', 'https://upwork.com/', 'http://WWW.UPWORK.COM./freelance-jobs', 'https://community.upwork.com/x']) {
      const { stdout } = await webFetch(sessionId, url);
      expect(JSON.parse(stdout).hookSpecificOutput).toMatchObject({ hookEventName: 'PreToolUse', permissionDecision: 'deny' });
    }
  });

  it('other hosts, look-alikes and odd input are left to Claude Code (no output)', async () => {
    const { id, sessionId } = session();
    control(id, 'upwork');
    for (const url of ['https://react.dev/learn', 'https://notupwork.com/', 'https://upwork.com.evil.example/', 'not a url', 42]) {
      expect(await webFetch(sessionId, url)).toEqual({ stdout: '', code: 0 });
    }
  });

  it('only in upwork sessions: a create session, or a control file without a purpose, fetches freely', async () => {
    for (const purpose of ['create', undefined]) {
      const { id, sessionId } = session();
      control(id, purpose);
      expect(await webFetch(sessionId, 'https://www.upwork.com/jobs/~01abc')).toEqual({ stdout: '', code: 0 });
    }
  });
});
