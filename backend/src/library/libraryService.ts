import { existsSync, statSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ZodError } from 'zod';
import { AppError } from '../common/errors.js';
import {
  type InvalidEntry,
  type LibraryList,
  type SkillEntry,
  type StackEntry,
  type ThemeEntry,
  maturityOf,
  skillManifestSchema,
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

/** Reads the Workflow's library registry from disk on every call. Never writes (ADR 0005). */
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
    return byName(
      await readAll(this.root, files, (manifest, path) => {
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
      }),
    );
  }
}
