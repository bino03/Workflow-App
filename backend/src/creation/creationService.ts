import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { AppError } from '../common/errors.js';
import type { GuidedView } from '../guided/guided.schemas.js';
import type { GuidedService } from '../guided/guidedService.js';
import type { TerminalView, TerminalsService } from '../terminals/terminalsService.js';
import type { CreateCreation } from './creation.schemas.js';

/** The size a new visible terminal starts with; the grid resizes it when it attaches. */
const OPEN_SIZE = { cols: 120, rows: 40 };

export type CreationServiceDeps = {
  guided: Pick<GuidedService, 'start' | 'list' | 'get'>;
  terminals: Pick<TerminalsService, 'create'>;
  /** The Workflow: where `/create` runs. */
  workflowPath: string;
};

/**
 * "Novo projeto" (spec novo-projeto-guiado): the Workflow's own `/create`, in app mode, as a guided session. This
 * module only knows how to start one, which one is current, and how to open the project it made — the questions
 * belong to the skill.
 */
export class CreationService {
  private starting = false;

  constructor(private readonly deps: CreationServiceDeps) {}

  /** One creation at a time: another open one (running or finished but not closed) → CREATE_001. */
  async create({ description }: CreateCreation): Promise<GuidedView> {
    // Synchronous check-and-set: two requests at once must not both pass "no open creation".
    if (this.starting || this.deps.guided.list('create').length > 0) throw new AppError('CREATE_001');
    this.starting = true;
    try {
      const library = join(this.deps.workflowPath, 'library');
      if (!existsSync(library) || !statSync(library).isDirectory()) throw new AppError('LIBRARY_001');
      return await this.deps.guided.start({ purpose: 'create', cwd: this.deps.workflowPath, input: description });
    } finally {
      this.starting = false;
    }
  }

  current(): GuidedView | null {
    return this.deps.guided.list('create').at(-1) ?? null;
  }

  /**
   * "Abrir projeto": a new, visible terminal in the folder the creation made. The folder goes through the same
   * cwdPolicy as any terminal (inside ALLOWED_ROOTS, or FOLDER_001).
   */
  async open(id: string): Promise<TerminalView> {
    const view = this.deps.guided.get(id);
    if (view.purpose !== 'create') throw new AppError('GUIDED_001');
    const path = view.status === 'done' ? view.result?.projectPath : null;
    if (!path || !existsSync(path)) throw new AppError('CREATE_002');
    return this.deps.terminals.create({ cwd: path, mode: 'new', ...OPEN_SIZE });
  }
}
