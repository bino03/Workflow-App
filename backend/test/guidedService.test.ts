import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '../src/common/errors.js';
import { GUIDED_FILES } from '../src/guided/guidedFiles.js';
import { GuidedService, type GuidedServiceDeps } from '../src/guided/guidedService.js';
import type { CreateGuidedTerminal, TerminalView } from '../src/terminals/terminalsService.js';
import { removeDir } from './helpers.js';

type Terminals = GuidedServiceDeps['terminals'];

/** Terminals that only remember what they were asked: the service's own logic is what is under test. */
function fakeTerminals() {
  const calls: { created: CreateGuidedTerminal[]; pasted: { id: string; text: string }[]; closed: string[]; reopened: string[]; revealed: string[] } = {
    created: [],
    pasted: [],
    closed: [],
    reopened: [],
    revealed: [],
  };
  const status = new Map<string, TerminalView['status']>();
  const view = (id: string) => ({ id, status: status.get(id) ?? 'stopped' }) as TerminalView;
  const terminals: Terminals = {
    createGuided: async (request) => {
      calls.created.push(request);
      const id = randomUUID();
      status.set(id, 'running');
      return view(id);
    },
    get: (id) => (status.has(id) ? view(id) : undefined),
    reveal: (id) => (calls.revealed.push(id), view(id)),
    close: async (id) => {
      if (!status.has(id)) throw new AppError('TERMINAL_001');
      calls.closed.push(id);
      status.delete(id);
    },
    reopen: async (id) => {
      calls.reopened.push(id);
      status.set(id, 'running');
      return { ...view(id), freshSession: false };
    },
    paste: async (id, text) => void calls.pasted.push({ id, text }),
  };
  return { terminals, calls, status };
}

const ALIVE = 1111;
const DEAD = 2222;

