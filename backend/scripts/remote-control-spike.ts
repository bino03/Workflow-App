/**
 * Manual spike (step 1 of docs/features/bot-telegram.md, ADR 0017): does `--remote-control` work in a PTY
 * launched the way the backend launches `claude`, without extra prompts, next to `--settings` (quota status
 * line) and `--session-id` / `--resume`? And what happens in a folder Claude Code does not trust yet?
 *
 *   A. new conversation: --session-id <uuid> --settings <tmp> --remote-control      (+ one tiny prompt)
 *   B. resume it:        --resume <uuid> --settings <tmp> --remote-control "<name>"  (held --hold seconds)
 *   C. a subfolder of a trusted folder, not listed itself in .claude.json            (does the parent count?)
 *   D. a brand-new temp folder                                                       (trust dialog?)
 *
 *   npx tsx scripts/remote-control-spike.ts [--hold 120]
 *
 * Spends a little quota (one "ok" answer in A). Never answers a trust dialog.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import xtermHeadless from '@xterm/headless';
import { claudeSpawner, resolveClaudeBin } from '../src/terminals/spawnClaude.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';

const { Terminal } = xtermHeadless;
const envFile = join(import.meta.dirname, '..', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const args = process.argv.slice(2);
const holdIndex = args.indexOf('--hold');
const holdSeconds = holdIndex >= 0 ? Number(args[holdIndex + 1]) : 0;
const appRoot = resolve(join(import.meta.dirname, '..', '..'));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (line: string) => console.log(line);

const dir = mkdtempSync(join(tmpdir(), 'wfa-rc-spike-'));
const capture = join(dir, 'statusline-inputs.jsonl');
const script = join(dir, 'statusline.cjs');
const settings = join(dir, 'claude-settings.json');
writeFileSync(
  script,
  [
    "const fs = require('node:fs');",
    'let input = "";',
    "process.stdin.on('data', (chunk) => (input += chunk));",
    `process.stdin.on('end', () => { fs.appendFileSync(${JSON.stringify(capture)}, input.trim().replace(/\\r?\\n/g, ' ') + '\\n'); process.stdout.write('wfa-rc-spike'); });`,
  ].join('\n'),
);
writeFileSync(settings, JSON.stringify({ statusLine: { type: 'command', command: `"${process.execPath}" "${script}"` } }));

const statusLineCalls = () => (existsSync(capture) ? readFileSync(capture, 'utf8').split('\n').filter(Boolean) : []);

const bin = resolveClaudeBin(process.env.CLAUDE_BIN ?? 'claude');
const manager = new TerminalManager({ spawn: claudeSpawner(bin), maxTerminals: 2, scrollbackBytes: 1 << 20 });

/** Runs claude on a headless xterm, so the checks read the screen the user would see. */
function launch(label: string, cwd: string, claudeArgs: string[]) {
  const term = new Terminal({ cols: 120, rows: 32, allowProposedApi: true });
  let lastData = Date.now();
  let exitCode: number | null = null;
  const info = manager.create({ cwd, cols: 120, rows: 32, args: claudeArgs });
  manager.attach(info.id, {
    onData: (d) => {
      lastData = Date.now();
      term.write(d);
    },
    onExit: (c) => (exitCode = c),
  });
  const text = () => {
    const buffer = term.buffer.active;
    const lines: string[] = [];
    for (let i = 0; i < buffer.length; i++) lines.push(buffer.getLine(i)?.translateToString(true) ?? '');
    return lines.join('\n').replace(/\n+$/, '');
  };
  return {
    id: info.id,
    get exitCode() {
      return exitCode;
    },
    text,
    async quiet(ms = 2000, max = 25_000) {
      const start = Date.now();
      await sleep(300);
      while (Date.now() - lastData < ms && Date.now() - start < max) await sleep(100);
    },
    save(suffix: string) {
      const file = join(dir, `${label}-${suffix}.txt`);
      writeFileSync(file, text());
      return file;
    },
    write: (data: string) => manager.write(info.id, data),
    async exit() {
      manager.write(info.id, '\x03');
      await sleep(400);
      manager.write(info.id, '\x03');
      const deadline = Date.now() + 8000;
      while (exitCode === null && Date.now() < deadline) await sleep(100);
      await manager.kill(info.id);
    },
  };
}

