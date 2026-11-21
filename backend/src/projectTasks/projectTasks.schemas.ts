import { z } from 'zod';

/** Tasks kept per project (ADR 0037); the 201st is refused, nothing leaves on its own. */
export const MAX_TASKS_PER_PROJECT = 200;

const instant = z.iso.datetime();
const taskText = z.string().trim().min(1).max(200);

/** One line of a project's personal task list (ADR 0037). Stored in `state.json` → `projectTasks`. */
export const projectTaskSchema = z.object({
  id: z.uuid(),
  projectPath: z.string().min(1),
  text: taskText,
  done: z.boolean().default(false),
  doneAt: instant.nullable().default(null),
  createdAt: instant,
});

export type ProjectTask = z.infer<typeof projectTaskSchema>;

/* Request shapes of /api/project-tasks — mirrored in `frontend/src/types/projectTask.ts`. */

const projectPathSchema = z.string().min(1).max(1000);

export const listTasksQuerySchema = z.object({ projectPath: projectPathSchema });

export const createTaskSchema = z.object({
  projectPath: projectPathSchema,
  text: taskText,
  // "Desfazer" after a delete: the task comes back with its id, place (createdAt) and state.
  restore: z
    .object({ id: z.uuid(), createdAt: instant, done: z.boolean(), doneAt: instant.nullable() })
    .optional(),
});

export const taskParamsSchema = z.object({ id: z.uuid() });

export const updateTaskSchema = z
  .object({ text: taskText.optional(), done: z.boolean().optional() })
  .refine((body) => body.text !== undefined || body.done !== undefined, { message: 'nothing to change' });

export type CreateTask = z.infer<typeof createTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
