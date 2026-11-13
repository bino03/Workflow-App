import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import type { ProcessRow } from '../src/common/processTree.js';
import { removeDir } from './helpers.js';
import {
  type ProcFs,
  type Snapshot,
  belongsToProject,
  carriesPath,
  devPortsOf,
  isLoopbackOrAny,
  parseLinuxTcpTable,
  parseWindowsListeners,
  parseWindowsSnapshot,
  readLinuxListeners,
  readLinuxSnapshot,
  selectDevPorts,
  splitCommandLine,
} from '../src/preview/listeningPorts.js';

describe('isLoopbackOrAny', () => {
  it('accepts what 127.0.0.1 can reach', () => {
    for (const a of ['127.0.0.1', '127.0.1.1', '0.0.0.0', '::', '::1', '::ffff:127.0.0.1']) expect(isLoopbackOrAny(a)).toBe(true);
  });

  it('refuses addresses bound to one interface only (LAN, tailnet)', () => {
    for (const a of ['192.168.1.100', '100.82.195.25', 'fd7a:115c:a1e0::5230:c31a', 'fe80::1']) expect(isLoopbackOrAny(a)).toBe(false);
  });
});

describe('parseWindowsListeners', () => {
  it('reads "<address> <port> <pid>" lines (real Get-NetTCPConnection output)', () => {
    const stdout = ':: 49671 1300\r\n::1 49669 6696\r\nfd7a:115c:a1e0::5230:c31a 49525 24004\r\n127.0.0.1 7400 23164\r\n';
    expect(parseWindowsListeners(stdout)).toEqual([
      { address: '::', port: 49671, pid: 1300 },
      { address: '::1', port: 49669, pid: 6696 },
      { address: 'fd7a:115c:a1e0::5230:c31a', port: 49525, pid: 24004 },
      { address: '127.0.0.1', port: 7400, pid: 23164 },
    ]);
  });
});

const TCP = `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 11111 1 0000000000000000 100 0 0 10 0
   1: 00000000:1435 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 22222 1 0000000000000000 100 0 0 10 0
   2: 0100007F:1F90 0100007F:D2A0 01 00000000:00000000 00:00000000 00000000  1000        0 33333 1 0000000000000000 20 4 30 10 -1
   3: 6401A8C0:0050 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 44444 1 0000000000000000 100 0 0 10 0
`;
const TCP6 = `  sl  local_address                         remote_address                        st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 00000000000000000000000001000000:1F49 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 55555 1 0000000000000000 100 0 0 10 0
   1: 0000000000000000FFFF00000100007F:2328 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 66666 1 0000000000000000 100 0 0 10 0
   2: 00000000000000000000000000000000:23F1 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 77777 1 0000000000000000 100 0 0 10 0
`;

describe('parseLinuxTcpTable', () => {
  it('keeps only LISTEN rows and decodes the little-endian IPv4 address and the port', () => {
    expect(parseLinuxTcpTable(TCP)).toEqual([
      { address: '127.0.0.1', port: 8080, inode: '11111' },
      { address: '0.0.0.0', port: 5173, inode: '22222' },
      { address: '192.168.1.100', port: 80, inode: '44444' },
    ]);
  });

  it('decodes ::1, v4-mapped and any in tcp6', () => {
    expect(parseLinuxTcpTable(TCP6)).toEqual([
      { address: '::1', port: 8009, inode: '55555' },
      { address: '::ffff:127.0.0.1', port: 9000, inode: '66666' },
      { address: '::', port: 9201, inode: '77777' },
    ]);
  });
});

describe('readLinuxListeners', () => {
  /** An in-memory /proc: two processes, their fds pointing at sockets, files and pipes. */
  const fake: ProcFs = {
    readFile: async (path) => {
      if (path.endsWith('tcp6')) return TCP6;
      if (path.endsWith('tcp')) return TCP;
      throw new Error('ENOENT');
    },
    readdir: async (path) => {
      if (path.includes('100')) return ['0', '1', '19', '20'];
      if (path.includes('200')) return ['3'];
      throw new Error('EACCES');
    },
    readlink: async (path) => {
      const links: Record<string, string> = {
        '100/fd/0': '/dev/pts/3',
        '100/fd/1': 'pipe:[999]',
        '100/fd/19': 'socket:[22222]',
        '100/fd/20': 'socket:[55555]',
        '200/fd/3': 'socket:[11111]',
      };
      const key = path.replaceAll('\\', '/').split('/proc/')[1]!;
      if (!(key in links)) throw new Error('ENOENT');
      return links[key]!;
    },
  };

  it('matches each pid to its listening sockets through the fd links', async () => {
    expect(await readLinuxListeners([100, 200, 300], fake, '/proc')).toEqual([
      { address: '0.0.0.0', port: 5173, pid: 100 },
      { address: '::1', port: 8009, pid: 100 },
      { address: '127.0.0.1', port: 8080, pid: 200 },
    ]);
  });
});

