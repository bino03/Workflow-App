import type { FastifyInstance } from 'fastify';
import type { LibraryService } from './libraryService.js';

export type LibraryRoutesOptions = {
  libraryService: LibraryService;
};

/** Read-only registry of the Workflow's library (ADR 0005). Session required, like every /api route. */
export async function libraryRoutes(app: FastifyInstance, { libraryService }: LibraryRoutesOptions): Promise<void> {
  app.get('/api/library/stacks', async () => libraryService.stacks());
  app.get('/api/library/themes', async () => libraryService.themes());
  app.get('/api/library/skills', async () => libraryService.skills());
}
