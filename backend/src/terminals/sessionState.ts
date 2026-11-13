import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What a normal terminal's `claude` is doing, from its hooks (ADR 0031): a non-blocking hook in the common
 * claude-settings.json records the last event that matters, per terminal, in DATA_DIR/session-state/<id>/.
 * The terminal is named by WFA_TERMINAL_ID, set on the PTY only for normal terminals — it survives /clear and
 * /resume inside the TUI, which change the session_id.
 */
export const SESSION_STATE_FILES = {
  hook: 'session-hook.cjs',
  /** `<terminal id>/state.json` = `{ activity, event, at }`. */
  dir: 'session-state',
  state: 'state.json',
} as const;

/** The env var that ties a hook to a terminal. Never inherited from the backend (spawnClaude.ts denylist). */
export const TERMINAL_ID_ENV = 'WFA_TERMINAL_ID';

export const TERMINAL_ACTIVITIES = ['working', 'needs-you', 'waiting'] as const;
export type TerminalActivity = (typeof TERMINAL_ACTIVITIES)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Runs inside Claude Code at every hook of a normal terminal. It must never fail, never be slow, never print and
 * never decide: output can hold the turn or answer a permission. Without a UUID in WFA_TERMINAL_ID (a login, an
 * app run, a claude started by hand) it does nothing. Only the event, the activity and the time are kept.
 *
 * Mapping (ADR 0031 point 3): SessionStart/Stop → waiting · UserPromptSubmit/PostToolUse → working ·
 * PermissionRequest, PreToolUse(AskUserQuestion), Notification other than idle_prompt → needs-you. A Notification
 * without notification_type (older CLIs) right after a Stop is the idle one, as in the guided hook.
 */
function hookScript(stateDir: string): string {
  return `// Written by the Workflow App backend at startup (backend/src/terminals/sessionState.ts). Do not edit.
const fs = require('node:fs');
const path = require('node:path');
const STATE_DIR = ${JSON.stringify(stateDir)};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = process.env.${TERMINAL_ID_ENV};
function writeAtomic(file, body) {
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, body);
  fs.renameSync(tmp, file);
}
function activityOf(data, dir) {
  switch (data.hook_event_name) {
    case 'SessionStart':
    case 'Stop':
      return 'waiting';
    case 'UserPromptSubmit':
    case 'PostToolUse':
      return 'working';
    case 'PermissionRequest':
      return 'needs-you';
    case 'PreToolUse':
      return data.tool_name === 'AskUserQuestion' ? 'needs-you' : null;
    case 'Notification': {
      if (data.notification_type === 'idle_prompt') return null;
      if (!data.notification_type) {
        try {
          if (JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8')).event === 'Stop') return null;
        } catch {}
      }
      return 'needs-you';
    }
    default:
      return null;
  }
}
if (typeof id === 'string' && UUID.test(id)) {
  let input = '';
  process.stdin.on('data', (chunk) => (input += chunk));
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input);
      const dir = path.join(STATE_DIR, id.toLowerCase());
      const activity = activityOf(data, dir);
      if (!activity) return;
      fs.mkdirSync(dir, { recursive: true });
      writeAtomic(path.join(dir, 'state.json'), JSON.stringify({ activity, event: data.hook_event_name, at: new Date().toISOString() }));
    } catch {}
  });
} else {
  process.stdin.resume();
}
`;
}

/** The `hooks` entry of claude-settings.json: every event the hook reads, all pointing at the same command. */
export function sessionStateHooks(dataDir: string) {
  const command = { type: 'command', command: `"${process.execPath}" "${join(dataDir, SESSION_STATE_FILES.hook)}"` };
  const all = [{ hooks: [command] }];
  return {
    SessionStart: all,
    UserPromptSubmit: all,
    PreToolUse: [{ matcher: 'AskUserQuestion', hooks: [command] }],
    PostToolUse: all,
    PermissionRequest: all,
    Notification: all,
    Stop: all,
  };
}

/** Writes the hook into DATA_DIR (every start: it is ours). */
export function writeSessionHook(dataDir: string): void {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, SESSION_STATE_FILES.hook), hookScript(join(dataDir, SESSION_STATE_FILES.dir)));
}

/** Reads and clears what the hook wrote. Never throws. */
export class SessionStateStore {
  constructor(private readonly dataDir: string) {}

  private dir(terminalId: string): string | null {
    return UUID.test(terminalId) ? join(this.dataDir, SESSION_STATE_FILES.dir, terminalId.toLowerCase()) : null;
  }

  /** The terminal's activity; `waiting` when nothing was recorded yet (the TUI just opened). */
  activity(terminalId: string): TerminalActivity {
    const dir = this.dir(terminalId);
    if (!dir) return 'waiting';
    try {
      const { activity } = JSON.parse(readFileSync(join(dir, SESSION_STATE_FILES.state), 'utf8')) as { activity?: unknown };
      return TERMINAL_ACTIVITIES.includes(activity as TerminalActivity) ? (activity as TerminalActivity) : 'waiting';
    } catch {
      return 'waiting';
    }
  }

  /** Before a launch (an old run's events must not show) and when the terminal goes away. */
  clear(terminalId: string): void {
    const dir = this.dir(terminalId);
    if (!dir) return;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // A file held open on Windows: the next launch clears it again.
    }
  }
}