describe('splitCommandLine', () => {
  it('splits on whitespace outside quotes and drops the quotes (real Vite command line from node_modules/.bin)', () => {
    expect(splitCommandLine('"node"   "C:\\p\\PortFolio - Frontend\\node_modules\\.bin\\\\..\\vite\\bin\\vite.js" ')).toEqual([
      'node',
      'C:\\p\\PortFolio - Frontend\\node_modules\\.bin\\\\..\\vite\\bin\\vite.js',
    ]);
    expect(splitCommandLine('cmd.exe /d /s /c vite')).toEqual(['cmd.exe', '/d', '/s', '/c', 'vite']);
    expect(splitCommandLine('a "" b')).toEqual(['a', '', 'b']);
  });
});

describe('parseWindowsSnapshot', () => {
  it('reads listeners and processes, with args and exe only where printed', () => {
    const stdout = `\uFEFF${JSON.stringify({
      l: [['::1', 5174, 3764], ['bad']],
      p: [[3764, 21536, 'node.exe', 1794585267825, '"node" "C:\\p\\x.js"', 'C:\\nvm4w\\nodejs\\node.exe'], [4, 0, 'System', 0], ['x']],
    })}`;
    expect(parseWindowsSnapshot(stdout)).toEqual({
      listeners: [{ address: '::1', port: 5174, pid: 3764 }],
      processes: [
        { pid: 3764, ppid: 21536, name: 'node.exe', createdAt: 1794585267825, args: ['node', 'C:\\p\\x.js'], executablePath: 'C:\\nvm4w\\nodejs\\node.exe' },
        { pid: 4, ppid: 0, name: 'System' },
      ],
    });
  });

  it('is empty for output that is not JSON', () => {
    expect(parseWindowsSnapshot('Get-CimInstance : Access denied')).toEqual({ processes: [], listeners: [] });
  });
});

describe('carriesPath (ADR 0032 point 1)', () => {
  const project = 'C:\\Users\\me\\projetos\\PortFolio - Frontend';
  const row = (args: string[], extra: Partial<ProcessRow> = {}): ProcessRow => ({ pid: 1, ppid: 0, name: 'node.exe', args, ...extra });

  it('matches the Vite of node_modules/.bin (with "\\\\.."), another case, --x=<path> and the executable', () => {
    expect(carriesPath(row(['node', `${project}\\node_modules\\.bin\\\\..\\vite\\bin\\vite.js`]), project, 'win32')).toBe(true);
    expect(carriesPath(row(['node', 'c:/users/ME/projetos/portfolio - frontend/server.js']), project, 'win32')).toBe(true);
    expect(carriesPath(row(['vite', `--root=${project}`]), project, 'win32')).toBe(true);
    expect(carriesPath(row([], { executablePath: `${project}\\bin\\app.exe` }), project, 'win32')).toBe(true);
  });

  it('needs a path boundary: a sibling folder with the same prefix is not the project', () => {
    expect(carriesPath(row(['node', `${project}-x\\vite.js`]), project, 'win32')).toBe(false);
    expect(carriesPath(row(['node', 'C:\\Users\\me\\projetos\\PortFolio']), project, 'win32')).toBe(false);
  });

  it('never matches relative arguments, the global node, nor a ".." that leaves the folder', () => {
    expect(carriesPath(row(['cmd.exe', '/d', '/s', '/c', 'vite'], { executablePath: 'C:\\WINDOWS\\system32\\cmd.exe' }), project, 'win32')).toBe(false);
    expect(carriesPath(row(['node', 'PortFolio - Frontend\\vite.js']), project, 'win32')).toBe(false);
    expect(carriesPath(row(['node', `${project}\\..\\other\\vite.js`]), project, 'win32')).toBe(false);
  });

  it('on Linux uses the cwd too, and is case-sensitive', () => {
    expect(carriesPath(row(['node', 'vite'], { cwd: '/home/me/loja/frontend' }), '/home/me/loja', 'posix')).toBe(true);
    expect(carriesPath(row(['node', '/home/me/Loja/vite.js']), '/home/me/loja', 'posix')).toBe(false);
    expect(carriesPath(row(['node'], { cwd: '/home/me/loja-x' }), '/home/me/loja', 'posix')).toBe(false);
  });
});

