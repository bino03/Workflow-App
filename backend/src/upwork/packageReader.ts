import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { PackageView } from './upwork.schemas.js';

/**
 * The package `/upwork-proposal` writes (Workflow: docs/skills/skill-upwork-proposal.md, the source of truth):
 * `package.json` names five Markdown files **in the same folder**. Written by a process the backend started, so it
 * is parsed like the guided result.json — a bad one never breaks a request.
 */

export const PACKAGE_FILE = 'package.json';

/** A plain file name: no folder, no `..`, no drive — the skill may only point next to the manifest. */
const fileName = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}\.md$/, 'tem de ser um nome de ficheiro .md, sem pastas');

export const packageManifestSchema = z.object({
  version: z.literal(1),
  title: z.string().trim().min(1).max(120),
  language: z.string().regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/),
  verdict: z.enum(['apply', 'maybe', 'skip']),
  updatedAt: z.iso.datetime(),
  files: z.object({ analysis: fileName, coverLetter: fileName, screening: fileName, plan: fileName, clientQuestions: fileName }),
});

/** Each part is cut here: a card, not a book. */
export const MAX_PART_CHARS = 50_000;

export type PackageRead = { package: PackageView | null; error: string | null };

/** No manifest yet → both null; an invalid one → `error` with the field and the reason. */
export function readPackage(dir: string): PackageRead {
  const manifestFile = join(dir, PACKAGE_FILE);
  if (!existsSync(manifestFile)) return { package: null, error: null };
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(manifestFile, 'utf8'));
  } catch {
    // The Write tool replaces the file at once; a half-written one is rare, and the next poll reads it whole.
    return { package: null, error: 'package.json inválido: não é JSON' };
  }
  const parsed = packageManifestSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { package: null, error: `package.json inválido: ${issue.path.join('.') || '(raiz)'} — ${issue.message}` };
  }
  const { title, language, verdict, updatedAt, files } = parsed.data;
  const part = (name: string): string | null => {
    try {
      return readFileSync(join(dir, name), 'utf8').slice(0, MAX_PART_CHARS);
    } catch {
      return null;
    }
  };
  return {
    package: {
      title,
      language,
      verdict,
      updatedAt,
      analysis: part(files.analysis),
      coverLetter: part(files.coverLetter),
      screening: part(files.screening),
      plan: part(files.plan),
      clientQuestions: part(files.clientQuestions),
    },
    error: null,
  };
}

/** The manifest and the five parts it names: what archiving copies (only names that passed the schema). */
export function packageFiles(dir: string): string[] {
  try {
    const parsed = packageManifestSchema.safeParse(JSON.parse(readFileSync(join(dir, PACKAGE_FILE), 'utf8')));
    if (!parsed.success) return [];
    return [PACKAGE_FILE, ...new Set(Object.values(parsed.data.files))].filter((name) => existsSync(join(dir, name)));
  } catch {
    return [];
  }
}
