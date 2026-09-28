import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';
import { buildApp } from '../src/app.js';
import { WS_CLOSE } from '../src/terminals/terminals.gateway.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { fakeClaude, waitFor } from './fakeClaude.js';
import { TEST_ORIGIN, TEST_USERNAME, testConfig, testStateStore } from './helpers.js';

const PASSWORD = 'terminals gateway password';
const SECRET = 'segredo-escrito-no-terminal-42';

const base = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfa-gateway-')));
const project = join(base, 'root', 'projeto');
mkdirSync(project, { recursive: true });

type Frame = { binary: boolean; text: string };

/** Collects every frame and the close code of a socket — attached before the first frame can arrive. */
function record(ws: WebSocket) {
  const frames: Frame[] = [];
  const closed: { code?: number } = {};
  ws.on('message', (data, isBinary) => frames.push({ binary: isBinary, text: data.toString() }));
  ws.on('close', (code) => (closed.code = code));
  const output = () => frames.filter((f) => f.binary).map((f) => f.text).join('');
  const controls = () => frames.filter((f) => !f.binary).map((f) => JSON.parse(f.text));
  return { frames, closed, output, controls };
}

describe('/api/terminals/:id/ws', () => {
  let app: FastifyInstance;
  let cookie: string;
  const logs: string[] = [];

  async function login() {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: TEST_USERNAME, password: PASSWORD } });
    const session = res.cookies.find((c) => c.name === 'session');
    if (!session) throw new Error('no session cookie');
    return `session=${session.value}`;
  }

  beforeAll(async () => {
    const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
    const logStream = new PassThrough();
    logStream.on('data', (chunk) => logs.push(chunk.toString()));
    const config = testConfig({ APP_PASSWORD_HASH: passwordHash, ALLOWED_ROOTS: join(base, 'root'), LOG_LEVEL: 'trace' });
    const terminalManager = new TerminalManager({ spawn: fakeClaude().spawn, maxTerminals: 4, scrollbackBytes: 64 * 1024 });
    app = await buildApp({ stateStore: await testStateStore(), config, terminalManager, logStream });
    await app.ready();
    cookie = await login();
  });

  afterAll(async () => {
    await app.close();
    rmSync(base, { recursive: true, force: true });
  });

  async function openTerminal(): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/terminals',
      headers: { cookie },
      payload: { cwd: project, mode: 'new', cols: 80, rows: 24 },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id;
  }

  async function connect(id: string, headers: Record<string, string> = { cookie, origin: TEST_ORIGIN }) {
    let recorder: ReturnType<typeof record> | undefined;
    const ws = await app.injectWS(`/api/terminals/${id}/ws`, { headers }, { onInit: (socket) => (recorder = record(socket)) });
    return { ws, ...recorder! };
  }

  it('refuses without a session, and with a foreign or missing Origin', async () => {
    const id = await openTerminal();
    await expect(connect(id, { origin: TEST_ORIGIN })).rejects.toThrow(/401/);
    await expect(connect(id, { cookie, origin: 'https://evil.example' })).rejects.toThrow(/403/);
    await expect(connect(id, { cookie })).rejects.toThrow(/403/);
  });

  it('ready first, then the scrollback, then live output; binary in goes to the PTY', async () => {
    const id = await openTerminal();
    const early = await connect(id);
    await waitFor(() => early.output().includes('ready grandchild='));
    expect(early.frames[0]).toEqual({ binary: false, text: JSON.stringify({ type: 'ready', status: 'running', exitCode: null }) });

    // A late client gets ready → scrollback before anything else.
    const late = await connect(id);
    await waitFor(() => late.frames.length >= 2);
    expect(late.frames[0]).toEqual({ binary: false, text: JSON.stringify({ type: 'ready', status: 'running', exitCode: null }) });
    expect(late.frames[1]!.binary).toBe(true);
    expect(late.frames[1]!.text).toContain('ready grandchild=');

    late.ws.send(Buffer.from(SECRET), { binary: true });
    await waitFor(() => late.output().includes(`echo:${SECRET}`));
    // Every client of the terminal sees the live output.
    await waitFor(() => early.output().includes(`echo:${SECRET}`));
  });

  it('text frames: resize is applied, anything else is ignored', async () => {
    const id = await openTerminal();
    const socket = await connect(id);
    await waitFor(() => socket.output().includes('ready'));

    socket.ws.send('not json');
    socket.ws.send(JSON.stringify({ type: 'resize', cols: 5000, rows: 10 })); // out of range
    socket.ws.send(JSON.stringify({ type: 'exec', command: 'calc.exe' }));
    socket.ws.send(JSON.stringify({ type: 'resize', cols: 101, rows: 33 }));
    await waitFor(() => socket.output().includes('size:101x33'));
    expect(socket.output()).not.toContain('size:5000');
    expect(socket.ws.readyState).toBe(socket.ws.OPEN);
  });

  it('sends exit when the process ends, and ready says exited to a late client', async () => {
    const id = await openTerminal();
    const socket = await connect(id);
    await waitFor(() => socket.output().includes('ready'));
    socket.ws.send(Buffer.from('q'), { binary: true });
    await waitFor(() => socket.controls().some((c) => c.type === 'exit'));
    expect(socket.controls().at(-1)).toEqual({ type: 'exit', code: 3 });

    const late = await connect(id);
    await waitFor(() => late.frames.length > 0);
    expect(late.controls()[0]).toEqual({ type: 'ready', status: 'exited', exitCode: 3 });
  });

  it('closes with 4404 for an unknown terminal, and when the terminal is closed', async () => {
    const unknown = await connect('00000000-0000-4000-8000-000000000000');
    await waitFor(() => unknown.closed.code !== undefined);
    expect(unknown.closed.code).toBe(WS_CLOSE.terminalGone);

    const id = await openTerminal();
    const socket = await connect(id);
    await waitFor(() => socket.output().includes('ready'));
    await app.inject({ method: 'DELETE', url: `/api/terminals/${id}`, headers: { cookie } });
    await waitFor(() => socket.closed.code !== undefined);
    expect(socket.closed.code).toBe(WS_CLOSE.terminalGone);
  });

  it('closes with 4401 when the login session ends', async () => {
    const other = await login();
    const id = await openTerminal();
    const socket = await connect(id, { cookie: other, origin: TEST_ORIGIN });
    await waitFor(() => socket.output().includes('ready'));
    await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie: other } });
    await waitFor(() => socket.closed.code !== undefined);
    expect(socket.closed.code).toBe(WS_CLOSE.sessionEnded);
  });

  it('never writes the terminal content to the log', () => {
    const all = logs.join('');
    expect(all).toContain('terminal socket opened');
    expect(all).not.toContain(SECRET);
    expect(all).not.toContain('grandchild=');
  });
});