const ORPHAN_PATH = 'C:\\proj\\PortFolio';
const CORRER = new Date('2026-11-13T15:54:20Z');

/** The orphan seen in passo 8 (2026-11-13): vite ← cmd ← npm ← bash ← bash ← (dead), all created after the Correr. */
function orphanSnapshot(): Snapshot {
  const t = Date.parse('2026-11-13T15:54:27Z');
  return {
    listeners: [
      { address: '::1', port: 5174, pid: 3764 },
      { address: '127.0.0.1', port: 7400, pid: 8920 },
      { address: '0.0.0.0', port: 5173, pid: 20468 },
      { address: '127.0.0.1', port: 6000, pid: 600 },
    ],
    processes: [
      { pid: 8920, ppid: 1, name: 'node.exe', createdAt: t - 3_600_000, args: ['node', 'src/server.ts'] },
      { pid: 500, ppid: 8920, name: 'claude.exe', createdAt: t - 2_000, args: ['claude.exe'] },
      { pid: 21924, ppid: 21720, name: 'bash.exe', createdAt: t + 100, args: ['bash.exe', '/c/nvm4w/nodejs/npm', 'run', 'dev'] },
      { pid: 4992, ppid: 21924, name: 'bash.exe', createdAt: t + 400, args: ['bash.exe', '/c/nvm4w/nodejs/npm', 'run', 'dev'] },
      { pid: 1244, ppid: 4992, name: 'node.exe', createdAt: t + 500, args: ['node.exe', 'npm-cli.js', 'run', 'dev'] },
      { pid: 21536, ppid: 1244, name: 'cmd.exe', createdAt: t + 700, args: ['cmd.exe', '/c', 'vite'] },
      { pid: 3764, ppid: 21536, name: 'node.exe', createdAt: t + 800, args: ['node', `${ORPHAN_PATH}\\node_modules\\.bin\\\\..\\vite\\bin\\vite.js`] },
      // The same project's Vite, up long before the Correr.
      { pid: 20468, ppid: 1, name: 'node.exe', createdAt: t - 7_200_000, args: ['node', `${ORPHAN_PATH}\\node_modules\\vite\\bin\\vite.js`] },
      // A server below the run's terminal: always counts.
      { pid: 600, ppid: 500, name: 'python.exe', createdAt: t + 50, args: ['python', '-m', 'http.server'] },
    ],
  };
}

describe('selectDevPorts (ADR 0032)', () => {
  it('an app run sees the descendants and the orphan Vite, not the backend nor an older server', () => {
    const query = { rootPid: 500, owner: { path: ORPHAN_PATH, since: CORRER, when: 'always' as const } };
    expect(selectDevPorts(orphanSnapshot(), query, { exclude: [7400], platform: 'win32' })).toEqual([
      { port: 5174, pid: 3764, process: 'node.exe' },
      { port: 6000, pid: 600, process: 'python.exe' },
    ]);
  });

  it('without an owner only the descendants count: the orphan is invisible (the bug of passo 8)', () => {
    expect(selectDevPorts(orphanSnapshot(), { rootPid: 500 }, { platform: 'win32' }).map((p) => p.port)).toEqual([6000]);
  });

  it('a preview falls back to the project only when nothing below the terminal listens', () => {
    const owner = { path: ORPHAN_PATH, since: CORRER, when: 'no-descendants' as const };
    expect(selectDevPorts(orphanSnapshot(), { rootPid: 500, owner }, { platform: 'win32' }).map((p) => p.port)).toEqual([6000]);
    expect(selectDevPorts(orphanSnapshot(), { rootPid: 999, owner }, { platform: 'win32' }).map((p) => p.port)).toEqual([5174]);
  });

  it('a Correr after the server started does not adopt it', () => {
    const owner = { path: ORPHAN_PATH, since: new Date('2026-11-13T16:10:00Z'), when: 'always' as const };
    expect(selectDevPorts(orphanSnapshot(), { owner }, { platform: 'win32' })).toEqual([]);
  });
});

