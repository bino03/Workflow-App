/**
 * Manual spike (step 1 of docs/features/importar-para-a-biblioteca.md): can the backend start an interactive
 * `claude` that runs a slash command at once, and follow it without reading the screen?
 *
 *   (a) a positional prompt `/<command> <path>` after the flags runs as the first message (interactive, not -p);
 *   (b) Stop / Notification / UserPromptSubmit hooks from a --settings file run, with session_id and
 *       hook_event_name on stdin;
 *   (c) with --add-dir <dir>, claude reads a file there without a permission prompt;
 *   (d) a hook that prints nothing does not hold up the end of the turn.
 *
 * Runs in a fresh temporary folder (its trust dialog is accepted through the PTY — that adds the folder to
 * ~/.claude.json) with a throwaway skill `spike-import`. Sends one prompt: spends a little quota.
 *
 *   npx tsx scripts/import-spike.ts
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { claudeSpawner, resolveClaudeBin } from '../src/terminals/spawnClaude.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (line: string) => console.log(line);

const root = mkdtempSync(join(tmpdir(), 'wfa-import-spike-'));
const cwd = join(root, 'workflow');
const addDir = join(root, 'imports', randomUUID());
const events = join(root, 'events.jsonl');
const hook = join(root, 'hook.cjs');
const settings = join(root, 'claude-settings.json');
const marker = `MARKER-${randomUUID().slice(0, 8)}`;
const requestPath = join(addDir, 'request.json');

mkdirSync(join(cwd, '.claude', 'skills', 'spike-import'), { recursive: true });
mkdirSync(addDir, { recursive: true });
writeFileSync(
  join(cwd, '.claude', 'skills', 'spike-import', 'SKILL.md'),
  [
    '---',
    'name: spike-import',
    'description: Spike skill. Reads the JSON file whose path is given as the argument and reports its marker.',
    '---',
    '',
    'Read the file whose absolute path is the argument ($ARGUMENTS) with the Read tool.',
    'Then answer with exactly one line: `SPIKE-RESULT <the value of the "marker" field>` and nothing else.',
    'Do not use any other tool.',
    '',
  ].join('\n'),
);
writeFileSync(requestPath, JSON.stringify({ version: 1, marker }, null, 2));

// Prints nothing and never fails — the shape the backend's import-hook.cjs will have.
writeFileSync(
  hook,
  [
    "const fs = require('node:fs');",
    'let input = "";',
    "process.stdin.on('data', (chunk) => (input += chunk));",
    "process.stdin.on('end', () => {",
    '  try {',
    '    const data = JSON.parse(input);',
    `    fs.appendFileSync(${JSON.stringify(events)}, JSON.stringify({ at: Date.now(), event: data.hook_event_name, session_id: data.session_id, keys: Object.keys(data), message: data.message, prompt: data.prompt }) + '\\n');`,
    '  } catch {}',
    '});',
  ].join('\n'),
);
const command = { type: 'command', command: `"${process.execPath}" "${hook}"` };
writeFileSync(
  settings,
  JSON.stringify(
    {
      hooks: {
        Stop: [{ hooks: [command] }],
        Notification: [{ hooks: [command] }],
        UserPromptSubmit: [{ hooks: [command] }],
      },
    },
    null,
    2,
  ),
);

type HookEvent = { at: number; event: string; session_id: string; keys: string[]; message?: string; prompt?: string };
function seen(): HookEvent[] {
  if (!existsSync(events)) return [];
  return readFileSync(events, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as HookEvent);
}

function transcript(sessionId: string): string | null {
  const projects = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'), 'projects');
  if (!existsSync(projects)) return null;
  for (const folder of readdirSync(projects)) {
    const file = join(projects, folder, `${sessionId}.jsonl`);
    if (existsSync(file)) return readFileSync(file, 'utf8');
  }
  return null;
}

async function main() {
  log(`spike root: ${root}`);
  const bin = resolveClaudeBin(process.env.CLAUDE_BIN ?? 'claude');
  const sessionId = randomUUID();
  const prompt = `/spike-import ${requestPath}`;
  // --add-dir is variadic: it goes first, so the next flag ends it and the prompt stays positional.
  const args = ['--add-dir', addDir, '--session-id', sessionId, '--settings', settings, prompt];
  log(`args: ${JSON.stringify(args)}`);
  const manager = new TerminalManager({ spawn: claudeSpawner(bin), maxTerminals: 1, scrollbackBytes: 1 << 20 });
  const started = Date.now();
  const info = manager.create({ cwd, cols: 120, rows: 40, args });
  let exitCode: number | null = null;
  let screen = '';
  manager.attach(info.id, { onData: (d) => (screen += d), onExit: (c) => (exitCode = c) });

  // The trust dialog of a never-seen folder: "No, exit" is the default — Down, then Enter.
  let trustAnswered = false;
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline && exitCode === null) {
    if (!trustAnswered && /trust/i.test(screen)) {
      trustAnswered = true;
      log(`trust dialog after ${Date.now() - started} ms → Down, Enter`);
      await sleep(500);
      manager.write(info.id, '\x1b[B');
      await sleep(300);
      manager.write(info.id, '\r');
    }
    if (seen().some((e) => e.event === 'Stop')) break;
    await sleep(250);
  }

  const all = seen();
  const stop = all.find((e) => e.event === 'Stop');
  log(`events (${all.length}):`);
  for (const e of all) {
    log(`  +${e.at - started} ms ${e.event} session_id=${e.session_id === sessionId ? 'ours' : e.session_id} keys=[${e.keys.join(',')}]${e.message ? ` message=${JSON.stringify(e.message)}` : ''}${e.prompt ? ` prompt=${JSON.stringify(e.prompt.slice(0, 120))}` : ''}`);
  }
  log(`(a) prompt submitted as first message: ${all.some((e) => e.event === 'UserPromptSubmit' && e.prompt?.startsWith('/spike-import'))}`);
  log(`(b) hooks ran with our session_id: ${all.length > 0 && all.every((e) => e.session_id === sessionId)}`);
  const permissionAsked = all.some((e) => e.event === 'Notification' && /permission/i.test(e.message ?? ''));
  log(`(c) permission prompt for the --add-dir read: ${permissionAsked}`);

  const jsonl = transcript(sessionId);
  const answered = jsonl?.includes(`SPIKE-RESULT ${marker}`) ?? false;
  log(`transcript found: ${jsonl !== null} · contains "SPIKE-RESULT ${marker}": ${answered}`);

  // (d): after Stop, the TUI accepts the next message right away.
  if (stop) {
    const before = seen().length;
    manager.write(info.id, 'Responde apenas: ok');
    await sleep(300);
    manager.write(info.id, '\r');
    const until = Date.now() + 60_000;
    while (Date.now() < until && !seen().slice(before).some((e) => e.event === 'Stop')) await sleep(250);
    const next = seen().slice(before);
    const submit = next.find((e) => e.event === 'UserPromptSubmit');
    const secondStop = next.find((e) => e.event === 'Stop');
    log(`(d) second turn: submit ${submit ? `+${submit.at - stop.at} ms after the first Stop` : 'not seen'}, stop ${secondStop ? 'seen' : 'not seen'}`);
  }
  writeFileSync(join(root, 'screen.txt'), screen);

  manager.write(info.id, '\x03');
  await sleep(400);
  manager.write(info.id, '\x03');
  const exitBy = Date.now() + 8000;
  while (exitCode === null && Date.now() < exitBy) await sleep(100);
  await manager.kill(info.id);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
