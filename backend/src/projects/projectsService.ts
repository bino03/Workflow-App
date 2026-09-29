import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveAllowedPath } from '../folders/cwdPolicy.js';
import type { ProjectEntry } from './project.schemas.js';
import { parseProjectIndex } from './projectIndexParser.js';

// The "Estado" column is free text — "descartado (2026-09-06)" as often as a bare "descartado".
const DISCARDED = /^descartado\b/i;

/**
 * Reads the Workflow's own project registry (`projects/INDEX.md`), read-only — same posture as the
 * Library (ADR 0005). Never throws and never 500s: a missing/unreadable file, a row that doesn't parse,
 * or a path outside ALLOWED_ROOTS just leaves that project out of the list.
 */
export class ProjectsService {
  private readonly indexPath: string;
  private readonly allowedRoots: readonly string[];

  constructor(workflowPath: string, allowedRoots: readonly string[]) {
    this.indexPath = join(workflowPath, 'projects', 'INDEX.md');
    this.allowedRoots = allowedRoots;
  }

  async list(): Promise<ProjectEntry[]> {
    let text: string;
    try {
      text = await readFile(this.indexPath, 'utf8');
    } catch {
      return [];
    }

    const entries: ProjectEntry[] = [];
    for (const row of parseProjectIndex(text)) {
      if (row.status && DISCARDED.test(row.status)) continue;
      let path: string;
      try {
        path = resolveAllowedPath(row.path, this.allowedRoots);
      } catch {
        continue; // outside ALLOWED_ROOTS, or doesn't exist any more — hidden, not an error
      }
      entries.push({ name: row.name, path, type: row.type, stack: row.stack, status: row.status });
    }
    return entries;
  }
}
