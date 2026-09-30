import { existsSync, statSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ZodError } from 'zod';
import { AppError, fieldErrorsFromZod } from '../common/errors.js';
import { withSkillAddedToProvidesSkills } from './frontmatterEditor.js';
import {
  type InvalidEntry,
  type LibraryList,
  type SkillEntry,
  type StackEntry,
  type ThemeEntry,
  maturityOf,
  skillManifestSchema,
  skillUploadManifestSchema,
  stackManifestSchema,
  themeManifestSchema,
} from './library.schemas.js';

// `_TEMPLATE` and any other folder starting with `_` is not a module (ADR 0005).
const isHidden = (name: string) => name.startsWith('_') || name.startsWith('.');

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

function frontmatterOf(text: string): unknown {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const match = FRONTMATTER.exec(withoutBom);
  if (!match) throw new Error('no frontmatter block (--- … ---) at the top of the file');
  return parseYaml(match[1] ?? '');
}

async function subfolders(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const items = await readdir(dir, { withFileTypes: true });
  return items.filter((item) => item.isDirectory() && !isHidden(item.name)).map((item) => item.name);
}

/** `skill-*.md` files under `dir`, recursively, skipping hidden folders. */
async function skillFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (isHidden(item.name)) continue;
    const path = join(dir, item.name);
    if (item.isDirectory()) found.push(...(await skillFiles(path)));
    else if (item.isFile() && /^skill-.+\.md$/.test(item.name)) found.push(path);
  }
  return found;
}

function describeError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ');
  }
  return error instanceof Error ? error.message : String(error);
}

async function readAll<T>(
  libraryRoot: string,
  files: string[],
  toEntry: (manifest: unknown, file: string) => T,
): Promise<LibraryList<T>> {
  const entries: T[] = [];
  const invalid: InvalidEntry[] = [];
  for (const file of files) {
    try {
      entries.push(toEntry(frontmatterOf(await readFile(file, 'utf8')), file));
    } catch (error) {
      invalid.push({ path: file, message: `${relative(libraryRoot, file)}: ${describeError(error)}` });
    }
  }
  return { entries, invalid };
}

const byName = <T extends { name: string }>(list: LibraryList<T>): LibraryList<T> => ({
  ...list,
  entries: [...list.entries].sort((a, b) => a.name.localeCompare(b.name)),
});

/** A real skill is a few KB. Not configurable — there is nothing here for an owner to tune (ADR 0014). */
export const MAX_SKILL_UPLOAD_BYTES = 256 * 1024;

function toSkillEntry(manifest: unknown, path: string, stacksDir: string): SkillEntry {
  const m = skillManifestSchema.parse(manifest);
  const inStack = relative(stacksDir, path).split(/[\\/]/);
  return {
    name: m.name,
    category: m.category,
    appliesWhen: m['applies-when'] ?? null,
    description: m.description,
    stack: inStack[0] && !inStack[0].startsWith('..') && inStack[1] === 'skills' ? inStack[0] : null,
    maturity: maturityOf(m.status),
    maturityRaw: m.status,
    updated: m.updated ?? null,
    path,
  };
}

/** Anything wrong *inside* the uploaded file is one error: the owner fixes the file, not a form field. */
function invalidSkillFile(error: unknown): AppError {
  return error instanceof ZodError
    ? new AppError('LIBRARY_002', undefined, fieldErrorsFromZod(error))
    : new AppError('LIBRARY_002', undefined, [{ field: '(root)', message: describeError(error) }]);
}

export type UploadLogger = { warn: (details: Record<string, unknown>, message: string) => void };

/**
 * Reads the Workflow's library registry from disk on every call. Writes in exactly two places, and
 * only through `uploadSkill` (ADR 0014); everything else here is read-only (ADR 0005).
 */
export class LibraryService {
  readonly root: string;

  constructor(workflowPath: string) {
    this.root = join(workflowPath, 'library');
  }

  private assertRoot(): void {
    if (!existsSync(this.root) || !statSync(this.root).isDirectory()) throw new AppError('LIBRARY_001');
  }

