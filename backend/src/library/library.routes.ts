import type { FastifyInstance } from 'fastify';
import type { LibraryService } from './libraryService.js';

export type LibraryRoutesOptions = {
  libraryService: LibraryService;
};

/**
 * The Workflow's library registry (ADR 0005), read-only. Adding to it goes through the imports
 * (`imports/`, ADR 0019). Session required, like every /api route.
 */
export async function libraryRoutes(app: FastifyInstance, { libraryService }: LibraryRoutesOptions): Promise<void> {
  app.get('/api/library/stacks', async () => libraryService.stacks());
  app.get('/api/library/themes', async () => libraryService.themes());
  app.get('/api/library/skills', async () => libraryService.skills());
}
