/**
 * Manual spike (step 1 of docs/features/terminais.md): does the JSON that Claude Code hands to the
 * status line command carry the subscription quota (`rate_limits`)? Runs the real `claude` in a PTY
 * with `--session-id <uuid> --settings <tmp>/claude-settings.json`, whose statusLine command saves
 * every JSON it receives. Also checks where the session's .jsonl lands (step 3 needs the path encoding).
 *
 *   npx tsx scripts/statusline-spike.ts [cwd]            # no prompt — spends no quota
 *   npx tsx scripts/statusline-spike.ts [cwd] --prompt   # sends one tiny prompt (spends a little quota)
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { claudeSpawner, resolveClaudeBin } from '../src/terminals/spawnClaude.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';

const args = process.argv.slice(2);
const sendPrompt = args.includes('--prompt');
const cwd = resolve(args.find((a) => !a.startsWith('--')) ?? join(import.meta.dirname, '..', '..'));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (line: string) => console.log(line);

const dir = mkdtempSync(join(tmpdir(), 'wfa-statusline-'));
const capture = join(dir, 'statusline-inputs.jsonl');
const script = join(dir, 'statusline.cjs');
const settings = join(dir, 'claude-settings.json');

// The same shape the backend will write to DATA_DIR (ADR 0012): absolute node + absolute script.
writeFileSync(
  script,
  [
    "const fs = require('node:fs');",
    'let input = "";',
    "process.stdin.on('data', (chunk) => (input += chunk));",
    "process.stdin.on('end', () => {",
    `  fs.appendFileSync(${JSON.stringify(capture)}, input.trim().replace(/\\r?\\n/g, ' ') + '\\n');`,
    "  let model = '';",
    '  try { model = JSON.parse(input).model?.display_name ?? ""; } catch {}',
    "  process.stdout.write('wfa-spike ' + model);",
    '});',
  ].join('\n'),
);
writeFileSync(
  settings,
  JSON.stringify({ statusLine: { type: 'command', command: `"${process.execPath}" "${script}"` } }, null, 2),
);

function captured(): unknown[] {
  if (!existsSync(capture)) return [];
  return readFileSync(capture, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { unparsable: line.slice(0, 200) };
      }
    });
}

async function waitForCapture(min: number, timeoutMs: number) {
  const start = Date.now();
  while (captured().length < min && Date.now() - start < timeoutMs) await sleep(250);
  return captured().length;
}

/** Candidate encodings of the cwd as a folder name under ~/.claude/projects. */
function findSessionFile(sessionId: string) {
  const projects = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'), 'projects');
  if (!existsSync(projects)) return { projects, folder: null as string | null };
  for (const folder of readdirSync(projects)) {
    if (existsSync(join(projects, folder, `${sessionId}.jsonl`))) return { projects, folder };
  }
  return { projects, folder: null as string | null };
}

async function main() {
  log(`cwd: ${cwd}`);
  log(`spike dir: ${dir}`);
  const bin = resolveClaudeBin(process.env.CLAUDE_BIN ?? 'claude');
  const sessionId = randomUUID();
  const manager = new TerminalManager({ spawn: claudeSpawner(bin), maxTerminals: 1, scrollbackBytes: 1 << 20 });
  const info = manager.create({ cwd, cols: 120, rows: 40, args: ['--session-id', sessionId, '--settings', settings] });
  let exitCode: number | null = null;
  let screen = '';
  manager.attach(info.id, { onData: (d) => (screen += d), onExit: (c) => (exitCode = c) });

  const atStart = await waitForCapture(1, 20_000);
  log(`status line calls after start (no prompt): ${atStart}`);
  if (/trust/i.test(screen)) log('WARN trust dialog on screen — answer it once in a normal terminal in this folder and re-run');

  if (sendPrompt) {
    manager.write(info.id, 'Responde apenas: ok');
    await sleep(500);
    manager.write(info.id, '\r');
    const afterPrompt = await waitForCapture(atStart + 1, 60_000);
    await sleep(3000); // later refreshes may carry the rate limits
    log(`status line calls after the prompt: ${captured().length} (first after prompt at #${afterPrompt})`);
  }

  const inputs = captured();
  const keys = [...new Set(inputs.flatMap((input) => (input && typeof input === 'object' ? Object.keys(input) : [])))];
  log(`top-level keys seen: ${keys.join(', ') || '—'}`);
  const withLimits = inputs.filter((input) => input && typeof input === 'object' && 'rate_limits' in input) as {
    rate_limits: unknown;
  }[];
  log(`inputs with rate_limits: ${withLimits.length}/${inputs.length}`);
  if (withLimits.length) log(`rate_limits (last): ${JSON.stringify(withLimits.at(-1)!.rate_limits)}`);
  if (inputs.length) writeFileSync(join(dir, 'last-input.json'), JSON.stringify(inputs.at(-1), null, 2));

  const { projects, folder } = findSessionFile(sessionId);
  log(`session ${sessionId}.jsonl: ${folder ? `${projects}\\${folder}` : `not found under ${projects}`}`);

  manager.write(info.id, '\x03');
  await sleep(400);
  manager.write(info.id, '\x03');
  const deadline = Date.now() + 8000;
  while (exitCode === null && Date.now() < deadline) await sleep(100);
  await manager.kill(info.id);
  // ConPTY leaves handles alive after exit — exit explicitly.
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
