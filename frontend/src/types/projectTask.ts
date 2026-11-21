/** Espelho de /api/project-tasks (backend/src/projectTasks/projectTasks.schemas.ts, ADR 0037). */

export type ProjectTask = {
  id: string;
  projectPath: string;
  /** 1-200 caracteres. */
  text: string;
  done: boolean;
  /** ISO, ou null enquanto por fazer. */
  doneAt: string | null;
  /** ISO — define a ordem (a nova no fim). */
  createdAt: string;
};

/** O "Desfazer" de um apagar: recria a tarefa igual, no mesmo sítio. */
export type RestoreTask = Pick<ProjectTask, 'id' | 'createdAt' | 'done' | 'doneAt'>;

export const MAX_TASK_TEXT = 200;
