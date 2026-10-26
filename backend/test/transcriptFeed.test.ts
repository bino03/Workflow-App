import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { TranscriptFeed, buildFeed, feedPage } from '../src/guided/transcriptFeed.js';
import { removeDir } from './helpers.js';

/** A real transcript from the guided spike (step 1): two questions, a Write allowed, a Bash refused, a paste. */
const fixture = readFileSync(join(import.meta.dirname, 'fixtures', 'guided-transcript.jsonl'), 'utf8').split('\n');

const assistant = (id: string, content: object[], extra: object = {}) =>
  JSON.stringify({ type: 'assistant', uuid: `u-${id}-${content.length}`, timestamp: '2026-10-26T10:00:00.000Z', message: { id, role: 'assistant', content }, ...extra });
const toolUse = (id: string, name: string, input: object) => ({ type: 'tool_use', id, name, input });
const toolResult = (id: string, result: unknown = 'ok') =>
  JSON.stringify({ type: 'user', uuid: `r-${id}`, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] }, toolUseResult: result });

describe('buildFeed — the real transcript', () => {
  const feed = buildFeed(fixture);

  it('in order: the question with its answers, the two permissions with their decisions, the texts', () => {
    expect(feed.map((e) => e.type)).toEqual(['question', 'permission', 'permission', 'assistant-text', 'user-text', 'assistant-text']);
  });

  it('the question carries the questions and the answers given through the hook', () => {
    expect(feed[0]).toMatchObject({
      type: 'question',
      questions: [
        { question: 'Which colour?', header: 'Colour', multiSelect: false, options: [{ label: 'Red' }, { label: 'Blue' }] },
        { question: 'Which extras?', multiSelect: true },
      ],
      answers: { 'Which colour?': 'Blue', 'Which extras?': 'Wheels, Lights' },
    });
  });

  it('permissions: the tool and its target — a path, a command — never the content; allowed and refused', () => {
    expect(feed[1]).toMatchObject({ type: 'permission', decision: 'allow', summary: expect.stringMatching(/^Write: .*answers\.txt$/) });
    expect(feed[2]).toMatchObject({ type: 'permission', decision: 'deny', summary: 'Bash: node -e "console.log(42)"' });
    expect(JSON.stringify(feed)).not.toContain('COLOUR=Blue EXTRAS=Wheels, Lights\\n');
  });

  it('texts: the assistant as markdown; the owner’s pasted lines as one message; no slash command, skill body or tool result', () => {
    expect(feed[3]).toMatchObject({ type: 'assistant-text', markdown: 'SPIKE-DONE COLOUR=Blue EXTRAS=Wheels, Lights BASH=refused' });
    expect(feed[4]).toMatchObject({ type: 'user-text', text: 'linha um\nlinha dois\nResponde apenas: TRES-LINHAS-OK' });
    expect(feed[5]).toMatchObject({ type: 'assistant-text', markdown: 'TRES-LINHAS-OK' });
    const all = JSON.stringify(feed);
    for (const hidden of ['command-name', 'Base directory for this skill', 'Your questions have been answered', 'refused this in the app']) {
      expect(all).not.toContain(hidden);
    }
  });

  it('every entry has a unique id and a timestamp', () => {
    expect(new Set(feed.map((e) => e.id)).size).toBe(feed.length);
    expect(feed.every((e) => e.at.length > 0)).toBe(true);
  });
});

