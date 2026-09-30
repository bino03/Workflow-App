import { describe, expect, it } from 'vitest';
import { withSkillAddedToProvidesSkills } from '../src/library/frontmatterEditor.js';
import { skillUploadManifestSchema } from '../src/library/library.schemas.js';

/** A STACK.md shaped like the real ones: inline flow lists, a body below the frontmatter. */
function stackMd(providesSkillsLine: string, eol = '\n'): string {
  return [
    '---',
    'kind: stack-doc',
    'id: tauri',
    'name: Tauri',
    'layer: desktop',
    'maturity: planned',
    'versions: { tauri: "2" }',
    'pairs-with: [rust-axum]',
    providesSkillsLine,
    'updated: 2026-09-27',
    '---',
    '',
    '# Tauri',
    '',
    'Corpo em Markdown — `provides-skills: [nao-tocar]` aqui dentro não conta.',
    '',
  ].join(eol);
}

describe('withSkillAddedToProvidesSkills', () => {
  it('adds the name to an empty inline list', () => {
    const result = withSkillAddedToProvidesSkills(stackMd('provides-skills: []'), 'nova-coisa');
    expect(result).toBe(stackMd('provides-skills: [nova-coisa]'));
  });

  it('appends to an inline list that already has items', () => {
    const result = withSkillAddedToProvidesSkills(stackMd('provides-skills: [a, b]'), 'nova-coisa');
    expect(result).toBe(stackMd('provides-skills: [a, b, nova-coisa]'));
  });

  it('is idempotent — a name already there returns the text unchanged', () => {
    const before = stackMd('provides-skills: [a, nova-coisa]');
    const once = withSkillAddedToProvidesSkills(before, 'nova-coisa');
    expect(once).toBe(before);
    expect(withSkillAddedToProvidesSkills(once, 'nova-coisa')).toBe(before);
  });

  it('adds only once across two different names, leaving everything else byte-for-byte', () => {
    const before = stackMd('provides-skills: []');
    const after = withSkillAddedToProvidesSkills(withSkillAddedToProvidesSkills(before, 'uma'), 'outra');
    expect(after).toBe(stackMd('provides-skills: [uma, outra]'));
    // Only the one line differs.
    const changed = after.split('\n').filter((line, i) => line !== before.split('\n')[i]);
    expect(changed).toEqual(['provides-skills: [uma, outra]']);
  });

  it('matches quoted names when checking for duplicates', () => {
    const before = stackMd('provides-skills: ["nova-coisa"]');
    expect(withSkillAddedToProvidesSkills(before, 'nova-coisa')).toBe(before);
  });

  it('keeps a trailing comment on the line', () => {
    const result = withSkillAddedToProvidesSkills(stackMd('provides-skills: [] # nenhuma ainda'), 'nova-coisa');
    expect(result).toBe(stackMd('provides-skills: [nova-coisa] # nenhuma ainda'));
  });

  it('preserves CRLF line endings', () => {
    const result = withSkillAddedToProvidesSkills(stackMd('provides-skills: [a]', '\r\n'), 'nova-coisa');
    expect(result).toBe(stackMd('provides-skills: [a, nova-coisa]', '\r\n'));
    expect(result).toContain('\r\n');
  });

  it('extends a block list, reusing its indentation', () => {
    const before = '---\nkind: stack-doc\nprovides-skills:\n  - a\n  - b\nupdated: 2026-09-27\n---\n\n# Body\n';
    expect(withSkillAddedToProvidesSkills(before, 'nova-coisa')).toBe(
      '---\nkind: stack-doc\nprovides-skills:\n  - a\n  - b\n  - nova-coisa\nupdated: 2026-09-27\n---\n\n# Body\n',
    );
  });

  it('does not duplicate inside a block list', () => {
    const before = '---\nprovides-skills:\n  - nova-coisa\n---\n';
    expect(withSkillAddedToProvidesSkills(before, 'nova-coisa')).toBe(before);
  });

  it('turns a bare key with no list into an inline list', () => {
    const before = '---\nkind: stack-doc\nprovides-skills:\nupdated: 2026-09-27\n---\n';
    expect(withSkillAddedToProvidesSkills(before, 'nova-coisa')).toBe(
      '---\nkind: stack-doc\nprovides-skills: [nova-coisa]\nupdated: 2026-09-27\n---\n',
    );
  });

  it('adds the key when the manifest has none', () => {
    const before = '---\nkind: stack-doc\nid: tauri\n---\n\n# Body\n';
    expect(withSkillAddedToProvidesSkills(before, 'nova-coisa')).toBe(
      '---\nkind: stack-doc\nid: tauri\nprovides-skills: [nova-coisa]\n---\n\n# Body\n',
    );
  });

  it('keeps a BOM', () => {
    const result = withSkillAddedToProvidesSkills(`\ufeff${stackMd('provides-skills: []')}`, 'nova-coisa');
    expect(result).toBe(`\ufeff${stackMd('provides-skills: [nova-coisa]')}`);
  });

  it('throws without a frontmatter block', () => {
    expect(() => withSkillAddedToProvidesSkills('# Só corpo\n', 'nova-coisa')).toThrow(/no frontmatter/);
  });

  it('throws when provides-skills is a scalar, instead of guessing', () => {
    const before = '---\nprovides-skills: uma-coisa-so\n---\n';
    expect(() => withSkillAddedToProvidesSkills(before, 'nova-coisa')).toThrow(/not a list/);
  });
});

describe('skillUploadManifestSchema', () => {
  const manifest = (name: unknown) => ({ kind: 'skill', name, category: 'frontend', status: 'adapted' });

  it('accepts a kebab-case name', () => {
    const parsed = skillUploadManifestSchema.parse(manifest('add-thing'));
    expect(parsed.name).toBe('add-thing');
    expect(parsed.description).toBe('');
  });

  it.each(['Add Thing', 'add_thing', 'Add-Thing', 'add--thing', '-add', 'add-', ''])(
    'rejects %j',
    (name) => {
      expect(skillUploadManifestSchema.safeParse(manifest(name)).success).toBe(false);
    },
  );

  it('still requires the rest of the skill manifest', () => {
    expect(skillUploadManifestSchema.safeParse({ kind: 'skill', name: 'ok' }).success).toBe(false);
  });
});
