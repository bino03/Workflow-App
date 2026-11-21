import type { FastifyInstance } from 'fastify';
import { parseWith } from '../common/validation.js';
import { createTaskSchema, listTasksQuerySchema, taskParamsSchema, updateTaskSchema } from './projectTasks.schemas.js';
import type { ProjectTasksService } from './projectTasksService.js';

export type ProjectTasksRoutesOptions = {
  projectTasksService: ProjectTasksService;
};

/** A project's personal task list (ADR 0037). Session required, like every /api route. */
export async function projectTasksRoutes(app: FastifyInstance, { projectTasksService }: ProjectTasksRoutesOptions): Promise<void> {
  app.get('/api/project-tasks', async (request) => {
    const { projectPath } = parseWith(listTasksQuerySchema, request.query);
    return projectTasksService.list(projectPath);
  });

  app.post('/api/project-tasks', async (request, reply) => {
    const body = parseWith(createTaskSchema, request.body);
    return reply.status(201).send(projectTasksService.create(body));
  });

  app.patch('/api/project-tasks/:id', async (request) => {
    const { id } = parseWith(taskParamsSchema, request.params);
    return projectTasksService.update(id, parseWith(updateTaskSchema, request.body));
  });

  app.delete('/api/project-tasks/:id', async (request) => {
    const { id } = parseWith(taskParamsSchema, request.params);
    return projectTasksService.remove(id);
  });
}