function report(label: string, screen: string) {
  const hit = (re: RegExp) => screen.split('\n').filter((l) => re.test(l)).map((l) => l.trim()).slice(0, 4);
  log(`[${label}] remote-control lines: ${JSON.stringify(hit(/remote control|\/rc|rc active|claude\.ai\/code/i))}`);
  log(`[${label}] trust lines:          ${JSON.stringify(hit(/trust/i))}`);
  log(`[${label}] question lines:       ${JSON.stringify(hit(/\(y\/n\)|\[y\/N\]|enable remote|do you want|❯ 1\./i))}`);
  log(`[${label}] error lines:          ${JSON.stringify(hit(/error|fail|disabled|not available|unknown option/i))}`);
}

async function main() {
  log(`claude: ${bin}`);
  log(`spike dir: ${dir}`);
  const sessionId = randomUUID();

  // E (--name-test only) — a new conversation with an explicit name: does the name reach the Claude app?
  if (args.includes('--name-test')) {
    const e = launch('E-named', appRoot, ['--session-id', sessionId, '--settings', settings, '--remote-control', 'WFA teste · nome']);
    await e.quiet(3000);
    await sleep(6000);
    e.save('start');
    report('E', e.text());
    if (args.includes('--prompt')) {
      log('[E] sending one tiny prompt');
      e.write('Responde apenas: ok');
      await sleep(500);
      e.write('\r');
      await sleep(10_000);
      await e.quiet(2000, 45_000);
    }
    log(`[E] HOLDING ${holdSeconds}s — look for "WFA teste · nome" in the Claude app → Code`);
    await sleep(holdSeconds * 1000);
    await e.exit();
    process.exit(0);
  }

  // A — new conversation, RC without a name.
  const a = launch('A-new', appRoot, ['--session-id', sessionId, '--settings', settings, '--remote-control']);
  await a.quiet(3000);
  await sleep(5000); // RC registers after the TUI is up
  await a.quiet(1500);
  a.save('start');
  report('A', a.text());
  log(`[A] exit code so far: ${a.exitCode}; status line calls: ${statusLineCalls().length}`);
  a.write('Responde apenas: ok');
  await sleep(500);
  a.write('\r');
  await sleep(15_000);
  await a.quiet(2000, 45_000);
  a.save('after-prompt');
  const calls = statusLineCalls();
  log(`[A] status line calls after prompt: ${calls.length}; last has rate_limits: ${/rate_limits/.test(calls.at(-1) ?? '')}`);
  await a.exit();
  const jsonl = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'projects', appRoot.replace(/[^A-Za-z0-9]/g, '-'), `${sessionId}.jsonl`);
  log(`[A] session saved: ${existsSync(jsonl)} (${sessionId})`);

  // B — resume it, RC with a name the backend would build.
  const name = 'WorkFlow App · spike';
  const b = launch('B-resume', appRoot, ['--resume', sessionId, '--settings', settings, '--remote-control', name]);
  await b.quiet(3000);
  await sleep(6000);
  await b.quiet(1500);
  b.save('start');
  report('B', b.text());
  log(`[B] exit code so far: ${b.exitCode}`);
  if (holdSeconds > 0) {
    log(`[B] HOLDING ${holdSeconds}s — look for "${name}" in the Claude app → Code`);
    await sleep(holdSeconds * 1000);
    b.save('after-hold');
    report('B-after-hold', b.text());
  }
  await b.exit();

  // C — subfolder of a trusted folder (backend/ under the app, which is trusted).
  const c = launch('C-subfolder', join(appRoot, 'backend'), ['--session-id', randomUUID(), '--settings', settings, '--remote-control']);
  await c.quiet(3000);
  await sleep(4000);
  c.save('start');
  report('C', c.text());
  await manager.kill(c.id);

  // D — a brand-new folder.
  const fresh = mkdtempSync(join(tmpdir(), 'wfa-rc-untrusted-'));
  const d = launch('D-untrusted', fresh, ['--session-id', randomUUID(), '--settings', settings, '--remote-control']);
  await d.quiet(3000);
  await sleep(4000);
  d.save('start');
  report('D', d.text());
  await manager.kill(d.id);

  log(`\nscreens in ${dir}`);
  // ConPTY leaves handles alive after exit — exit explicitly.
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
