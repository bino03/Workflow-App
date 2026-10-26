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
    const parts = { title: 'Acme', job: 'POST', coverLetter: 'LETTER', plan: 'PLAN', agreement: 'AGREEMENT' };

    it('the four parts in order; a missing letter or plan says so', () => {
      const brief = projectBrief(parts, MAX_BRIEF_CHARS);
      expect(['POST', 'LETTER', 'PLAN', 'AGREEMENT'].map((p) => brief.indexOf(p))).toEqual(
        ['POST', 'LETTER', 'PLAN', 'AGREEMENT'].map((p) => brief.indexOf(p)).sort((a, b) => a - b),
      );
      expect(projectBrief({ ...parts, coverLetter: null, plan: '  ' }, MAX_BRIEF_CHARS)).toMatch(/sem carta guardada[\s\S]*sem plano guardado/);
    });

    it('over the limit, the letter and the plan give way — the post and the agreement stay whole', () => {
      const job = `J${'j'.repeat(19_998)}Z`;
      const agreement = `A${'a'.repeat(19_998)}END`;
      const brief = projectBrief({ ...parts, job, agreement, coverLetter: 'L'.repeat(50_000), plan: 'P'.repeat(50_000) }, MAX_BRIEF_CHARS);
      expect(brief.length).toBeLessThanOrEqual(MAX_BRIEF_CHARS);
      expect(brief).toContain(job);
      expect(brief.trimEnd().endsWith(agreement)).toBe(true);
      expect(brief.match(/cortado/g)).toHaveLength(2);
    });
  });
});