  async stacks(): Promise<LibraryList<StackEntry>> {
    this.assertRoot();
    const dir = join(this.root, 'stacks');
    const files = (await subfolders(dir)).map((id) => join(dir, id, 'STACK.md')).filter((file) => existsSync(file));
    return byName(
      await readAll(this.root, files, (manifest, path) => {
        const m = stackManifestSchema.parse(manifest);
        return {
          id: m.id,
          name: m.name,
          layer: m.layer,
          maturity: maturityOf(m.maturity),
          maturityRaw: m.maturity,
          technologies: Object.keys(m.versions),
          pairsWith: m['pairs-with'],
          providesSkills: m['provides-skills'],
          updated: m.updated ?? null,
          path,
        };
      }),
    );
  }

  async themes(): Promise<LibraryList<ThemeEntry>> {
    this.assertRoot();
    const dir = join(this.root, 'frontend', 'themes');
    const files = (await subfolders(dir)).map((id) => join(dir, id, 'THEME.md')).filter((file) => existsSync(file));
    return byName(
      await readAll(this.root, files, (manifest, path) => {
        const m = themeManifestSchema.parse(manifest);
        return {
          id: m.id,
          name: m.name,
          mode: m.mode ?? null,
          density: m.density ?? null,
          suits: m.suits,
          frontendStacks: m['frontend-stacks'],
          fonts: m.fonts,
          maturity: maturityOf(m.status),
          maturityRaw: m.status,
          updated: m.updated ?? null,
          path,
        };
      }),
    );
  }

  async skills(): Promise<LibraryList<SkillEntry>> {
    this.assertRoot();
    const stacksDir = join(this.root, 'stacks');
    const files = [
      ...(await skillFiles(join(this.root, 'skills'))),
      ...(await Promise.all((await subfolders(stacksDir)).map((id) => skillFiles(join(stacksDir, id, 'skills'))))).flat(),
    ];
    return byName(await readAll(this.root, files, (manifest, path) => toSkillEntry(manifest, path, stacksDir)));
  }

  /**
   * Writes one skill into an existing stack: `stacks/<id>/skills/skill-<name>.md`, plus `<name>` in the
   * `provides-skills` of that stack's `STACK.md` (ADR 0014). The only write this app makes to the
   * Workflow's library, which is shared by every project the Workflow generates.
   *
   * `stackId` **never** becomes part of a path: the destination folder comes from the manifest this
   * service itself found while scanning `stacks/`, so a `../../etc` can only ever fail to match.
   * `<name>` comes from the validated frontmatter, never from the uploaded file's name — the client
   * does not get to choose where the file lands. Nothing is written until everything has been checked.
   */
  async uploadSkill(stackId: string, file: Buffer, log?: UploadLogger): Promise<SkillEntry> {
    if (file.length === 0 || file.length > MAX_SKILL_UPLOAD_BYTES) throw new AppError('LIBRARY_005');

    const { entries } = await this.stacks();
    const stack = entries.find((entry) => entry.id === stackId);
    if (!stack) throw new AppError('LIBRARY_004');

    const text = file.toString('utf8');
    let manifest: unknown;
    let name: string;
    try {
      manifest = frontmatterOf(text);
      name = skillUploadManifestSchema.parse(manifest).name;
    } catch (error) {
      throw invalidSkillFile(error);
    }

    // `stack.path` is the STACK.md this service found on disk; its folder is the only thing we join to.
    const stackDir = dirname(stack.path);
    const skillsDir = join(stackDir, 'skills');
    const target = join(skillsDir, `skill-${name}.md`);
    if (existsSync(target)) throw new AppError('LIBRARY_003');

    await mkdir(skillsDir, { recursive: true });
    try {
      // `wx` fails if the file appeared between the check above and now — never overwrite (ADR 0014).
      await writeFile(target, file, { flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new AppError('LIBRARY_003');
      throw error;
    }

    // Best effort: the skill already exists and the Library lists it by reading the folder, not this
    // field. A failure here leaves a cross-reference stale, not the library broken (ADR 0014).
    try {
      const before = await readFile(stack.path, 'utf8');
      const after = withSkillAddedToProvidesSkills(before, name);
      if (after !== before) await writeFile(stack.path, after);
    } catch (error) {
      log?.warn(
        { err: error, stack: stack.id, skill: name },
        'skill written, but provides-skills of STACK.md could not be updated',
      );
    }

    return toSkillEntry(manifest, target, join(this.root, 'stacks'));
  }
}
