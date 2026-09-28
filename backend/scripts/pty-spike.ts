/**
 * Manual PTY spike: runs the real `claude` through TerminalManager and checks, on this machine,
 * binary resolution, the child's environment, the subscription login (/status), resize, Ctrl+C and
 * killing the process tree. Does not talk to the model — /status is local — so it spends no quota.
 *
 *   npx tsx scripts/pty-spike.ts [cwd]
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import xtermHeadless from '@xterm/headless';
import * as pty from 'node-pty';
import { childEnv, claudeSpawner, isDeniedEnvName, resolveClaudeBin } from '../src/terminals/spawnClaude.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';

const { Terminal } = xtermHeadless;
const cwd = resolve(process.argv[2] ?? process.cwd());
const COLS = 120;
const ROWS = 40;
const results: { check: string; ok: boolean; detail: string }[] = [];
const record = (check: string, ok: boolean, detail = '') => {
  results.push({ check, ok, detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${check}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Renders PTY output on a headless xterm so we read the screen the user would see. */
function screen(cols: number, rows: number) {
  const term = new Terminal({ cols, rows, allowProposedApi: true });
  let bytes = 0;
  let lastData = Date.now();
  return {
    write(data: string) {
      bytes += data.length;
      lastData = Date.now();
      term.write(data);
    },
    resize: (c: number, r: number) => term.resize(c, r),
    text() {
      const buffer = term.buffer.active;
      const lines: string[] = [];
      for (let i = 0; i < buffer.length; i++) lines.push(buffer.getLine(i)?.translateToString(true) ?? '');
      return lines.join('\n').replace(/\n+$/, '');
    },
    get bytes() {
      return bytes;
    },
    async quiet(ms = 1500, max = 20_000) {
      const start = Date.now();
      await sleep(200);
      while (Date.now() - lastData < ms && Date.now() - start < max) await sleep(100);
    },
  };
}

function descendants(rootPid: number): number[] {
  const out = execFileSync(
    'powershell',
    ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId)" }'],
    { encoding: 'utf8' },
  );
  const children = new Map<number, number[]>();
  for (const line of out.trim().split(/\r?\n/)) {
    const [pid, parent] = line.trim().split(' ').map(Number) as [number, number];
    children.set(parent, [...(children.get(parent) ?? []), pid]);
  }
  const all: number[] = [];
  const stack = [rootPid];
  while (stack.length) {
    const pid = stack.pop()!;
    for (const child of children.get(pid) ?? []) {
      all.push(child);
      stack.push(child);
    }
  }
  return all;
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function main() {
  console.log(`cwd: ${cwd}`);

  // 1. Binary
  const bin = resolveClaudeBin(process.env.CLAUDE_BIN ?? 'claude');
  record('CLAUDE_BIN resolves to an executable', true, bin);

  // 2. Environment — inject fakes to prove they are stripped, then read the child's real env.
  process.env.ANTHROPIC_API_KEY = 'sk-ant-spike-fake';
  process.env.ANTHROPIC_AUTH_TOKEN = 'spike-fake';
  process.env.SESSION_SECRET = 'spike-fake';
  const inherited = Object.keys(process.env).filter(isDeniedEnvName);
  const probe = pty.spawn('cmd.exe', ['/c', 'set'], { cwd, cols: 200, rows: 200, env: childEnv() });
  let probeOut = '';
  probe.onData((d) => (probeOut += d));
  await new Promise<void>((r) => probe.onExit(() => r()));
  const leaked = probeOut
    .split(/\r?\n/)
    .map((l) => l.split('=')[0]!.trim())
    .filter((name) => name && isDeniedEnvName(name));
  record('child env has no denied variables', leaked.length === 0, `backend had ${inherited.join(', ')}; child leaked: ${leaked.join(', ') || 'none'}`);

  // 3. Launch claude
  const manager = new TerminalManager({ spawn: claudeSpawner(bin), maxTerminals: 4, scrollbackBytes: 1 << 20 });
  const view = screen(COLS, ROWS);
  const info = manager.create({ cwd, cols: COLS, rows: ROWS });
  let exitCode: number | null = null;
  manager.attach(info.id, { onData: (d) => view.write(d), onExit: (c) => (exitCode = c) });
  await view.quiet(2500);
  const startScreen = view.text();
  writeFileSync(join(tmpdir(), 'wfa-spike-start.txt'), startScreen);
  record('claude starts and draws its TUI', view.bytes > 0 && exitCode === null, `${view.bytes} chars; pid ${info.pid}`);
  if (/trust/i.test(startScreen)) {
    record('folder already trusted', false, 'trust dialog shown — answer it once in a normal terminal and re-run');
  }

  // 4. /status — which login is this?
  manager.write(info.id, '/status');
  await sleep(500);
  manager.write(info.id, '\r');
  await view.quiet(2000);
  const statusScreen = view.text();
  writeFileSync(join(tmpdir(), 'wfa-spike-status.txt'), statusScreen);
  const loginLines = statusScreen
    .split('\n')
    .filter((l) => /login|auth|api key|account|subscription|organization|max|pro\b|email/i.test(l))
    .map((l) => l.trim())
    .filter(Boolean);
  const usesApiKey = /api key|ANTHROPIC_API_KEY|sk-ant/i.test(statusScreen);
  record('/status shows the subscription login, not an API key', loginLines.length > 0 && !usesApiKey, loginLines.join(' | '));

  // 5. Resize
  const before = view.bytes;
  manager.resize(info.id, 100, 30);
  view.resize(100, 30);
  await view.quiet(1000);
  record('resize redraws', view.bytes > before, `${view.bytes - before} chars after resize to 100x30`);
  manager.write(info.id, '\x1b'); // close the /status panel
  await view.quiet(800);

  // 6. Ctrl+C twice → claude exits
  manager.write(info.id, '\x03');
  await sleep(400);
  manager.write(info.id, '\x03');
  const deadline = Date.now() + 8000;
  while (exitCode === null && Date.now() < deadline) await sleep(100);
  writeFileSync(join(tmpdir(), 'wfa-spike-ctrlc.txt'), view.text());
  record('Ctrl+C twice exits claude', exitCode !== null, `exit code ${exitCode}`);
  await manager.kill(info.id);

  // 7. Kill takes the whole tree
  const second = manager.create({ cwd, cols: COLS, rows: ROWS });
  const view2 = screen(COLS, ROWS);
  manager.attach(second.id, { onData: (d) => view2.write(d), onExit: () => {} });
  await view2.quiet(2500);
  const tree = descendants(second.pid);
  await manager.kill(second.id);
  await sleep(1500);
  const survivors = [second.pid, ...tree].filter(alive);
  record('kill takes the whole process tree', survivors.length === 0, `tree ${[second.pid, ...tree].join(',')}; survivors ${survivors.join(',') || 'none'}`);

  writeFileSync(join(tmpdir(), 'wfa-spike-results.json'), JSON.stringify(results, null, 2));
  console.log(`\nscreens in ${tmpdir()}\\wfa-spike-*.txt`);
  // ConPTY leaves handles alive after exit — exit explicitly.
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