describe('buildFeed — the rest', () => {
  it('runs of tool calls group into one activity, counted by kind; the same file counts once', () => {
    const feed = buildFeed([
      assistant('m1', [{ type: 'text', text: 'Vou ler a biblioteca.' }]),
      assistant('m2', [toolUse('t1', 'Read', { file_path: 'a.md' }), toolUse('t2', 'Read', { file_path: 'b.md' })]),
      toolResult('t1'),
      assistant('m3', [toolUse('t3', 'Grep', { pattern: 'x' }), toolUse('t4', 'Edit', { file_path: 'c.md' }), toolUse('t5', 'Edit', { file_path: 'c.md' })]),
      assistant('m4', [toolUse('t6', 'Bash', { command: 'node tools/verify-project.mjs' }), toolUse('t7', 'Frobnicate', {})]),
      assistant('m5', [{ type: 'text', text: 'Feito.' }]),
    ]);
    expect(feed.map((e) => e.type)).toEqual(['assistant-text', 'activity', 'assistant-text']);
    expect(feed[1]).toMatchObject({ id: 't1', count: 7, summary: 'Leu 2 ficheiros · Fez 1 pesquisa · Escreveu 1 ficheiro · Correu 1 comando · Usou Frobnicate' });
  });

  it('text blocks of one message (one line each in the .jsonl) are one bubble', () => {
    const feed = buildFeed([assistant('m1', [{ type: 'text', text: '## Proposta' }]), assistant('m1', [{ type: 'text', text: '| a | b |' }])]);
    expect(feed).toHaveLength(1);
    expect(feed[0]).toMatchObject({ markdown: '## Proposta\n\n| a | b |' });
  });

  it('a question still waiting has no answers; a permission still waiting is activity until decided', () => {
    const q = { question: 'Gero?', header: 'Confirmar', multiSelect: false, options: [{ label: 'Gerar', description: '' }] };
    expect(buildFeed([assistant('m1', [toolUse('q1', 'AskUserQuestion', { questions: [q] })])])[0]).toMatchObject({ type: 'question', answers: null });
    expect(buildFeed([assistant('m1', [toolUse('w1', 'Write', { file_path: 'x' })])])[0]).toMatchObject({ type: 'activity' });
  });

  it('skips what it does not understand: bad JSON, unknown types, sub-agents, thinking, system tags, a bad question', () => {
    const feed = buildFeed([
      '{"broken',
      '',
      JSON.stringify({ type: 'mode', mode: 'x' }),
      JSON.stringify({ type: 'user', message: { content: '<system-reminder>x</system-reminder>' } }),
      JSON.stringify({ type: 'user', isMeta: true, message: { content: 'skill body' } }),
      assistant('s1', [{ type: 'text', text: 'from a sub-agent' }], { isSidechain: true }),
      assistant('m1', [{ type: 'thinking', thinking: 'hmm' }, toolUse('q1', 'AskUserQuestion', { questions: [{ question: '' }] })]),
      JSON.stringify({ type: 'user', message: { content: 'olá' }, uuid: 'x1' }),
    ]);
    expect(feed).toEqual([{ id: 'x1', type: 'user-text', text: 'olá', at: '' }]);
  });
});

describe('feedPage', () => {
  const entries = buildFeed(fixture);

  it('after=0 → everything; after=n → the last known entry again, and the new ones; the cursor is the count', () => {
    expect(feedPage(entries, 0)).toEqual({ entries, cursor: String(entries.length) });
    expect(feedPage(entries, 4).entries.map((e) => e.id)).toEqual(entries.slice(3).map((e) => e.id));
    expect(feedPage(entries, entries.length).entries).toEqual([entries.at(-1)]);
    expect(feedPage(entries, 999).entries).toEqual([entries.at(-1)]);
    expect(feedPage([], 3)).toEqual({ entries: [], cursor: '0' });
  });
});

describe('TranscriptFeed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfa-feed-'));
  afterAll(() => removeDir(dir));

  it('a missing file is an empty feed; a file that grows is read again', async () => {
    const reader = new TranscriptFeed();
    const file = join(dir, 'session.jsonl');
    expect(await reader.read(file)).toEqual([]);
    writeFileSync(file, `${JSON.stringify({ type: 'user', uuid: 'a', message: { content: 'um' } })}\n`);
    expect(await reader.read(file)).toHaveLength(1);
    appendFileSync(file, `${JSON.stringify({ type: 'user', uuid: 'b', message: { content: 'dois' } })}\n`);
    expect((await reader.read(file)).map((e) => e.id)).toEqual(['a', 'b']);
  });
});
