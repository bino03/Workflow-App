/**
 * Manual spike (ToDo → Terminais, "Estado de cada sessão" + "Agentes de cada terminal"): what do the hooks of a
 * normal terminal tell us, without blocking and without reading the screen?
 *
 *   (a) a hook inherits an env var set on the PTY (WFA_TERMINAL_ID) — and still does after /clear;
 *   (b) which events fire in a normal interactive turn, and what Notification carries (notification_type?) for a
 *       permission prompt vs. "idle for 60 s";
 *   (c) PostToolUse fires after a permission is approved in the TUI (the way back from "needs you" to "working");
 *   (d) the Agent tool: PreToolUse/PostToolUse payloads (description, subagent_type, model, run_in_background,
 *       tool_use_id), SubagentStart/SubagentStop (agent_id, agent_type, transcript path) — for a foreground and a
 *       background agent; does the background one end reliably?
 *   (e) /clear: SessionStart source, new session_id.
 *
 * Runs in a fresh temporary folder (its trust dialog is accepted through the PTY). --permission-mode default so a
 * Bash command asks. Sends a few prompts: spends a little quota. Takes ~3-4 min (it waits for the idle notification).
 *
 *   npx tsx scripts/session-state-spike.ts
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as pty from 'node-pty';
import { launchEnv, resolveClaudeBin } from '../src/terminals/spawnClaude.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (line: string) => console.log(line);

const root = mkdtempSync(join(tmpdir(), 'wfa-state-spike-'));
const cwd = join(root, 'project');
mkdirSync(cwd, { recursive: true });
const events = join(root, 'events.jsonl');
const hook = join(root, 'hook.cjs');
const settings = join(root, 'claude-settings.json');
const terminalId = randomUUID();

// Logs every payload, with long strings cut — never prints (a Stop hook's output can hold the turn).
writeFileSync(
  hook,
  `const fs = require('node:fs');
let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const cut = (v, d) => {
      if (typeof v === 'string') return v.length > 160 ? v.slice(0, 160) + '…' : v;
      if (Array.isArray(v)) return d > 2 ? '[…]' : v.slice(0, 5).map((x) => cut(x, d + 1));
      if (v && typeof v === 'object') return d > 2 ? '{…}' : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, cut(x, d + 1)]));
      return v;
    };
    fs.appendFileSync(${JSON.stringify(events)}, JSON.stringify({ at: Date.now(), env: process.env.WFA_TERMINAL_ID || null, data: cut(data, 0) }) + '\\n');
  } catch (e) { fs.appendFileSync(${JSON.stringify(events)}, JSON.stringify({ at: Date.now(), error: String(e) }) + '\\n'); }
});
`,
);
const command = { type: 'command', command: `"${process.execPath}" "${hook}"` };
const EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PermissionRequest',
  'Notification',
  'Stop',
  'SubagentStart',
  'SubagentStop',
  'SessionEnd',
];
writeFileSync(settings, JSON.stringify({ hooks: Object.fromEntries(EVENTS.map((e) => [e, [{ hooks: [command] }]])) }, null, 2));

type Seen = { at: number; env: string | null; data: Record<string, unknown> };
function seen(): Seen[] {
  if (!existsSync(events)) return [];
  return readFileSync(events, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Seen);
}
const name = (e: Seen) => String(e.data.hook_event_name);

async function main() {
  log(`spike root: ${root}`);
  const bin = resolveClaudeBin(process.env.CLAUDE_BIN ?? 'claude');
  const sessionId = randomUUID();
  const args = ['--session-id', sessionId, '--settings', settings, '--permission-mode', 'default'];
  const started = Date.now();
  const p = pty.spawn(bin, args, { name: 'xterm-256color', cwd, cols: 140, rows: 40, env: { ...launchEnv(undefined), WFA_TERMINAL_ID: terminalId } });
  let screen = '';
  let exited = false;
  p.onData((d) => (screen += d));
  p.onExit(() => (exited = true));
  const type = async (text: string) => {
    p.write(`\x1b[200~${text}\x1b[201~`);
    await sleep(400);
    p.write('\r');
  };
  const waitFor = async (pred: (all: Seen[]) => boolean, ms: number, label: string) => {
    const until = Date.now() + ms;
    while (Date.now() < until && !exited) {
      if (pred(seen())) return true;
      await sleep(250);
    }
    log(`  (timeout waiting for ${label})`);
    return false;
  };

  // Trust dialog of a never-seen folder: Down, Enter.
  const trustUntil = Date.now() + 30_000;
  while (Date.now() < trustUntil && !/trust/i.test(screen) && !seen().some((e) => name(e) === 'SessionStart')) await sleep(250);
  if (/trust/i.test(screen)) {
    log(`trust dialog after ${Date.now() - started} ms → Down, Enter`);
    await sleep(500);
    p.write('\x1b[B');
    await sleep(300);
    p.write('\r');
  }
  await waitFor((all) => all.some((e) => name(e) === 'SessionStart'), 30_000, 'SessionStart');
  await sleep(2000);

  // Turn 1: a Bash command that asks for permission → approve it in the TUI.
  log('--- turn 1: permission prompt');
  const t1 = seen().length;
  await type('Run exactly this shell command with the Bash tool: node -e "console.log(42)" — then answer only with its output.');
  const asked = await waitFor((all) => all.slice(t1).some((e) => name(e) === 'Notification' || name(e) === 'PermissionRequest'), 90_000, 'permission');
  if (asked) {
    await sleep(1500);
    log('  approving with Enter');
    p.write('\r');
  }
  await waitFor((all) => all.slice(t1).some((e) => name(e) === 'Stop'), 120_000, 'Stop of turn 1');

  // Turn 2: a foreground and a background agent.
  log('--- turn 2: agents');
  const t2 = seen().length;
  await type(
    'Launch two agents with the Agent tool in the same message, both with subagent_type "general-purpose": ' +
      'one with description "spike foreground" and prompt "Reply with the single word ok. Use no tools."; ' +
      'the other with description "spike background", run_in_background true, model "haiku", and prompt "Reply with the single word ok. Use no tools.". ' +
      'Then answer only "launched".',
  );
  await waitFor((all) => all.slice(t2).some((e) => name(e) === 'Stop'), 180_000, 'Stop of turn 2');
  log('  waiting up to 90 s for the background agent to end (SubagentStop) and any follow-up turn');
  const fgBg = () => seen().slice(t2).filter((e) => name(e) === 'SubagentStop').length;
  const until = Date.now() + 90_000;
  while (Date.now() < until && fgBg() < 2) await sleep(500);
  await sleep(15_000);

  // Idle: wait 75 s with the prompt waiting, for the idle Notification.
  log('--- idle 75 s');
  await sleep(75_000);

  // /clear: new session id, env still there?
  log('--- /clear');
  const t3 = seen().length;
  await type('/clear');
  await waitFor((all) => all.slice(t3).some((e) => name(e) === 'SessionStart'), 20_000, 'SessionStart after /clear');
  await sleep(1500);

  const all = seen();
  log(`\nevents (${all.length}):`);
  for (const e of all) {
    const { hook_event_name, session_id, ...rest } = e.data as Record<string, unknown>;
    delete rest.transcript_path;
    delete rest.cwd;
    log(
      `+${String(e.at - started).padStart(6)} ms ${String(hook_event_name).padEnd(17)} sid=${session_id === sessionId ? 'ours' : String(session_id).slice(0, 8)} env=${e.env === terminalId ? 'ok' : e.env} ${JSON.stringify(rest)}`,
    );
  }
  log(`\n(a) env inherited by every hook: ${all.length > 0 && all.every((e) => e.env === terminalId)}`);
  writeFileSync(join(root, 'screen.txt'), screen);

  p.write('\x03');
  await sleep(400);
  p.write('\x03');
  const exitBy = Date.now() + 8000;
  while (!exited && Date.now() < exitBy) await sleep(100);
  if (!exited) p.kill();
  log(`\nSessionEnd seen: ${seen().some((e) => name(e) === 'SessionEnd')}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
