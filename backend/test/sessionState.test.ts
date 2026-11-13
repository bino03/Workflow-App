import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaudeSessions } from '../src/sessions/claudeSessions.js';
import { StateStore } from '../src/state/stateStore.js';
import { SESSION_STATE_FILES, SessionStateStore, sessionStateHooks, writeSessionHook } from '../src/terminals/sessionState.js';
import { launchEnv } from '../src/terminals/spawnClaude.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { TerminalsService } from '../src/terminals/terminalsService.js';
import { USAGE_FILES, writeUsageFiles } from '../src/usage/usageFiles.js';
import { fakeClaude, waitFor } from './fakeClaude.js';
import { removeDir } from './helpers.js';

const TERMINAL = '6f1f2a7e-3b0c-4c8e-9a51-2d7f0e4b9c11';
const SESSION = '118f54da-0c1d-4b6a-9f0e-1a2b3c4d5e6f';

let dataDir: string;
let hookPath: string;
beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'wfa-session-state-'));
  writeSessionHook(dataDir);
  hookPath = join(dataDir, SESSION_STATE_FILES.hook);
});
afterEach(() => removeDir(dataDir));

/** Runs the real hook with a JSON payload on stdin and the env a claude of the app would give it. */
function runHook(payload: object, env: Record<string, string> = { WFA_TERMINAL_ID: TERMINAL }) {
  const result = spawnSync(process.execPath, [hookPath], {
    input: JSON.stringify({ session_id: SESSION, ...payload }),
    env: { PATH: process.env.PATH ?? '', ...env },
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout };
}
const stateFile = (id = TERMINAL) => join(dataDir, SESSION_STATE_FILES.dir, id, SESSION_STATE_FILES.state);
const recorded = () => JSON.parse(readFileSync(stateFile(), 'utf8')) as { activity: string; event: string; at: string };

describe('session-hook.cjs (ADR 0031)', () => {
  it('maps each event to the activity, prints nothing and always exits 0', () => {
    const cases: [object, string][] = [
      [{ hook_event_name: 'SessionStart', source: 'startup' }, 'waiting'],
      [{ hook_event_name: 'UserPromptSubmit', prompt: 'olá' }, 'working'],
      [{ hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'ls' } }, 'needs-you'],
      [{ hook_event_name: 'PostToolUse', tool_name: 'Bash' }, 'working'],
      [{ hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion' }, 'needs-you'],
      [{ hook_event_name: 'Stop', last_assistant_message: 'feito' }, 'waiting'],
      [{ hook_event_name: 'Notification', notification_type: 'permission_prompt', message: 'Claude needs your permission' }, 'needs-you'],
    ];
    for (const [payload, activity] of cases) {
      const { status, stdout } = runHook(payload);
      expect(status).toBe(0);
      expect(stdout).toBe('');
      expect(recorded().activity, JSON.stringify(payload)).toBe(activity);
    }
    // Only the event, the activity and the time — never the prompt, the message or the tool input.
    expect(Object.keys(recorded()).sort()).toEqual(['activity', 'at', 'event']);
    expect(readFileSync(stateFile(), 'utf8')).not.toContain('olá');
  });

  it('the idle notification (60 s after Stop) keeps "waiting"; so does an untyped one right after Stop', () => {
    runHook({ hook_event_name: 'Stop' });
    runHook({ hook_event_name: 'Notification', notification_type: 'idle_prompt', message: 'Claude is waiting for your input' });
    expect(recorded()).toMatchObject({ activity: 'waiting', event: 'Stop' });
    runHook({ hook_event_name: 'Notification', message: 'Claude is waiting for your input' });
    expect(recorded()).toMatchObject({ activity: 'waiting', event: 'Stop' });
    // Untyped, but in the middle of a turn: a permission.
    runHook({ hook_event_name: 'UserPromptSubmit' });
    runHook({ hook_event_name: 'Notification', message: 'Claude needs your permission to use Bash' });
    expect(recorded().activity).toBe('needs-you');
  });

  it('other tools before they run, SessionEnd and unknown events change nothing', () => {
    runHook({ hook_event_name: 'UserPromptSubmit' });
    runHook({ hook_event_name: 'PreToolUse', tool_name: 'Bash' });
    runHook({ hook_event_name: 'SessionEnd', reason: 'clear' });
    runHook({ hook_event_name: 'SomethingNew' });
    expect(recorded()).toMatchObject({ activity: 'working', event: 'UserPromptSubmit' });
  });

  it('without WFA_TERMINAL_ID, or with one that is not a UUID, it writes nothing', () => {
    expect(runHook({ hook_event_name: 'Stop' }, {}).status).toBe(0);
    expect(runHook({ hook_event_name: 'Stop' }, { WFA_TERMINAL_ID: '../../escape' }).status).toBe(0);
    expect(existsSync(join(dataDir, SESSION_STATE_FILES.dir))).toBe(false);
  });

  it('garbage on stdin is ignored', () => {
    const result = spawnSync(process.execPath, [hookPath], { input: 'not json', env: { WFA_TERMINAL_ID: TERMINAL }, encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('claude-settings.json: the status line plus the hooks, PreToolUse only for AskUserQuestion', () => {
    const settings = JSON.parse(readFileSync(writeUsageFiles(dataDir, sessionStateHooks(dataDir)), 'utf8'));
    const command = { type: 'command', command: `"${process.execPath}" "${hookPath}"` };
    expect(settings.statusLine.command).toContain(USAGE_FILES.script);
    expect(Object.keys(settings.hooks).sort()).toEqual(['Notification', 'PermissionRequest', 'PostToolUse', 'PreToolUse', 'SessionStart', 'Stop', 'UserPromptSubmit']);
    expect(settings.hooks.PreToolUse).toEqual([{ matcher: 'AskUserQuestion', hooks: [command] }]);
    expect(settings.hooks.PostToolUse).toEqual([{ hooks: [command] }]);
    // Without hooks it stays what ADR 0012 had.
    expect(Object.keys(JSON.parse(readFileSync(writeUsageFiles(dataDir), 'utf8')))).toEqual(['statusLine']);
  });
});

describe('SessionStateStore', () => {
  it('waiting with nothing recorded, an odd file or a bad id; clear removes the folder', () => {
    const store = new SessionStateStore(dataDir);
    expect(store.activity(TERMINAL)).toBe('waiting');
    mkdirSync(join(dataDir, SESSION_STATE_FILES.dir, TERMINAL), { recursive: true });
    writeFileSync(stateFile(), '{"activity":"dancing"}');
    expect(store.activity(TERMINAL)).toBe('waiting');
    writeFileSync(stateFile(), '{"activity":"needs-you"}');
    expect(store.activity(TERMINAL)).toBe('needs-you');
    expect(store.activity('not-a-uuid')).toBe('waiting');
    store.clear(TERMINAL);
    expect(existsSync(join(dataDir, SESSION_STATE_FILES.dir, TERMINAL))).toBe(false);
  });
});

describe('launchEnv and WFA_TERMINAL_ID', () => {
  it('never inherits one from the backend; sets its own only when given', () => {
    const env = { PATH: 'C:\\bin', WFA_TERMINAL_ID: 'inherited', wfa_terminal_id: 'inherited' };
    expect(launchEnv(undefined, env)).toEqual({ PATH: 'C:\\bin', TERM: 'xterm-256color', COLORTERM: 'truecolor' });
    expect(launchEnv(undefined, env, TERMINAL)).toEqual({ PATH: 'C:\\bin', WFA_TERMINAL_ID: TERMINAL, TERM: 'xterm-256color', COLORTERM: 'truecolor' });
  });
});

describe('TerminalsService activity (ADR 0031)', () => {
  const base = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfa-activity-')));
  const root = join(base, 'root');
  const project = join(root, 'api');
  mkdirSync(project, { recursive: true });
  const sessions = new ClaudeSessions(join(base, 'claude'));
  const size = { cols: 100, rows: 30 };
  afterAll(() => removeDir(base));

  let stateStore: StateStore;
  let manager: TerminalManager;
  let claude: ReturnType<typeof fakeClaude>;
  let store: SessionStateStore;
  let service: TerminalsService;
  beforeEach(async () => {
    stateStore = await StateStore.load(dataDir);
    claude = fakeClaude();
    manager = new TerminalManager({ spawn: claude.spawn, maxTerminals: 3, scrollbackBytes: 64 * 1024 });
    store = new SessionStateStore(dataDir);
    service = new TerminalsService({ stateStore, terminalManager: manager, sessions, allowedRoots: [root], sessionState: store });
  });
  afterEach(async () => {
    await manager.killAll();
    await stateStore.flush();
  });
  const record = (id: string, activity: string) => {
    mkdirSync(join(dataDir, SESSION_STATE_FILES.dir, id), { recursive: true });
    writeFileSync(join(dataDir, SESSION_STATE_FILES.dir, id, SESSION_STATE_FILES.state), JSON.stringify({ activity }));
  };

  it('a normal terminal gets its id as stateId, starts "waiting", then shows what the hook recorded', async () => {
    const view = await service.create({ cwd: project, mode: 'new', ...size });
    expect(claude.launches.at(-1)).toMatchObject({ stateId: view.id });
    expect(view.activity).toBe('waiting');
    record(view.id, 'working');
    expect(service.get(view.id)!.activity).toBe('working');
    expect(service.list()[0]!.activity).toBe('working');
  });

  it('an exited terminal has no activity; reopening clears the old run, closing removes it', async () => {
    const view = await service.create({ cwd: project, mode: 'new', ...size });
    record(view.id, 'needs-you');
    manager.write(view.id, 'q');
    await waitFor(() => service.get(view.id)!.status === 'exited');
    expect(service.get(view.id)!.activity).toBeNull();

    const reopened = await service.reopen(view.id, size);
    expect(claude.launches.at(-1)).toMatchObject({ stateId: view.id });
    expect(reopened.activity).toBe('waiting');

    record(view.id, 'working');
    await service.close(view.id);
    expect(existsSync(join(dataDir, SESSION_STATE_FILES.dir, view.id))).toBe(false);
  });

  it('a login terminal never gets a stateId and shows no activity', async () => {
    const login = await service.createLogin({ accountId: 'primary', cwd: project, label: 'Login', ...size });
    expect(claude.launches.at(-1)!.stateId).toBeUndefined();
    record(login.id, 'working');
    expect(service.get(login.id)!.activity).toBeNull();
  });
});
