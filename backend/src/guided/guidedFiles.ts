import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { statusLineSetting } from '../usage/usageFiles.js';

/**
 * What a guided session's `claude` is launched with (ADR 0020): its own --settings — the quota status line, the
 * hooks, and two narrow permissions — and the hook script, both written into DATA_DIR at startup.
 *
 * A guided session lives in `DATA_DIR/guided/<id>/`: `meta.json` and the input file (ours), `pending-<rid>.json`
 * (the hook, while a question or a permission waits), `answer-<rid>.json` (ours, the owner's answer),
 * `event.json` (the hook, the last non-blocking event) and `result.json` (the skill, at the end).
 * `DATA_DIR/guided/by-session/<session id>` holds the guided id: how the hook finds the folder.
 */
export const GUIDED_FILES = {
  settings: 'claude-guided-settings.json',
  hook: 'guided-hook.cjs',
  dir: 'guided',
  bySession: 'by-session',
} as const;

/** Blocking hooks wait for the owner: an answer may take hours. Proved for 10 min in the spike (ADR 0020 point 5). */
export const BLOCKING_HOOK_TIMEOUT_S = 86_400;

export const GUIDED_EVENTS = ['Stop', 'Notification', 'UserPromptSubmit', 'Answered'] as const;
export type GuidedEvent = (typeof GUIDED_EVENTS)[number];

/**
 * A path as Claude Code's permission rules want an absolute one: `//` + a POSIX path, the Windows drive as
 * `/c` (proved in the step 3 dry run: `Edit(//c/Users/…/**)`).
 */
export function permissionRulePath(path: string): string {
  const posix = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const withDrive = posix.replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`);
  return `/${withDrive}`;
}

/**
 * Runs inside Claude Code at every hook of **any** session launched with this --settings — a session that is not
 * guided (no `by-session` entry) is left alone. It never prints anything but the decision JSON, and never fails:
 * any error means "no decision", and Claude Code shows its own prompt.
 *
 * - PreToolUse(AskUserQuestion) and PermissionRequest block: write `pending-<rid>.json` (with this process's pid,
 *   so the backend can tell a pending that outlived its hook), wait for `answer-<rid>.json`, answer Claude Code.
 *   The folder disappearing (a cancel) ends the wait without a decision.
 * - Stop, UserPromptSubmit, Notification record the last event. A Notification right after a Stop is Claude Code
 *   saying it is idle — the session is already waiting for text, so it is not recorded.
 */
function hookScript(guidedDir: string): string {
  return `// Written by the Workflow App backend at startup (backend/src/guided/guidedFiles.ts). Do not edit.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const GUIDED_DIR = ${JSON.stringify(guidedDir)};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function writeJson(file, data) {
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, file);
}
function lastEvent(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'event.json'), 'utf8')).event; } catch { return null; }
}
function writeEvent(dir, event) {
  writeJson(path.join(dir, 'event.json'), { event, at: new Date().toISOString() });
}
function summarize(tool, input) {
  const i = input && typeof input === 'object' ? input : {};
  if (typeof i.pattern === 'string') return (i.path ? i.pattern + ' em ' + i.path : i.pattern).slice(0, 2000);
  const pick = tool === 'Bash' || tool === 'PowerShell' ? i.command : i.file_path || i.notebook_path || i.url || i.path;
  return String(typeof pick === 'string' ? pick : JSON.stringify(i)).slice(0, 2000);
}

async function main(data) {
  if (!UUID.test(String(data.session_id))) return;
  let guidedId;
  try { guidedId = fs.readFileSync(path.join(GUIDED_DIR, 'by-session', data.session_id.toLowerCase()), 'utf8').trim(); } catch { return; }
  if (!UUID.test(guidedId)) return;
  const dir = path.join(GUIDED_DIR, guidedId.toLowerCase());
  if (!fs.existsSync(dir)) return;
  const event = data.hook_event_name;
  if (event === 'Stop' || event === 'UserPromptSubmit') return writeEvent(dir, event);
  if (event === 'Notification') return lastEvent(dir) === 'Stop' ? undefined : writeEvent(dir, event);

  let pending;
  if (event === 'PreToolUse' && data.tool_name === 'AskUserQuestion') {
    pending = { type: 'question', questions: data.tool_input && data.tool_input.questions };
  } else if (event === 'PermissionRequest') {
    pending = { type: 'permission', tool: String(data.tool_name).slice(0, 200), summary: summarize(data.tool_name, data.tool_input) };
  } else return;
  const requestId = crypto.randomUUID();
  const pendingFile = path.join(dir, 'pending-' + requestId + '.json');
  const answerFile = path.join(dir, 'answer-' + requestId + '.json');
  writeJson(pendingFile, { ...pending, requestId, pid: process.pid, at: new Date().toISOString() });
  let answer;
  while (!answer) {
    if (!fs.existsSync(dir)) return;
    try { answer = JSON.parse(fs.readFileSync(answerFile, 'utf8')); } catch { await sleep(250); }
  }
  fs.rmSync(answerFile, { force: true });
  fs.rmSync(pendingFile, { force: true });
  writeEvent(dir, 'Answered');
  const out = event === 'PreToolUse'
    ? { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput: { ...data.tool_input, answers: answer.answers } } }
    : { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: answer.decision === 'allow' ? { behavior: 'allow' } : { behavior: 'deny', message: 'O dono recusou na Workflow App.' } } };
  process.stdout.write(JSON.stringify(out));
}

let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { return; }
  main(data).catch(() => {});
});
`;
}

/**
 * Writes the guided sessions' settings and hook into DATA_DIR (every start). Returns the --settings path.
 * Two permissions keep reads and the session's own files from asking (step 3 dry run): writing in
 * `DATA_DIR/guided/**` (result.json, the renderer's config), and reading inside each ALLOWED_ROOTS (does the
 * destination exist?). Writing anywhere else still asks — that is the owner's Allow/Refuse card.
 */
export function writeGuidedFiles(dataDir: string, readRoots: readonly string[]): string {
  const guidedDir = join(dataDir, GUIDED_FILES.dir);
  mkdirSync(join(guidedDir, GUIDED_FILES.bySession), { recursive: true });
  const hook = join(dataDir, GUIDED_FILES.hook);
  const settings = join(dataDir, GUIDED_FILES.settings);
  writeFileSync(hook, hookScript(guidedDir));
  const command = { type: 'command', command: `"${process.execPath}" "${hook}"` };
  const blocking = { ...command, timeout: BLOCKING_HOOK_TIMEOUT_S };
  const content = {
    statusLine: statusLineSetting(dataDir),
    permissions: {
      allow: [`Edit(${permissionRulePath(guidedDir)}/**)`, ...readRoots.map((root) => `Read(${permissionRulePath(root)}/**)`)],
    },
    hooks: {
      PreToolUse: [{ matcher: 'AskUserQuestion', hooks: [blocking] }],
      PermissionRequest: [{ hooks: [blocking] }],
      Stop: [{ hooks: [command] }],
      Notification: [{ hooks: [command] }],
      UserPromptSubmit: [{ hooks: [command] }],
    },
  };
  writeFileSync(settings, `${JSON.stringify(content, null, 2)}\n`);
  return settings;
}
