import { tmpdir } from 'node:os';
import * as pty from 'node-pty';
import { afterEach, describe, expect, it } from 'vitest';
import { type SpawnPty, childEnv } from '../src/terminals/spawnClaude.js';
import { TerminalLimitError, TerminalManager } from '../src/terminals/terminalManager.js';

// A fake `claude`: echoes input, reports its size on resize, and spawns a long-lived grandchild.
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

const fakeSpawn: SpawnPty = ({ cwd, cols, rows }) =>
  pty.spawn(process.execPath, ['-e', FAKE], { cwd, cols, rows, env: childEnv() });

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

describe('TerminalManager (fake process)', () => {
  const manager = new TerminalManager({ spawn: fakeSpawn, maxTerminals: 2, scrollbackBytes: 64 * 1024 });

  afterEach(async () => {
    await manager.killAll();
  });

  function open() {
    const info = manager.create({ cwd: tmpdir(), cols: 80, rows: 24 });
    let output = '';
    const exits: number[] = [];
    const attached = manager.attach(info.id, { onData: (d) => (output += d), onExit: (c) => exits.push(c) })!;
    return { info, output: () => output, exits, attached };
  }

  it('streams output, echoes input and keeps a scrollback for late clients', async () => {
    const t = open();
    await waitFor(() => t.output().includes('ready'));
    manager.write(t.info.id, 'hi');
    await waitFor(() => t.output().includes('echo:hi'));

    const late = manager.attach(t.info.id, { onData: () => {}, onExit: () => {} })!;
    expect(late.scrollback).toContain('ready');
    expect(late.scrollback).toContain('echo:hi');
  });

  it('resizes the PTY', async () => {
    const t = open();
    await waitFor(() => t.output().includes('ready'));
    manager.resize(t.info.id, 100, 30);
    await waitFor(() => t.output().includes('size:100x30'));
  });

  it('reports the exit code and keeps the terminal listed as exited', async () => {
    const t = open();
    await waitFor(() => t.output().includes('ready'));
    manager.write(t.info.id, 'q');
    await waitFor(() => t.exits.length > 0);
    expect(t.exits).toEqual([3]);
    expect(manager.get(t.info.id)).toMatchObject({ status: 'exited', exitCode: 3 });
  });

  it('kill takes the whole process tree', async () => {
    const t = open();
    await waitFor(() => /grandchild=\d+/.test(t.output()));
    const grandchild = Number(/grandchild=(\d+)/.exec(t.output())![1]);
    expect(isAlive(t.info.pid)).toBe(true);
    expect(isAlive(grandchild)).toBe(true);

    expect(await manager.kill(t.info.id)).toBe(true);
    await waitFor(() => !isAlive(t.info.pid) && !isAlive(grandchild));
    expect(manager.get(t.info.id)).toBeUndefined();
  });

  it('enforces MAX_TERMINALS', () => {
    open();
    open();
    expect(() => open()).toThrow(TerminalLimitError);
  });
});
