import type { FastifyInstance } from 'fastify';
import type { ProjectsService } from './projectsService.js';

export type ProjectsRoutesOptions = {
  projectsService: ProjectsService;
};

/** Read-only registry of the Workflow's own projects (`projects/INDEX.md`, ADR 0005). Session required. */
export async function projectsRoutes(app: FastifyInstance, { projectsService }: ProjectsRoutesOptions): Promise<void> {
  app.get('/api/projects', async () => projectsService.list());
}
