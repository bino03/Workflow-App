/**
 * Manual spike: does closing a terminal leave Claude Code's fullscreen boot canary behind?
 *
 * Claude Code arms a canary in ~/.claude.json (`fullscreenBootPending[pid]`) when the fullscreen renderer
 * starts, and clears it ~10 s after the first frame or on a clean exit. A pid still pending whose process
 * is gone counts as a "strike" at the next start; 2 strikes turn fullscreen off on the whole machine.
 * This checks, within the first seconds: (A) a clean exit with Ctrl+C twice, (C) the app's Fechar
 * (TerminalManager.kill → closeGracefully) and, only with --with-forced-kill, (B) a forced taskkill.
 * Only reads ~/.claude.json. Needs fullscreen on (settings `tui: "fullscreen"`, not auto-disabled): the
 * CLAUDE_CODE_NO_FLICKER override skips the canary, so it is not used.
 * ⚠️ B leaves a real strike in ~/.claude.json (2 turn fullscreen off machine-wide) — it is off by default.
 *
 *   npx tsx scripts/fullscreen-canary-spike.ts [cwd] [--with-forced-kill]
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import * as pty from 'node-pty';
import { childEnv, claudeSpawner, killProcessTree, resolveClaudeBin } from '../src/terminals/spawnClaude.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';

const args = process.argv.slice(2);
const withForcedKill = args.includes('--with-forced-kill');
const cwd = resolve(args.find((a) => !a.startsWith('--')) ?? join(import.meta.dirname, '..', '..'));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const configFile = join(process.env.CLAUDE_CONFIG_DIR ?? homedir(), '.claude.json');

function pendingPids(): string[] {
  try {
    const config = JSON.parse(readFileSync(configFile, 'utf8')) as { fullscreenBootPending?: Record<string, unknown> };
    return Object.keys(config.fullscreenBootPending ?? {});
  } catch {
    return [];
  }
}

async function launch(label: string) {
  const bin = resolveClaudeBin(process.env.CLAUDE_BIN ?? 'claude');
  const term = pty.spawn(bin, [], {
    name: 'xterm-256color',
    cwd,
    cols: 120,
    rows: 40,
    env: { ...childEnv(), TERM: 'xterm-256color', COLORTERM: 'truecolor' },
  });
  let exited = false;
  term.onExit(() => (exited = true));
  let output = '';
  term.onData((d) => (output += d));
  await sleep(3500); // first frame drawn, well inside the 10 s "healthy" window
  const armed = pendingPids().includes(String(term.pid));
  console.log(`${label}: pid ${term.pid}, alt screen ${output.includes('\x1b[?1049h')}, canary armed ${armed}`);
  return { term, exited: () => exited, armed };
}

async function main() {
  console.log(`config: ${configFile}`);
  const a = await launch('A (Ctrl+C ×2)');
  a.term.write('\x03');
  await sleep(300);
  a.term.write('\x03');
  for (let i = 0; i < 40 && !a.exited(); i++) await sleep(100);
  await sleep(500);
  console.log(`A: exited cleanly ${a.exited()}, canary left behind ${pendingPids().includes(String(a.term.pid))}`);
  if (!a.exited()) await killProcessTree(a.term);

  if (withForcedKill) {
    const b = await launch('B (taskkill /F)');
    await killProcessTree(b.term);
    await sleep(1000);
    console.log(`B: canary left behind ${pendingPids().includes(String(b.term.pid))} (counts as a strike at the next start)`);
  }

  // C: what the app does on Fechar — TerminalManager.kill → closeGracefully — with the real claude.
  const manager = new TerminalManager({ spawn: claudeSpawner(resolveClaudeBin(process.env.CLAUDE_BIN ?? 'claude')), maxTerminals: 1, scrollbackBytes: 1 << 20 });
  const info = manager.create({ cwd, cols: 120, rows: 40 });
  const exits: number[] = [];
  manager.attach(info.id, { onData: () => {}, onExit: (code) => exits.push(code) });
  await sleep(3500);
  console.log(`C: pid ${info.pid}, canary armed before closing ${pendingPids().includes(String(info.pid))}`);
  const started = Date.now();
  await manager.kill(info.id);
  console.log(`C: app close took ${Date.now() - started} ms; exited by itself: ${exits.length > 0} (code ${exits[0]}); pending ${pendingPids().includes(String(info.pid))}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
