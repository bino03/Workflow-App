/**
 * Manual spike (step 1 of docs/features/novo-projeto-guiado.md): can a hidden interactive `claude` be driven
 * by the app through blocking hooks, without anyone looking at the TUI?
 *
 *   (a) a PreToolUse hook (matcher AskUserQuestion) that returns `updatedInput` with `answers` lets claude go on
 *       with those answers and no selector on screen (`--mode deny` tries plan B: deny with the answer as reason);
 *   (b) a PermissionRequest hook gets the tool and its input and can allow (Write) or deny (Bash);
 *   (c) a hook that waits `--wait <s>` before the answer still counts (hook `timeout` set to `--timeout <s>`);
 *   (d) text written to the PTY as a bracketed paste, several lines, arrives as one message;
 *   (e) the session's .jsonl is copied to scratch for the fixture (redacted by hand afterwards).
 *
 * Runs in a fresh temporary folder (its trust dialog is accepted through the PTY) with a throwaway skill
 * `spike-guided`. Sends two prompts: spends a little quota.
 *
 *   npx tsx scripts/guided-spike.ts [--mode updated|deny] [--wait 0] [--timeout 3600] [--permission-mode default]
 */
import { randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { claudeSpawner, resolveClaudeBin } from '../src/terminals/spawnClaude.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (line: string) => console.log(line);
const flag = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const mode = flag('mode', 'updated');
const waitMs = Number(flag('wait', '0')) * 1000;
const timeoutS = Number(flag('timeout', '3600'));
const permissionMode = flag('permission-mode', '');

const root = mkdtempSync(join(tmpdir(), 'wfa-guided-spike-'));
const cwd = join(root, 'workflow');
const guidedDir = join(root, 'guided', randomUUID());
const events = join(root, 'events.jsonl');
const hook = join(root, 'guided-hook.cjs');
const settings = join(root, 'claude-settings.json');
const pendingPath = join(guidedDir, 'pending.json');
const answerPath = join(guidedDir, 'answer.json');

mkdirSync(join(cwd, '.claude', 'skills', 'spike-guided'), { recursive: true });
mkdirSync(guidedDir, { recursive: true });
writeFileSync(
  join(cwd, '.claude', 'skills', 'spike-guided', 'SKILL.md'),
  [
    '---',
    'name: spike-guided',
    'description: Spike skill. Asks two questions, writes the answers to a file, then tries one shell command.',
    '---',
    '',
    'Do exactly these steps, in order, and nothing else:',
    '',
    '1. Call the AskUserQuestion tool ONCE with these two questions:',
    '   - question "Which colour?", header "Colour", multiSelect false, options: "Red" (warm), "Blue" (cold).',
    '   - question "Which extras?", header "Extras", multiSelect true, options: "Wheels" (round), "Wings" (fly), "Lights" (bright).',
    '2. With the Write tool, create the file `answers.txt` in the current working directory with one line:',
    '   `COLOUR=<answer 1> EXTRAS=<answer 2>`.',
    '3. With the Bash tool, run `node -e "console.log(42)"`. If it is refused, do not retry.',
    '4. Answer with one line: `SPIKE-DONE COLOUR=<answer 1> EXTRAS=<answer 2> BASH=<ran|refused>`, then stop.',
    '',
  ].join('\n'),
);

// The shape the backend's guided-hook.cjs will have: blocking for questions and permissions (pending.json →
// answer.json), fire-and-forget for the rest. It logs the whole stdin for the spike.
writeFileSync(
  hook,
  `const fs = require('node:fs');
const MODE = ${JSON.stringify(mode)};
const EVENTS = ${JSON.stringify(events)};
const PENDING = ${JSON.stringify(pendingPath)};
const ANSWER = ${JSON.stringify(answerPath)};
let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', async () => {
  let data;
  try { data = JSON.parse(input); } catch { return; }
  fs.appendFileSync(EVENTS, JSON.stringify({ at: Date.now(), event: data.hook_event_name, data }) + '\\n');
  const blocking = (data.hook_event_name === 'PreToolUse' && data.tool_name === 'AskUserQuestion') || data.hook_event_name === 'PermissionRequest';
  if (!blocking) return;
  const requestId = String(Date.now()) + Math.random().toString(16).slice(2, 8);
  fs.writeFileSync(PENDING, JSON.stringify({ requestId, event: data.hook_event_name, tool: data.tool_name, input: data.tool_input }));
  let answer;
  for (;;) {
    try { answer = JSON.parse(fs.readFileSync(ANSWER, 'utf8')); } catch {}
    if (answer && answer.requestId === requestId) break;
    answer = undefined;
    await new Promise((r) => setTimeout(r, 200));
  }
  fs.rmSync(ANSWER, { force: true });
  fs.rmSync(PENDING, { force: true });
  let out;
  if (data.hook_event_name === 'PreToolUse') {
    out = MODE === 'deny'
      ? { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'The user answered in the app: ' + JSON.stringify(answer.answers) } }
      : { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput: { ...data.tool_input, answers: answer.answers } } };
  } else {
    out = answer.decision === 'allow'
      ? { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } } }
      : { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'deny', message: 'The user refused this in the app.' } } };
  }
  fs.appendFileSync(EVENTS, JSON.stringify({ at: Date.now(), event: 'hook-output', out }) + '\\n');
  process.stdout.write(JSON.stringify(out));
});
`,
);
const command = { type: 'command', command: `"${process.execPath}" "${hook}"` };
const blockingCommand = { ...command, timeout: timeoutS };
writeFileSync(
  settings,
  JSON.stringify(
    {
      hooks: {
        PreToolUse: [{ matcher: 'AskUserQuestion', hooks: [blockingCommand] }],
        PermissionRequest: [{ hooks: [blockingCommand] }],
        Stop: [{ hooks: [command] }],
        Notification: [{ hooks: [command] }],
        UserPromptSubmit: [{ hooks: [command] }],
      },
    },
    null,
    2,
  ),
);

type HookEvent = { at: number; event: string; data?: Record<string, unknown>; out?: unknown };
function seen(): HookEvent[] {
  if (!existsSync(events)) return [];
  return readFileSync(events, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as HookEvent);
}

function transcriptPath(sessionId: string): string | null {
  const projects = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'), 'projects');
  if (!existsSync(projects)) return null;
  for (const folder of readdirSync(projects)) {
    const file = join(projects, folder, `${sessionId}.jsonl`);
    if (existsSync(file)) return file;
  }
  return null;
}

async function main() {
  log(`spike root: ${root} · mode=${mode} wait=${waitMs / 1000}s timeout=${timeoutS}s permission-mode=${permissionMode || '(account default)'}`);
  const bin = resolveClaudeBin(process.env.CLAUDE_BIN ?? 'claude');
  const sessionId = randomUUID();
  const args = ['--add-dir', guidedDir, '--session-id', sessionId, '--settings', settings];
  if (permissionMode) args.push('--permission-mode', permissionMode);
  args.push('/spike-guided');
  const manager = new TerminalManager({ spawn: claudeSpawner(bin), maxTerminals: 1, scrollbackBytes: 4 << 20 });
  const started = Date.now();
  const info = manager.create({ cwd, cols: 120, rows: 40, args });
  let exitCode: number | null = null;
  let screen = '';
  manager.attach(info.id, { onData: (d) => (screen += d), onExit: (c) => (exitCode = c) });
  const rel = (at: number) => `+${((at - started) / 1000).toFixed(1)}s`;

  let trustAnswered = false;
  let answeredQuestion = false;
  let screenAtQuestion = 0;
  const deadline = Date.now() + 240_000 + waitMs;
  while (Date.now() < deadline && exitCode === null) {
    if (!trustAnswered && /trust/i.test(screen)) {
      trustAnswered = true;
      log(`${rel(Date.now())} trust dialog → Down, Enter`);
      await sleep(500);
      manager.write(info.id, '\x1b[B');
      await sleep(300);
      manager.write(info.id, '\r');
    }
    if (existsSync(pendingPath)) {
      const pending = JSON.parse(readFileSync(pendingPath, 'utf8')) as { requestId: string; event: string; tool: string; input: Record<string, unknown> };
      log(`${rel(Date.now())} pending ${pending.event} ${pending.tool}: ${JSON.stringify(pending.input).slice(0, 300)}`);
      if (pending.event === 'PreToolUse') {
        screenAtQuestion = screen.length;
        if (waitMs) {
          log(`  waiting ${waitMs / 1000}s before answering (c)…`);
          await sleep(waitMs);
          log(`${rel(Date.now())} still alive: ${exitCode === null} · pending still there: ${existsSync(pendingPath)}`);
        }
        writeFileSync(answerPath, JSON.stringify({ requestId: pending.requestId, answers: { 'Which colour?': 'Blue', 'Which extras?': 'Wheels, Lights' } }));
        answeredQuestion = true;
      } else {
        const decision = pending.tool === 'Bash' ? 'deny' : 'allow';
        log(`  → ${decision}`);
        writeFileSync(answerPath, JSON.stringify({ requestId: pending.requestId, decision }));
      }
      while (existsSync(pendingPath)) await sleep(100);
    }
    if (answeredQuestion && seen().some((e) => e.event === 'Stop')) break;
    await sleep(250);
  }

  const all = seen();
  log(`events (${all.length}):`);
  for (const e of all) {
    const d = e.data ?? {};
    const extra =
      e.event === 'hook-output'
        ? JSON.stringify(e.out)
        : `tool=${String(d.tool_name ?? '')} mode=${String(d.permission_mode ?? '')}${d.message ? ` message=${JSON.stringify(d.message)}` : ''}`;
    log(`  ${rel(e.at)} ${e.event} ${extra}`.slice(0, 400));
  }
  const permissionRequests = all.filter((e) => e.event === 'PermissionRequest');
  for (const p of permissionRequests) log(`  PermissionRequest stdin: ${JSON.stringify(p.data).slice(0, 800)}`);
  const afterQuestion = screen.slice(screenAtQuestion);
  log(`(a) selector text on screen after the hook answered: ${/Enter to select|Type something/i.test(afterQuestion)}`);
  const stop = all.find((e) => e.event === 'Stop');
  const last = String(stop?.data?.last_assistant_message ?? '');
  log(`(a/b) last assistant message: ${JSON.stringify(last.slice(0, 300))}`);
  log(`(b) answers.txt: ${existsSync(join(cwd, 'answers.txt')) ? readFileSync(join(cwd, 'answers.txt'), 'utf8').trim() : '(absent)'}`);

  // (d): a bracketed paste with three lines, then Enter, must arrive as one message.
  if (stop) {
    const before = seen().length;
    manager.write(info.id, '\x1b[200~linha um\nlinha dois\nResponde apenas: TRES-LINHAS-OK\x1b[201~');
    await sleep(300);
    manager.write(info.id, '\r');
    const until = Date.now() + 90_000;
    while (Date.now() < until && !seen().slice(before).some((e) => e.event === 'Stop')) await sleep(250);
    const next = seen().slice(before);
    const submits = next.filter((e) => e.event === 'UserPromptSubmit');
    log(`(d) UserPromptSubmit count: ${submits.length} · prompt: ${JSON.stringify(submits[0]?.data?.prompt ?? null)}`);
    const secondStop = next.find((e) => e.event === 'Stop');
    log(`(d) reply: ${JSON.stringify(String(secondStop?.data?.last_assistant_message ?? '(no stop)').slice(0, 200))}`);
  }

  const jsonl = transcriptPath(sessionId);
  if (jsonl) {
    const copy = join(root, 'transcript.jsonl');
    copyFileSync(jsonl, copy);
    log(`(e) transcript copied: ${copy}`);
  } else log('(e) transcript not found');
  writeFileSync(join(root, 'screen.txt'), screen);

  manager.write(info.id, '\x03');
  await sleep(400);
  manager.write(info.id, '\x03');
  const exitBy = Date.now() + 8000;
  while (exitCode === null && Date.now() < exitBy) await sleep(100);
  await manager.kill(info.id);
  if (process.argv.includes('--clean')) rmSync(root, { recursive: true, force: true });
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
