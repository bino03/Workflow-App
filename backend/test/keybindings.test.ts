import { dirname } from 'node:path';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { KeybindingsView } from '../src/keybindings/keybindingsService.js';
import { StateStore } from '../src/state/stateStore.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { fakeClaude } from './fakeClaude.js';
import { TEST_USERNAME, testConfig, testStateStore } from './helpers.js';

const PASSWORD = 'keybindings password';

let app: FastifyInstance;
let stateStore: StateStore;
let cookie: string;

beforeAll(async () => {
  const config = testConfig({ APP_PASSWORD_HASH: await argon2.hash(PASSWORD, { type: argon2.argon2id }) });
  const terminalManager = new TerminalManager({ spawn: fakeClaude().spawn, maxTerminals: 4, scrollbackBytes: 1024 });
  stateStore = await testStateStore();
  app = await buildApp({ stateStore, config, terminalManager, logger: false });
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: TEST_USERNAME, password: PASSWORD } });
  cookie = `session=${login.cookies.find((c) => c.name === 'session')!.value}`;
});

afterAll(async () => {
  await app.close();
});

const get = () => app.inject({ method: 'GET', url: '/api/keybindings', headers: { cookie } });
const put = (actionId: string, binding: unknown) =>
  app.inject({ method: 'PUT', url: `/api/keybindings/${actionId}`, headers: { cookie }, payload: { binding } });
const del = (actionId: string) => app.inject({ method: 'DELETE', url: `/api/keybindings/${actionId}`, headers: { cookie } });
const resetAll = () => app.inject({ method: 'POST', url: '/api/keybindings/reset', headers: { cookie } });
const bindingOf = (view: KeybindingsView, id: string) => view.actions.find((a) => a.id === id)?.binding;

describe('/api/keybindings', () => {
  it('needs a session', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/keybindings' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'PUT', url: '/api/keybindings/newTerminal', payload: { binding: null } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'DELETE', url: '/api/keybindings/newTerminal' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/keybindings/reset' })).statusCode).toBe(401);
  });

  it('GET: every action with its default, the new ones without a binding, and the warnings', async () => {
    const view = (await get()).json<KeybindingsView>();
    expect(bindingOf(view, 'newTerminal')).toEqual({ modifier: 'alt', code: 'KeyN' });
    expect(bindingOf(view, 'toggleSidebar')).toEqual({ modifier: 'altGraph', code: 'Period' });
    expect(bindingOf(view, 'jump9')).toEqual({ modifier: 'alt', code: 'Digit9' });
    for (const id of ['projectNext', 'projectPrev', 'projectClose', 'terminalNext', 'terminalPrev', 'goTerminals', 'goLibrary']) {
      expect(bindingOf(view, id)).toBeNull();
    }
    expect(view.actions.filter((a) => a.group === 'jump')).toHaveLength(9);
    expect(view.warnings.some((w) => w.code === 'KeyB')).toBe(true);
  });

  it('PUT changes a binding, keeps only the change in state.json, and survives a reload', async () => {
    const res = await put('jump1', { modifier: 'alt', code: 'KeyQ' });
    expect(res.statusCode).toBe(200);
    expect(bindingOf(res.json(), 'jump1')).toEqual({ modifier: 'alt', code: 'KeyQ' });
    expect(stateStore.read().keybindings).toEqual({ jump1: { modifier: 'alt', code: 'KeyQ' } });

    await stateStore.flush();
    const reloaded = await StateStore.load(dirname(stateStore.file));
    expect(reloaded.read().keybindings).toEqual({ jump1: { modifier: 'alt', code: 'KeyQ' } });
    await resetAll();
  });

  it('PUT null removes a binding; putting the default back removes the change', async () => {
    expect(bindingOf((await put('closeTerminal', null)).json(), 'closeTerminal')).toBeNull();
    expect(stateStore.read().keybindings).toEqual({ closeTerminal: null });

    expect(bindingOf((await put('closeTerminal', { modifier: 'alt', code: 'KeyW' })).json(), 'closeTerminal')).toEqual({
      modifier: 'alt',
      code: 'KeyW',
    });
    expect(stateStore.read().keybindings).toEqual({});
  });

  it('a new action gets a binding', async () => {
    const view = (await put('projectNext', { modifier: 'alt', code: 'KeyP' })).json<KeybindingsView>();
    expect(bindingOf(view, 'projectNext')).toEqual({ modifier: 'alt', code: 'KeyP' });
    await resetAll();
  });

  it('a combination another action uses → 409 KEYBIND_002, nothing changes', async () => {
    const res = await put('projectNext', { modifier: 'alt', code: 'KeyN' }); // newTerminal's default
    expect(res.statusCode).toBe(409);
    expect(res.json().errorCode).toBe('KEYBIND_002');
    expect(stateStore.read().keybindings).toEqual({});

    // Free it first, then it can move.
    await put('newTerminal', null);
    expect((await put('projectNext', { modifier: 'alt', code: 'KeyN' })).statusCode).toBe(200);
    await resetAll();
  });

  it.each([
    ['Esc', { modifier: 'alt', code: 'Escape' }],
    ['an arrow (browser back)', { modifier: 'alt', code: 'ArrowLeft' }],
    ['F4', { modifier: 'alt', code: 'F4' }],
    ['AltGr with a letter', { modifier: 'altGraph', code: 'KeyA' }],
    ['a non-canonical code', { modifier: 'alt', code: 'Backquote' }],
  ])('a combination that is not allowed (%s) → 400 KEYBIND_001', async (_case, binding) => {
    const res = await put('projectNext', binding);
    expect(res.statusCode).toBe(400);
    expect(res.json().errorCode).toBe('KEYBIND_001');
  });

  it('a modifier outside alt/altGraph (Ctrl) → 400 COMMON_001', async () => {
    const res = await put('projectNext', { modifier: 'ctrl', code: 'KeyN' });
    expect(res.statusCode).toBe(400);
    expect(res.json().errorCode).toBe('COMMON_001');
  });

  it('an unknown action → 404 KEYBIND_003', async () => {
    expect((await put('nope', null)).json().errorCode).toBe('KEYBIND_003');
    expect((await del('nope')).statusCode).toBe(404);
  });

  it('DELETE puts one action back on its default; POST reset puts them all back', async () => {
    await put('newTerminal', { modifier: 'alt', code: 'KeyM' });
    await put('zoomIn', null);
    expect(bindingOf((await del('newTerminal')).json(), 'newTerminal')).toEqual({ modifier: 'alt', code: 'KeyN' });
    expect(stateStore.read().keybindings).toEqual({ zoomIn: null });

    const view = (await resetAll()).json<KeybindingsView>();
    expect(bindingOf(view, 'zoomIn')).toEqual({ modifier: 'alt', code: 'Equal' });
    expect(stateStore.read().keybindings).toEqual({});
  });
});