describe('GuidedService', () => {
  let dataDir: string;
  let fake: ReturnType<typeof fakeTerminals>;
  let service: GuidedService;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'wfa-guided-service-'));
    fake = fakeTerminals();
    service = new GuidedService({ dataDir, terminals: fake.terminals, isAlive: (pid) => pid === ALIVE });
  });
  afterEach(() => removeDir(dataDir));

  const dirOf = (id: string) => join(dataDir, GUIDED_FILES.dir, id);
  const writePending = (id: string, pending: { requestId: string } & Record<string, unknown>) =>
    writeFileSync(join(dirOf(id), `pending-${pending.requestId}.json`), JSON.stringify({ pid: ALIVE, at: new Date().toISOString(), ...pending }));
  const question = (requestId = randomUUID()) => ({
    type: 'question',
    requestId,
    questions: [
      { question: 'Which colour?', header: 'Colour', multiSelect: false, options: [{ label: 'Red', description: 'warm' }] },
      { question: 'Which extras?', header: 'Extras', multiSelect: true, options: [{ label: 'Wheels', description: '' }] },
    ],
  });
  const setEvent = (id: string, event: string) => writeFileSync(join(dirOf(id), 'event.json'), JSON.stringify({ event, at: new Date().toISOString() }));

  async function started() {
    return service.start({ purpose: 'create', cwd: 'C:\\Workflow', input: 'Uma app de ginásio' });
  }

  it('start: brief and session index written before the terminal; the launch names the brief and the folder', async () => {
    const view = await started();
    const [request] = fake.calls.created;
    expect(request).toMatchObject({ guidedId: view.id, purpose: 'create', cwd: 'C:\\Workflow', inputPath: join(dirOf(view.id), 'brief.md'), addDirs: [dirOf(view.id)] });
    expect(readFileSync(join(dirOf(view.id), 'brief.md'), 'utf8')).toBe('Uma app de ginásio\n');
    expect(readFileSync(join(dataDir, GUIDED_FILES.dir, GUIDED_FILES.bySession, request!.sessionId), 'utf8')).toBe(view.id);
    expect(view).toMatchObject({ status: 'working', pending: null, result: null, purpose: 'create' });
    expect(service.list('create').map((v) => v.id)).toEqual([view.id]);
  });

  it('start that fails to launch leaves nothing behind', async () => {
    fake.terminals.createGuided = async () => {
      throw new AppError('TERMINAL_007');
    };
    await expect(started()).rejects.toMatchObject({ code: 'TERMINAL_007' });
    expect(readdirSync(join(dataDir, GUIDED_FILES.dir)).filter((n) => n !== GUIDED_FILES.bySession)).toEqual([]);
    expect(readdirSync(join(dataDir, GUIDED_FILES.dir, GUIDED_FILES.bySession))).toEqual([]);
  });

  it('derived status: working → question → permission → waiting-text → needs-you', async () => {
    const { id } = await started();
    const q = question();
    writePending(id, q);
    expect(service.get(id)).toMatchObject({ status: 'question', pending: { type: 'question', requestId: q.requestId, questions: q.questions } });

    const p = { type: 'permission', requestId: randomUUID(), tool: 'Bash', summary: 'git init' };
    writeFileSync(join(dirOf(id), `pending-${q.requestId}.json`), '{"broken');
    writePending(id, p);
    expect(service.get(id)).toMatchObject({ status: 'permission', pending: { type: 'permission', tool: 'Bash', summary: 'git init' } });

    for (const name of readdirSync(dirOf(id)).filter((n) => n.startsWith('pending-'))) writeFileSync(join(dirOf(id), name), '');
    setEvent(id, 'Stop');
    // The hook writes atomically: an unreadable pending is junk, ignored.
    expect(service.get(id).status).toBe('waiting-text');
  });

  it('the last event decides when nothing waits; a pending whose hook died is needs-you', async () => {
    const { id } = await started();
    setEvent(id, 'Stop');
    expect(service.get(id).status).toBe('waiting-text');
    setEvent(id, 'Notification');
    expect(service.get(id).status).toBe('needs-you');
    setEvent(id, 'Answered');
    expect(service.get(id).status).toBe('working');
    writePending(id, { ...question(), pid: DEAD });
    expect(service.get(id)).toMatchObject({ status: 'needs-you', pending: null });
  });

  it('a result decides first; an invalid one is failed with the field; a stopped terminal is stopped', async () => {
    const { id, terminalId } = await started();
    writeFileSync(join(dirOf(id), 'result.json'), JSON.stringify({ version: 1, status: 'done', projectPath: 'C:\\p\\Ginasio', projectName: 'Ginasio', summary: '# ok', openDecisions: ['x'], nextStep: '/implement-todo' }));
    expect(service.get(id)).toMatchObject({ status: 'done', result: { projectName: 'Ginasio', openDecisions: ['x'] }, error: null });
    writeFileSync(join(dirOf(id), 'result.json'), JSON.stringify({ version: 1, status: 'failed', summary: '', error: 'Cancelado pelo utilizador' }));
    expect(service.get(id)).toMatchObject({ status: 'failed', error: 'Cancelado pelo utilizador', result: { projectPath: null } });
    writeFileSync(join(dirOf(id), 'result.json'), JSON.stringify({ version: 2, status: 'done' }));
    expect(service.get(id)).toMatchObject({ status: 'failed', result: null, error: expect.stringContaining('version') });

    rmSync(join(dirOf(id), 'result.json'));
    fake.status.set(terminalId, 'exited');
    expect(service.get(id).status).toBe('stopped');
  });

  it('answer: the waiting question only, one answer per question; written for the hook', async () => {
    const { id } = await started();
    const q = question();
    writePending(id, q);
    await expect(service.answer(id, { requestId: randomUUID(), answers: {} })).rejects.toMatchObject({ code: 'GUIDED_002' });
    await expect(service.answer(id, { requestId: q.requestId, answers: { 'Which colour?': 'Red' } })).rejects.toMatchObject({ code: 'COMMON_001' });
    await expect(service.permission(id, { requestId: q.requestId, decision: 'allow' })).rejects.toMatchObject({ code: 'GUIDED_002' });
    const answers = { 'Which colour?': 'Red', 'Which extras?': 'Wheels' };
    await service.answer(id, { requestId: q.requestId, answers });
    expect(JSON.parse(readFileSync(join(dirOf(id), `answer-${q.requestId}.json`), 'utf8'))).toEqual({ requestId: q.requestId, answers });
  });

  it('answer to a question whose hook died → GUIDED_002', async () => {
    const { id } = await started();
    const q = { ...question(), pid: DEAD };
    writePending(id, q);
    await expect(service.answer(id, { requestId: q.requestId, answers: {} })).rejects.toMatchObject({ code: 'GUIDED_002' });
  });

  it('permission: written for the hook', async () => {
    const { id } = await started();
    const requestId = randomUUID();
    writePending(id, { type: 'permission', requestId, tool: 'Write', summary: 'C:\\p\\a.md' });
    await service.permission(id, { requestId, decision: 'deny' });
    expect(JSON.parse(readFileSync(join(dirOf(id), `answer-${requestId}.json`), 'utf8'))).toEqual({ requestId, decision: 'deny' });
  });

  it('message: only while waiting for text (or needs-you); pasted; a second one right after is refused', async () => {
    const { id, terminalId } = await started();
    await expect(service.message(id, 'olá')).rejects.toMatchObject({ code: 'GUIDED_004' });
    writePending(id, question());
    await expect(service.message(id, 'olá')).rejects.toMatchObject({ code: 'GUIDED_004' });
    for (const name of readdirSync(dirOf(id)).filter((n) => n.startsWith('pending-'))) rmSync(join(dirOf(id), name));
    setEvent(id, 'Stop');
    await service.message(id, 'linha 1\nlinha 2');
    expect(fake.calls.pasted).toEqual([{ id: terminalId, text: 'linha 1\nlinha 2' }]);
    await expect(service.message(id, 'outra')).rejects.toMatchObject({ code: 'GUIDED_004' });
    fake.status.set(terminalId, 'exited');
    await expect(service.message(id, 'x')).rejects.toMatchObject({ code: 'GUIDED_003' });
  });

  it('resume: stale pendings go, the terminal reopens, and it waits for text', async () => {
    const { id, terminalId } = await started();
    writePending(id, { ...question(), pid: DEAD });
    fake.status.set(terminalId, 'stopped');
    const view = await service.resume(id, { cols: 100, rows: 30 });
    expect(fake.calls.reopened).toEqual([terminalId]);
    expect(view.status).toBe('waiting-text');
    expect(readdirSync(dirOf(id)).some((n) => n.startsWith('pending-'))).toBe(false);
  });

  it('remove: closes the terminal, deletes the folder and the session index; a closed terminal is fine', async () => {
    const { id, terminalId } = await started();
    const sessionId = fake.calls.created[0]!.sessionId;
    await service.remove(id);
    expect(fake.calls.closed).toEqual([terminalId]);
    expect(existsSync(dirOf(id))).toBe(false);
    expect(existsSync(join(dataDir, GUIDED_FILES.dir, GUIDED_FILES.bySession, sessionId))).toBe(false);
    expect(() => service.get(id)).toThrow(expect.objectContaining({ code: 'GUIDED_001' }));

    const other = await started();
    fake.status.delete(other.terminalId);
    await service.remove(other.id);
    expect(existsSync(dirOf(other.id))).toBe(false);
  });

  it('an id that is not a UUID, or unknown → GUIDED_001', () => {
    expect(() => service.get('../x')).toThrow(expect.objectContaining({ code: 'GUIDED_001' }));
    expect(() => service.get(randomUUID())).toThrow(expect.objectContaining({ code: 'GUIDED_001' }));
  });
});