describe('belongsToProject', () => {
  const t = Date.parse('2026-11-13T15:00:00Z');
  const owner = { path: 'C:\\proj\\loja', since: new Date(t) };
  const map = (rows: ProcessRow[]) => new Map(rows.map((r) => [r.pid, r]));

  it('climbs to a parent that carries the path', () => {
    const rows = map([
      { pid: 2, ppid: 1, name: 'npm', createdAt: t + 10, args: ['node', 'C:\\proj\\loja\\node_modules\\npm\\cli.js'] },
      { pid: 3, ppid: 2, name: 'node', createdAt: t + 20, args: ['node', 'server.js'] },
    ]);
    expect(belongsToProject(rows, 3, owner, 'win32')).toBe(true);
  });

  it('stops at a recycled pid: a "parent" younger than its child is not its parent', () => {
    const rows = map([
      { pid: 2, ppid: 1, name: 'code', createdAt: t + 500, args: ['code', 'C:\\proj\\loja'] },
      { pid: 3, ppid: 2, name: 'node', createdAt: t + 20, args: ['node', 'server.js'] },
    ]);
    expect(belongsToProject(rows, 3, owner, 'win32')).toBe(false);
  });

  it('stops at a parent older than the Correr (an editor opened on the folder before)', () => {
    const rows = map([
      { pid: 2, ppid: 1, name: 'Code.exe', createdAt: t - 3_600_000, args: ['Code.exe', 'C:\\proj\\loja'] },
      { pid: 3, ppid: 2, name: 'node', createdAt: t + 20, args: ['node', 'server.js'] },
    ]);
    expect(belongsToProject(rows, 3, owner, 'win32')).toBe(false);
  });

  it('a tool started with the folder in its arguments seconds before the Correr does not adopt its children', () => {
    // Seen for real: the verification script (`node app-run-real.mjs "<project>"`) and the Chrome it opened, with its
    // debugging port, 3 s before the Correr.
    const rows = map([
      { pid: 2, ppid: 1, name: 'node.exe', createdAt: t - 3_000, args: ['node', 'app-run-real.mjs', 'C:\\proj\\loja'] },
      { pid: 3, ppid: 2, name: 'chrome.exe', createdAt: t - 2_500, args: ['chrome.exe', '--remote-debugging-port=9335'] },
    ]);
    expect(belongsToProject(rows, 3, owner, 'win32')).toBe(false);
    // Within the clocks' room (≤ 1 s) it still counts.
    expect(belongsToProject(map([{ pid: 3, ppid: 1, name: 'node', createdAt: t - 800, args: ['node', 'C:\\proj\\loja\\vite.js'] }]), 3, owner, 'win32')).toBe(true);
  });

  it('gives up after 8 parents', () => {
    const rows: ProcessRow[] = [{ pid: 100, ppid: 1, name: 'root', createdAt: t + 1, args: ['x', 'C:\\proj\\loja'] }];
    for (let pid = 101; pid <= 110; pid++) rows.push({ pid, ppid: pid - 1, name: 'sh', createdAt: t + pid, args: ['sh'] });
    expect(belongsToProject(map(rows), 108, owner, 'win32')).toBe(true);
    expect(belongsToProject(map(rows), 110, owner, 'win32')).toBe(false);
  });
});

describe('readLinuxSnapshot', () => {
  it('reads args and cwd only for the listeners and their parents', async () => {
    const reads: string[] = [];
    const fake: ProcFs = {
      readFile: async (path) => {
        const p = path.replaceAll('\\', '/');
        reads.push(p);
        if (p.endsWith('net/tcp')) return TCP;
        if (p.endsWith('net/tcp6')) return '';
        if (p.endsWith('/100/cmdline')) return 'node\0/home/me/loja/node_modules/.bin/vite\0';
        if (p.endsWith('/50/cmdline')) return 'npm\0run\0dev\0';
        throw new Error('ENOENT');
      },
      readdir: async (path) => (path.replaceAll('\\', '/').endsWith('/100/fd') ? ['19'] : []),
      readlink: async (path) => {
        const p = path.replaceAll('\\', '/');
        reads.push(p);
        if (p.endsWith('/100/fd/19')) return 'socket:[22222]';
        if (p.endsWith('/100/cwd') || p.endsWith('/50/cwd')) return '/home/me/loja';
        throw new Error('ENOENT');
      },
    };
    const processes: ProcessRow[] = [
      { pid: 1, ppid: 0, name: 'init', createdAt: 1 },
      { pid: 50, ppid: 1, name: 'npm', createdAt: 10 },
      { pid: 100, ppid: 50, name: 'node', createdAt: 20 },
      { pid: 200, ppid: 1, name: 'other', createdAt: 30 },
    ];
    const snapshot = await readLinuxSnapshot((rows) => rows.map((r) => r.pid), fake, '/proc', async () => processes);
    expect(snapshot.listeners).toEqual([{ address: '0.0.0.0', port: 5173, pid: 100 }]);
    expect(snapshot.processes.find((r) => r.pid === 100)).toMatchObject({ args: ['node', '/home/me/loja/node_modules/.bin/vite'], cwd: '/home/me/loja' });
    expect(snapshot.processes.find((r) => r.pid === 50)).toMatchObject({ args: ['npm', 'run', 'dev'], cwd: '/home/me/loja' });
    expect(reads.some((p) => p.includes('/200/cmdline') || p.includes('/200/cwd'))).toBe(false);
  });
});

