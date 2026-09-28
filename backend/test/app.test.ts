import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { buildApp } from '../src/app.js';
import { AppError } from '../src/common/errors.js';
import { parseWith } from '../src/common/validation.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { TEST_ORIGIN, testConfig } from './helpers.js';

describe('app base', () => {
  let app: FastifyInstance;
  let terminalManager: TerminalManager;

  beforeEach(async () => {
    terminalManager = new TerminalManager({ spawn: () => { throw new Error('no spawn in app tests'); }, maxTerminals: 1, scrollbackBytes: 1024 });
    app = await buildApp({ config: testConfig(), terminalManager, logger: false });
    // Test-only routes to drive the single error handler.
    app.get('/test/boom', { config: { public: true } }, async () => {
      throw new Error('C:\\secret\\path exploded');
    });
    app.get('/test/app-error', { config: { public: true } }, async () => {
      throw new AppError('AUTH_002');
    });
    app.post('/test/validate', { config: { public: true } }, async (request) => parseWith(z.object({ name: z.string().min(1) }), request.body));
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/health → 200 {status:"ok"}', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('unknown route without a session → 401 (routes are not revealed)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(401);
    expect(res.json().errorCode).toBe('AUTH_002');
  });

  it('unexpected error → 500 COMMON_002 without leaking the message', async () => {
    const res = await app.inject({ method: 'GET', url: '/test/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ errorCode: 'COMMON_002', message: 'Internal error' });
  });

  it('AppError → its status and code', async () => {
    const res = await app.inject({ method: 'GET', url: '/test/app-error' });
    expect(res.statusCode).toBe(401);
    expect(res.json().errorCode).toBe('AUTH_002');
  });

  it('zod failure → 400 COMMON_001 with fieldErrors', async () => {
    const res = await app.inject({ method: 'POST', url: '/test/validate', payload: { name: '' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().errorCode).toBe('COMMON_001');
    expect(res.json().fieldErrors[0].field).toBe('name');
  });

  it('malformed JSON → 400 COMMON_001', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/validate',
      headers: { 'content-type': 'application/json' },
      payload: '{not json',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().errorCode).toBe('COMMON_001');
  });

  it('CORS allows only the configured origin, with credentials', async () => {
    const allowed = await app.inject({ method: 'GET', url: '/api/health', headers: { origin: TEST_ORIGIN } });
    expect(allowed.headers['access-control-allow-origin']).toBe(TEST_ORIGIN);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const foreign = await app.inject({ method: 'GET', url: '/api/health', headers: { origin: 'https://evil.example' } });
    expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('closing the app kills every terminal', async () => {
    const killAll = vi.spyOn(terminalManager, 'killAll');
    await app.close();
    expect(killAll).toHaveBeenCalledOnce();
  });
});
