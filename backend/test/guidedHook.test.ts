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
function runHook(input: object): { child: ChildProcess; done: Promise<{ stdout: string; code: number | null }> } {
  const child = spawn(process.execPath, [hookPath], { stdio: ['pipe', 'pipe', 'pipe'] });
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
    expect(settings.hooks.PreToolUse).toEqual([{ matcher: 'AskUserQuestion', hooks: [expect.objectContaining({ timeout: BLOCKING_HOOK_TIMEOUT_S })] }]);
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
