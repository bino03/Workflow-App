import { describe, expect, it } from 'vitest';
import { MAX_BRIEF_CHARS } from '../src/creation/creationService.js';
import { jobMarkdown, projectBrief, titleFromJob } from '../src/upwork/upworkFiles.js';

describe('upworkFiles', () => {
  it('job.md: the post, the questions numbered (or none), the id — never a URL field', () => {
    expect(jobMarkdown('id-1', 'Build it', ['Why?', 'When?'])).toBe('# Anúncio\n\nBuild it\n\n# Perguntas de triagem\n\n1. Why?\n2. When?\n\n# appId\n\nid-1\n');
    expect(jobMarkdown('id-1', 'Build it', [])).toContain('(nenhuma)');
  });

  it('title: the first non-empty line without heading marks, at most 120', () => {
    expect(titleFromJob('\n\n## React dashboard\nmore')).toBe('React dashboard');
    expect(titleFromJob('x'.repeat(200))).toHaveLength(120);
    expect(titleFromJob('   ')).toBe('Candidatura');
  });

  describe('projectBrief', () => {
    const parts = {
      title: 'Acme',
      job: 'POST',
      coverLetter: 'LETTER',
      plan: 'PLAN',
      clientQuestions: 'QUESTIONS',
      conversation: [
        { from: 'owner' as const, text: 'CLIENT-SAYS' },
        { from: 'claude' as const, text: 'CLAUDE-PROPOSES' },
      ],
      notes: 'NOTES',
      agreement: 'AGREEMENT',
    };
    const ORDER = ['POST', 'LETTER', 'PLAN', 'QUESTIONS', '**Dono:** CLIENT-SAYS', '**Claude:** CLAUDE-PROPOSES', 'NOTES', 'AGREEMENT'];

    it('all the parts in order; a missing one says so', () => {
      const brief = projectBrief(parts, MAX_BRIEF_CHARS);
      const at = ORDER.map((p) => brief.indexOf(p));
      expect(at.every((i) => i >= 0)).toBe(true);
      expect([...at].sort((a, b) => a - b)).toEqual(at);
      expect(projectBrief({ ...parts, coverLetter: null, plan: '  ', clientQuestions: null, conversation: [], notes: '', agreement: null }, MAX_BRIEF_CHARS)).toMatch(
        /sem carta guardada[\s\S]*sem plano guardado[\s\S]*sem perguntas guardadas[\s\S]*sem mensagens[\s\S]*sem notas[\s\S]*nenhum acordo colado/,
      );
    });

    it('over the limit, the oldest messages go first — the latest stay, and the rest is whole', () => {
      const conversation = Array.from({ length: 40 }, (_, i) => ({ from: i % 2 ? ('claude' as const) : ('owner' as const), text: `M${i}-${'m'.repeat(2000)}` }));
      const brief = projectBrief({ ...parts, conversation }, MAX_BRIEF_CHARS);
      expect(brief.length).toBeLessThanOrEqual(MAX_BRIEF_CHARS);
      expect(brief).toContain('mensagens mais antigas cortadas');
      expect(brief).not.toContain('M0-');
      expect(brief).toContain('M39-');
      for (const part of ['LETTER', 'PLAN', 'QUESTIONS', 'NOTES']) expect(brief).toContain(part);
      expect(brief).not.toContain('(… cortado');
    });

    it('still over: the letter, the plan and the questions give way — the post, the notes and the agreement stay whole', () => {
      const job = `J${'j'.repeat(19_998)}Z`;
      const notes = `N${'n'.repeat(7_998)}Z`;
      const agreement = `A${'a'.repeat(19_998)}END`;
      const brief = projectBrief(
        { ...parts, job, notes, agreement, coverLetter: 'L'.repeat(50_000), plan: 'P'.repeat(50_000), clientQuestions: 'Q'.repeat(50_000) },
        MAX_BRIEF_CHARS,
      );
      expect(brief.length).toBeLessThanOrEqual(MAX_BRIEF_CHARS);
      expect(brief).toContain(job);
      expect(brief).toContain(notes);
      expect(brief.trimEnd().endsWith(agreement)).toBe(true);
      expect(brief.match(/\(… cortado/g)).toHaveLength(3);
      expect(brief).not.toContain('CLIENT-SAYS');
    });
  });
});
