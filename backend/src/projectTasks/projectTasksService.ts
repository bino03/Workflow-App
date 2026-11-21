import { randomUUID } from 'node:crypto';
import { AppError } from '../common/errors.js';
import { resolveAllowedPath } from '../folders/cwdPolicy.js';
import type { StateStore } from '../state/stateStore.js';
import { type CreateTask, MAX_TASKS_PER_PROJECT, type ProjectTask, type UpdateTask } from './projectTasks.schemas.js';

export type ProjectTasksServiceOptions = {
  stateStore: StateStore;
  allowedRoots: readonly string[];
};

/**
 * A project's personal task list (ADR 0037) — nothing to do with any vault's `notes/ToDo.md`. Keyed by the
 * resolved project path, so only folders inside ALLOWED_ROOTS have tasks. Creation order, newest last.
 */
export class ProjectTasksService {
  private readonly stateStore: StateStore;
  private readonly allowedRoots: readonly string[];

  constructor({ stateStore, allowedRoots }: ProjectTasksServiceOptions) {
    this.stateStore = stateStore;
    this.allowedRoots = allowedRoots;
  }

  list(projectPath: string): ProjectTask[] {
    const path = resolveAllowedPath(projectPath, this.allowedRoots);
    return byCreation(this.stateStore.read().projectTasks.filter((task) => task.projectPath === path));
  }

  create({ projectPath, text, restore }: CreateTask): ProjectTask {
    const path = resolveAllowedPath(projectPath, this.allowedRoots);
    const task: ProjectTask = {
      id: restore?.id ?? randomUUID(),
      projectPath: path,
      text,
      done: restore?.done ?? false,
      doneAt: restore ? (restore.done ? (restore.doneAt ?? new Date().toISOString()) : null) : null,
      createdAt: restore?.createdAt ?? new Date().toISOString(),
    };
    this.stateStore.update((draft) => {
      if (draft.projectTasks.some((existing) => existing.id === task.id)) throw new AppError('TASK_003');
      const count = draft.projectTasks.filter((existing) => existing.projectPath === path).length;
      if (count >= MAX_TASKS_PER_PROJECT) throw new AppError('TASK_002');
      draft.projectTasks.push(task);
    });
    return task;
  }

  update(id: string, changes: UpdateTask): ProjectTask {
    let updated: ProjectTask | undefined;
    this.stateStore.update((draft) => {
      const task = this.find(draft.projectTasks, id);
      if (changes.text !== undefined) task.text = changes.text;
      if (changes.done !== undefined && changes.done !== task.done) {
        task.done = changes.done;
        task.doneAt = changes.done ? new Date().toISOString() : null;
      }
      updated = { ...task };
    });
    return updated!;
  }

  /** Hard delete; returns the task so the client can offer "Desfazer" (a create with `restore`). */
  remove(id: string): ProjectTask {
    let removed: ProjectTask | undefined;
    this.stateStore.update((draft) => {
      removed = this.find(draft.projectTasks, id);
      draft.projectTasks = draft.projectTasks.filter((task) => task.id !== id);
    });
    return removed!;
  }

  private find(tasks: ProjectTask[], id: string): ProjectTask {
    const task = tasks.find((candidate) => candidate.id === id);
    if (!task) throw new AppError('TASK_001');
    return task;
  }
}

function byCreation(tasks: ProjectTask[]): ProjectTask[] {
  return [...tasks].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
