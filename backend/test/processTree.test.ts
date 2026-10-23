import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { descendantsOf, parseLinuxStat, parseWindowsProcessList, readLinuxProcesses } from '../src/common/processTree.js';

describe('parseWindowsProcessList', () => {
  it('reads "<pid> <ppid> <name>" lines, names with spaces included (real Get-CimInstance output)', () => {
    const stdout = '0 0 System Idle Process\r\n4 0 System\r\n176 4 Registry\r\n3740 4 Memory Compression\r\n\r\n';
    expect(parseWindowsProcessList(stdout)).toEqual([
      { pid: 0, ppid: 0, name: 'System Idle Process' },
      { pid: 4, ppid: 0, name: 'System' },
      { pid: 176, ppid: 4, name: 'Registry' },
      { pid: 3740, ppid: 4, name: 'Memory Compression' },
    ]);
  });

  it('skips lines that are not a process row', () => {
    expect(parseWindowsProcessList('garbage\nabc 1 x\n12 3 node.exe')).toEqual([{ pid: 12, ppid: 3, name: 'node.exe' }]);
  });
});

describe('parseLinuxStat', () => {
  it('reads pid, ppid and comm', () => {
    expect(parseLinuxStat('1234 (node) S 1200 1234 1200 0 -1 4194560 120 0 0 0')).toEqual({ pid: 1234, ppid: 1200, name: 'node' });
  });

  it('ends the comm at the last parenthesis (a comm may contain spaces and parentheses)', () => {
    expect(parseLinuxStat('77 (tmux: (server) x) S 1 77 77 0')).toEqual({ pid: 77, ppid: 1, name: 'tmux: (server) x' });
  });

  it('refuses a malformed line', () => {
    expect(parseLinuxStat('nonsense')).toBeUndefined();
    expect(parseLinuxStat('12 (x) S')).toBeUndefined();
  });
});

describe('readLinuxProcesses', () => {
  it('reads every numeric /proc entry and skips the rest and the unreadable', async () => {
    const proc = mkdtempSync(join(tmpdir(), 'wfa-proc-'));
    const stat = (pid: number, name: string, ppid: number) => {
      mkdirSync(join(proc, String(pid)));
      writeFileSync(join(proc, String(pid), 'stat'), `${pid} (${name}) S ${ppid} 0 0`);
    };
    stat(1, 'systemd', 0);
    stat(500, 'claude', 1);
    mkdirSync(join(proc, '600')); // exited between readdir and readFile: no stat
    mkdirSync(join(proc, 'net'));
    writeFileSync(join(proc, 'uptime'), '1 2');
    const rows = await readLinuxProcesses(proc);
    expect(rows.sort((a, b) => a.pid - b.pid)).toEqual([
      { pid: 1, ppid: 0, name: 'systemd' },
      { pid: 500, ppid: 1, name: 'claude' },
    ]);
  });
});

describe('descendantsOf', () => {
  const rows = [
    { pid: 0, ppid: 0, name: 'idle' },
    { pid: 10, ppid: 1, name: 'claude' },
    { pid: 11, ppid: 10, name: 'bash' },
    { pid: 12, ppid: 11, name: 'node' },
    { pid: 13, ppid: 10, name: 'git' },
    { pid: 20, ppid: 1, name: 'other' },
  ];

  it('returns every process below the root, not the root nor its siblings', () => {
    expect(descendantsOf(rows, 10).map((r) => r.pid).sort()).toEqual([11, 12, 13]);
  });

  it('is empty for a leaf or an unknown pid', () => {
    expect(descendantsOf(rows, 12)).toEqual([]);
    expect(descendantsOf(rows, 999)).toEqual([]);
  });

  it('survives a parent loop made by recycled pids', () => {
    const loop = [
      { pid: 30, ppid: 31, name: 'a' },
      { pid: 31, ppid: 30, name: 'b' },
    ];
    expect(descendantsOf(loop, 30).map((r) => r.pid)).toEqual([31]);
  });
});