describe('devPortsOf (real processes)', () => {
  const children: ChildProcess[] = [];
  const pids: number[] = [];
  const folder = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfa-orphan-')));
  afterEach(() => {
    for (const child of children.splice(0)) child.kill();
    for (const pid of pids.splice(0)) {
      try {
        process.kill(pid);
      } catch {
        // Already gone.
      }
    }
  });
  afterAll(() => removeDir(folder));

  it('finds the port a child process listens on, with its name, and honours the exclusions', async () => {
    const child = spawn(process.execPath, ['-e', "require('http').createServer().listen(0, '127.0.0.1', function () { console.log(this.address().port) })"]);
    children.push(child);
    const port = await new Promise<number>((resolve) => child.stdout!.once('data', (d) => resolve(Number(String(d).trim()))));

    const found = await devPortsOf({ rootPid: process.pid });
    const mine = found.find((p) => p.port === port);
    expect(mine).toMatchObject({ port, pid: child.pid });
    expect(mine!.process.toLowerCase()).toContain('node');

    expect((await devPortsOf({ rootPid: process.pid }, { exclude: [port] })).some((p) => p.port === port)).toBe(false);
    expect(await devPortsOf({ rootPid: child.pid! })).toEqual([]);
  }, 30_000);

  it('finds an orphan server by the project folder in its command line (ADR 0032)', async () => {
    const since = new Date();
    // A middle process starts a detached server whose command line carries `folder`, prints its pid and exits —
    // like the bash a Claude Code background task runs through.
    const server = "require('http').createServer().listen(0, '127.0.0.1', function () { require('fs').writeFileSync(process.argv[1] + '/port', String(this.address().port)) })";
    const middle = spawn(
      process.execPath,
      [
        '-e',
        `const c = require('child_process').spawn(process.execPath, ['-e', ${JSON.stringify(server)}, process.argv[1]], { detached: true, stdio: 'ignore' }); c.unref(); console.log(c.pid)`,
        folder,
      ],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    const serverPid = await new Promise<number>((resolve) => middle.stdout!.once('data', (d) => resolve(Number(String(d).trim()))));
    pids.push(serverPid);
    if (middle.exitCode === null) await new Promise((resolve) => middle.once('exit', resolve));
    const portFile = join(folder, 'port');
    for (let i = 0; i < 200 && !existsSync(portFile); i++) await new Promise((r) => setTimeout(r, 50));
    const port = Number(readFileSync(portFile, 'utf8'));

    // Its parent is gone: the tree no longer reaches it.
    expect((await devPortsOf({ rootPid: process.pid })).some((p) => p.port === port)).toBe(false);
    // By the folder, created after `since`, it is found.
    const owned = await devPortsOf({ rootPid: process.pid, owner: { path: folder, since, when: 'always' } });
    expect(owned.find((p) => p.port === port)).toMatchObject({ port, pid: serverPid });
    // A sibling folder with the same prefix, or a start after it was up, does not adopt it.
    expect((await devPortsOf({ owner: { path: `${folder}-x`, since, when: 'always' } })).some((p) => p.port === port)).toBe(false);
    const later = new Date(Date.now() + 60_000);
    expect((await devPortsOf({ owner: { path: folder, since: later, when: 'always' } })).some((p) => p.port === port)).toBe(false);
  }, 30_000);
});
