import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ClaudeSessions, SUMMARY_MAX, encodeProjectPath, isUuid } from '../src/sessions/claudeSessions.js';

const CWD = 'C:\\Users\\me\\Desktop\\my projects\\api-faturas';
const OLD = '11111111-1111-4111-8111-111111111111';
const NEW = '22222222-2222-4222-8222-222222222222';
const EMPTY = '33333333-3333-4333-8333-333333333333';
const TITLED = '44444444-4444-4444-8444-444444444444';

// Lines shaped like Claude Code 2.1.283's (see docs/features/terminais.md §4.1).
const user = (content: unknown, extra: object = {}) =>
  JSON.stringify({ type: 'user', message: { role: 'user', content }, timestamp: '2026-09-20T10:00:00.000Z', ...extra });
const assistant = (text: string, extra: object = {}) =>
  JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] }, ...extra });
const toolUse = () => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Read' }] } });
const toolResult = () => user([{ type: 'tool_result', content: 'file contents' }]);

let config: string;
let sessions: ClaudeSessions;
let folder: string;

function writeSession(id: string, lines: string[], mtime: Date) {
  const file = join(folder, `${id}.jsonl`);
  writeFileSync(file, lines.join('\n') + '\n');
  utimesSync(file, mtime, mtime);
}

beforeAll(() => {
  config = mkdtempSync(join(tmpdir(), 'wfa-claude-'));
  sessions = new ClaudeSessions(config);
  folder = sessions.folderOf(CWD);
  mkdirSync(folder, { recursive: true });

  writeSession(
    OLD,
    [
      user('<command-name>/status</command-name>'),
      user('migra o modelo de faturas para prisma\n  e mantém os testes'),
      toolUse(),
      toolResult(),
      assistant('Vou ler o schema primeiro.'),
      user('ignora', { isMeta: true }),
      assistant('subagent text', { isSidechain: true }),
      assistant('Feito: 3 ficheiros alterados.'),
      '{"type":"assistant","message":{"role":"ass', // half-written last line
    ],
    new Date('2026-09-20T11:00:00Z'),
  );
  writeSession(
    TITLED,
    [
      JSON.stringify({ type: 'ai-title', aiTitle: 'Primeiro título' }),
      user('adiciona validação de NIF'),
      assistant('x'.repeat(SUMMARY_MAX + 50)),
      JSON.stringify({ type: 'ai-title', aiTitle: 'Validação de NIF no cliente' }),
    ],
    new Date('2026-09-25T09:00:00Z'),
  );
  writeSession(NEW, [user('porque é que o /faturas/pdf demora?'), assistant('x'.repeat(SUMMARY_MAX + 50))], new Date('2026-09-26T18:42:00Z'));
  writeSession(EMPTY, [JSON.stringify({ type: 'mode', mode: 'normal' })], new Date('2026-09-10T08:00:00Z'));
  writeFileSync(join(folder, 'not-a-session.jsonl'), '{}');
  writeFileSync(join(folder, `${OLD}.txt`), '');
});

afterAll(() => {
  rmSync(config, { recursive: true, force: true });
});

describe('paths', () => {
  it('encodes the cwd like Claude Code does (every non-alphanumeric → -)', () => {
    expect(encodeProjectPath('C:\\Users\\jlalv\\Desktop\\utad\\projetos\\WorkFlow App')).toBe(
      'C--Users-jlalv-Desktop-utad-projetos-WorkFlow-App',
    );
    expect(sessions.folderOf(CWD)).toBe(join(config, 'projects', 'C--Users-me-Desktop-my-projects-api-faturas'));
  });

  it('only accepts UUIDs as session ids — no path can be smuggled in', () => {
    expect(isUuid(OLD)).toBe(true);
    expect(isUuid('..\\..\\secrets')).toBe(false);
    expect(() => sessions.fileOf(CWD, '../x')).toThrow();
    expect(sessions.hasSession(CWD, '../x')).toBe(false);
    expect(sessions.hasSession(CWD, OLD)).toBe(true);
    expect(sessions.hasSession(CWD, '55555555-5555-4555-8555-555555555555')).toBe(false);
  });
});

describe('listSessions', () => {
  it('lists every .jsonl named by a UUID, most recently updated first', async () => {
    const list = await sessions.listSessions(CWD);
    expect(list.map((s) => s.id)).toEqual([NEW, TITLED, OLD, EMPTY]);
    expect(await sessions.countSessions(CWD)).toBe(4);
  });

  it('counts typed prompts and assistant text — not tool results, meta, sidechains or CLI commands', async () => {
    const old = (await sessions.listSessions(CWD)).find((s) => s.id === OLD)!;
    expect(old.messageCount).toBe(3);
    expect(old.preview).toBe('migra o modelo de faturas para prisma e mantém os testes');
    expect(old.startedAt).toBe('2026-09-20T10:00:00.000Z');
    expect(old.updatedAt).toBe('2026-09-20T11:00:00.000Z');
  });

  it('prefers the latest AI title as preview; a session with nothing has a null preview', async () => {
    const list = await sessions.listSessions(CWD);
    expect(list.find((s) => s.id === TITLED)!.preview).toBe('Validação de NIF no cliente');
    const empty = list.find((s) => s.id === EMPTY)!;
    expect(empty).toMatchObject({ preview: null, messageCount: 0, startedAt: null });
  });

  it('a folder with no sessions gives an empty list, not an error', async () => {
    expect(await sessions.listSessions('D:\\nowhere')).toEqual([]);
    expect(await sessions.latestSessionId('D:\\nowhere')).toBeNull();
  });

  it('latestSessionId is the most recently updated', async () => {
    expect(await sessions.latestSessionId(CWD)).toBe(NEW);
  });
});

describe('readSummary', () => {
  it('uses the latest AI title when there is one', async () => {
    expect(await sessions.readSummary(CWD, TITLED)).toEqual({ summary: 'Validação de NIF no cliente', summarySource: 'ai-title' });
  });

  it('else the last assistant text, cut to 600 with an ellipsis', async () => {
    const { summary, summarySource } = await sessions.readSummary(CWD, NEW);
    expect(summarySource).toBe('last-message');
    expect(summary).toHaveLength(SUMMARY_MAX);
    expect(summary!.endsWith('…')).toBe(true);
    expect(await sessions.readSummary(CWD, OLD)).toEqual({ summary: 'Feito: 3 ficheiros alterados.', summarySource: 'last-message' });
  });

  it('never throws: empty session, missing file, invalid id → null', async () => {
    const none = { summary: null, summarySource: null };
    expect(await sessions.readSummary(CWD, EMPTY)).toEqual(none);
    expect(await sessions.readSummary(CWD, '55555555-5555-4555-8555-555555555555')).toEqual(none);
    expect(await sessions.readSummary(CWD, 'not-a-uuid')).toEqual(none);
  });
});
