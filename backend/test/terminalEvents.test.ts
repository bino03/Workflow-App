import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';
import { buildApp } from '../src/app.js';
import type { TerminalEventMessage } from '../src/terminals/protocol.js';
import { SESSION_STATE_FILES } from '../src/terminals/sessionState.js';
import type { SessionStateChange } from '../src/terminals/sessionStateWatcher.js';
import { TerminalEvents } from '../src/terminals/terminalEvents.js';
import { WS_CLOSE } from '../src/terminals/terminals.gateway.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import type { TerminalView } from '../src/terminals/terminalsService.js';
import { fakeClaude, waitFor } from './fakeClaude.js';
import { TEST_ORIGIN, TEST_USERNAME, removeDir, testConfig, testStateStore } from './helpers.js';

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ID = '6f1f2a7e-3b0c-4c8e-9a51-2d7f0e4b9c11';

describe('TerminalEvents (ADR 0038)', () => {
  function setup(views: Record<string, Partial<TerminalView> | undefined>) {
    let emit: (change: SessionStateChange) => void = () => {};
    const events = new TerminalEvents({
      watcher: { subscribe: (listener) => ((emit = listener), () => {}) },
      view: (id) => (views[id] ? ({ id, hidden: false, activity: 'waiting', agents: [], ...views[id] } as TerminalView) : undefined),
      debounceMs: 20,
    });
    const sent: TerminalEventMessage[] = [];
    events.subscribe((message) => sent.push(message));
    events.start();
    return { events, sent, emit: (path: string, terminalId = ID) => emit({ terminalId, path }) };
  }

  it('one message per burst of changes, only when activity or agents differ', async () => {
    const views: Record<string, Partial<TerminalView>> = { [ID]: { activity: 'working' } };
    const { events, sent, emit } = setup(views);
    emit('state.json');
    emit('agents/a1.start.json');
    emit('state.json');
    await pause(80);
    expect(sent).toEqual([{ type: 'terminal', id: ID, activity: 'working', agents: [] }]);

    // Same state again → nothing; a new activity → one more.
    emit('state.json');
    await pause(80);
    expect(sent).toHaveLength(1);
    views[ID] = { activity: 'needs-you' };
    emit('state.json');
    await pause(80);
    expect(sent.at(-1)).toMatchObject({ activity: 'needs-you' });
    events.stop();
  });

  it('ignores push.json, tmp files, hidden, non-normal and unknown terminals', async () => {
    const hidden = '0b9e3c1d-2a4f-4e5b-8c6d-7e8f9a0b1c2d';
    const login = 'a5c1e2d3-0000-4000-8000-000000000000';
    const { events, sent, emit } = setup({ [ID]: {}, [hidden]: { hidden: true }, [login]: { activity: null } });
    emit(SESSION_STATE_FILES.push);
    emit('state.json.123.tmp');
    emit('agents/a1.start.json.123.tmp');
    emit('state.json', hidden);
    emit('state.json', login);
    emit('state.json', '11111111-1111-4111-8111-111111111111');
    await pause(80);
    expect(sent).toEqual([]);
    events.stop();
  });
});

describe('/api/terminals/events/ws', () => {
  const PASSWORD = 'events gateway password';
  const base = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfa-events-')));
  const project = join(base, 'root', 'projeto');
  const dataDir = join(base, 'data');
  mkdirSync(project, { recursive: true });
  let app: FastifyInstance;
  let cookie: string;

  async function login() {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: TEST_USERNAME, password: PASSWORD } });
    const session = res.cookies.find((c) => c.name === 'session');
    if (!session) throw new Error('no session cookie');
    return `session=${session.value}`;
  }

  beforeAll(async () => {
    const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
    const config = testConfig({ APP_PASSWORD_HASH: passwordHash, ALLOWED_ROOTS: join(base, 'root'), DATA_DIR: dataDir });
    const terminalManager = new TerminalManager({ spawn: fakeClaude().spawn, maxTerminals: 4, scrollbackBytes: 64 * 1024 });
    app = await buildApp({ stateStore: await testStateStore(), config, terminalManager, logger: false });
    await app.ready();
    cookie = await login();
  });

  afterAll(async () => {
    await app.close();
    removeDir(base);
  });

  async function connect(headers: Record<string, string> = { cookie, origin: TEST_ORIGIN }) {
    const messages: TerminalEventMessage[] = [];
    const closed: { code?: number } = {};
    const ws: WebSocket = await app.injectWS('/api/terminals/events/ws', { headers }, {
      onInit: (socket) => {
        socket.on('message', (data) => messages.push(JSON.parse(data.toString())));
        socket.on('close', (code) => (closed.code = code));
      },
    });
    return { ws, messages, closed };
  }

  async function openTerminal(): Promise<string> {
    const res = await app.inject({ method: 'POST', url: '/api/terminals', headers: { cookie }, payload: { cwd: project, mode: 'new', cols: 80, rows: 24 } });
    expect(res.statusCode).toBe(201);
    return res.json().id;
  }

  /** What the session hook writes (sessionState.ts), atomically. */
  function hookWrites(id: string, activity: string) {
    const dir = join(dataDir, SESSION_STATE_FILES.dir, id);
    mkdirSync(dir, { recursive: true });
    const tmp = join(dir, `${SESSION_STATE_FILES.state}.1.tmp`);
    writeFileSync(tmp, JSON.stringify({ activity, event: 'PermissionRequest', at: new Date().toISOString() }));
    writeFileSync(join(dir, SESSION_STATE_FILES.state), JSON.stringify({ activity, event: 'PermissionRequest', at: new Date().toISOString() }));
  }

  it('refuses without a session, and with a foreign or missing Origin', async () => {
    await expect(connect({ origin: TEST_ORIGIN })).rejects.toThrow(/401/);
    await expect(connect({ cookie, origin: 'https://evil.example' })).rejects.toThrow(/403/);
    await expect(connect({ cookie })).rejects.toThrow(/403/);
  });

  it('pushes the state a hook writes, to every open socket, without a GET', async () => {
    const id = await openTerminal();
    const a = await connect();
    const b = await connect();
    hookWrites(id, 'needs-you');
    await waitFor(() => a.messages.length > 0 && b.messages.length > 0, 5_000);
    expect(a.messages[0]).toEqual({ type: 'terminal', id, activity: 'needs-you', agents: [] });
    expect(b.messages[0]).toEqual(a.messages[0]);

    // What the socket said is what the list says.
    const list = await app.inject({ method: 'GET', url: '/api/terminals', headers: { cookie } });
    expect(list.json().find((t: TerminalView) => t.id === id).activity).toBe('needs-you');

    // Messages from the client are ignored; the socket stays open.
    a.ws.send(JSON.stringify({ type: 'exec', command: 'calc.exe' }));
    hookWrites(id, 'working');
    await waitFor(() => a.messages.length === 2, 5_000);
    expect(a.messages[1]).toMatchObject({ id, activity: 'working' });
    expect(a.ws.readyState).toBe(a.ws.OPEN);
    a.ws.close();
    b.ws.close();
  });

  it('closes with 4401 when the login session ends', async () => {
    const other = await login();
    const socket = await connect({ cookie: other, origin: TEST_ORIGIN });
    await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie: other } });
    await waitFor(() => socket.closed.code !== undefined);
    expect(socket.closed.code).toBe(WS_CLOSE.sessionEnded);
  });
});
