import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { TerminalLimitError, TerminalManager } from '../src/terminals/terminalManager.js';
import { fakeClaude, fakeSpawn, isAlive, waitFor } from './fakeClaude.js';

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

  // A clean exit keeps Claude Code's fullscreen boot canary from being left behind (closeGracefully).
  it('kill asks claude to exit with Ctrl+C twice, and still ends the whole tree', async () => {
    const t = open();
    await waitFor(() => /grandchild=\d+/.test(t.output()));
    const grandchild = Number(/grandchild=(\d+)/.exec(t.output())![1]);
    expect(isAlive(t.info.pid)).toBe(true);
    expect(isAlive(grandchild)).toBe(true);

    expect(await manager.kill(t.info.id)).toBe(true);
    expect(t.exits).toEqual([130]); // it exited by itself — not killed
    // The fake's clean exit orphans the grandchild; closing must end it anyway.
    await waitFor(() => !isAlive(t.info.pid) && !isAlive(grandchild));
    expect(manager.get(t.info.id)).toBeUndefined();
  });

  it('a claude that ignores Ctrl+C is killed with its tree after the grace period', async () => {
    const stubborn = new TerminalManager({ spawn: fakeClaude({ stubborn: true }).spawn, maxTerminals: 1, scrollbackBytes: 1024, closeGraceMs: 400 });
    const info = stubborn.create({ cwd: tmpdir(), cols: 80, rows: 24 });
    let output = '';
    const exits: number[] = [];
    stubborn.attach(info.id, { onData: (d) => (output += d), onExit: (c) => exits.push(c) });
    await waitFor(() => /grandchild=\d+/.test(output));
    const grandchild = Number(/grandchild=(\d+)/.exec(output)![1]);

    await stubborn.kill(info.id);
    expect(exits).not.toContain(130);
    await waitFor(() => !isAlive(info.pid) && !isAlive(grandchild));
  });

  it('enforces MAX_TERMINALS', () => {
    open();
    open();
    expect(() => open()).toThrow(TerminalLimitError);
  });

  it('counts only running terminals for MAX_TERMINALS', async () => {
    const first = open();
    open();
    await waitFor(() => first.output().includes('ready'));
    manager.write(first.info.id, 'q');
    await waitFor(() => first.exits.length > 0);
    expect(() => open()).not.toThrow();
  });

  it('keeps a given id, and refuses it while a terminal with that id is still in memory', async () => {
    const id = '0f5c4a9e-7b1d-4c2a-9e3f-1a2b3c4d5e6f';
    expect(manager.create({ id, cwd: tmpdir(), cols: 80, rows: 24 }).id).toBe(id);
    expect(() => manager.create({ id, cwd: tmpdir(), cols: 80, rows: 24 })).toThrow(/already in memory/);
    await manager.kill(id);
    expect(manager.create({ id, cwd: tmpdir(), cols: 80, rows: 24 }).id).toBe(id);
  });
});
