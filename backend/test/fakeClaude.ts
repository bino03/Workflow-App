import * as pty from 'node-pty';
import { type SpawnOptions, type SpawnPty, childEnv } from '../src/terminals/spawnClaude.js';

// A fake `claude`: echoes input, reports its size on resize, exits with 3 on "q", and spawns a
// long-lived grandchild (to prove kills take the whole tree).
const FAKE = `
const { spawn } = require('node:child_process');
const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
process.stdout.write('ready grandchild=' + child.pid + '\\n');
process.stdin.setRawMode?.(true);
process.stdin.on('data', (d) => {
  if (d.toString() === 'q') process.exit(3);
  process.stdout.write('echo:' + d.toString() + '\\n');
});
process.stdout.on('resize', () => process.stdout.write('size:' + process.stdout.columns + 'x' + process.stdout.rows + '\\n'));
`;

/** Spawns the fake instead of `claude`, and records what it was asked to launch. */
export function fakeClaude() {
  const launches: SpawnOptions[] = [];
  const spawn: SpawnPty = (options) => {
    launches.push(options);
    return pty.spawn(process.execPath, ['-e', FAKE], { cwd: options.cwd, cols: options.cols, rows: options.rows, env: childEnv() });
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
