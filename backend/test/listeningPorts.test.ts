import { type ChildProcess, spawn } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type ProcFs,
  devPortsOf,
  isLoopbackOrAny,
  parseLinuxTcpTable,
  parseWindowsListeners,
  readLinuxListeners,
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

describe('devPortsOf (real processes)', () => {
  let child: ChildProcess | undefined;
  afterEach(() => child?.kill());

  it('finds the port a child process listens on, with its name, and honours the exclusions', async () => {
    child = spawn(process.execPath, ['-e', "require('http').createServer().listen(0, '127.0.0.1', function () { console.log(this.address().port) })"]);
    const port = await new Promise<number>((resolve) => child!.stdout!.once('data', (d) => resolve(Number(String(d).trim()))));

    const found = await devPortsOf(process.pid);
    const mine = found.find((p) => p.port === port);
    expect(mine).toMatchObject({ port, pid: child.pid });
    expect(mine!.process.toLowerCase()).toContain('node');

    expect((await devPortsOf(process.pid, { exclude: [port] })).some((p) => p.port === port)).toBe(false);
    expect(await devPortsOf(child.pid!)).toEqual([]);
  }, 30_000);
});
