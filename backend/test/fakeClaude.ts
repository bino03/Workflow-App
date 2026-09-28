import * as pty from 'node-pty';
import { type SpawnOptions, type SpawnPty, childEnv } from '../src/terminals/spawnClaude.js';

// A fake `claude`: echoes input, reports its size on resize, exits with 3 on "q", exits like the real one on
// Ctrl+C twice (unless FAKE_STUBBORN), and spawns a long-lived grandchild (to prove closing ends the whole
// tree — a clean exit would orphan it).
const FAKE = `
const { spawn } = require('node:child_process');
const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
process.stdout.write('ready grandchild=' + child.pid + '\\n');
process.stdin.setRawMode?.(true);
let ctrlC = 0;
process.stdin.on('data', (d) => {
  const text = d.toString();
  if (text === 'q') process.exit(3);
  if (text.includes('\\x03')) {
    ctrlC += text.split('\\x03').length - 1;
    if (ctrlC >= 2 && !process.env.FAKE_STUBBORN) process.exit(130);
    return;
  }
  process.stdout.write('echo:' + text + '\\n');
});
process.stdout.on('resize', () => process.stdout.write('size:' + process.stdout.columns + 'x' + process.stdout.rows + '\\n'));
`;

/** Spawns the fake instead of `claude`, and records what it was asked to launch. */
export function fakeClaude({ stubborn = false }: { stubborn?: boolean } = {}) {
  const launches: SpawnOptions[] = [];
  const spawn: SpawnPty = (options) => {
    launches.push(options);
    const env = { ...childEnv(), ...(stubborn ? { FAKE_STUBBORN: '1' } : {}) };
    return pty.spawn(process.execPath, ['-e', FAKE], { cwd: options.cwd, cols: options.cols, rows: options.rows, env });
  };
  return { spawn, launches };
}

export const fakeSpawn: SpawnPty = fakeClaude().spawn;

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function waitFor(predicate: () => boolean, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
