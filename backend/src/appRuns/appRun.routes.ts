import type { FastifyInstance } from 'fastify';
import { parseWith } from '../common/validation.js';
import { appRunPathSchema } from './appRun.schemas.js';
import type { AppRunService } from './appRunService.js';

export type AppRunRoutesOptions = { appRunService: AppRunService };

/**
 * Run and stop a project's app (ADR 0030, spec correr-a-app §4.2). Session required (the auth guard). The client
 * only names the project folder; the service resolves it through the cwdPolicy and refuses the Workflow App itself.
 */
export async function appRunRoutes(app: FastifyInstance, { appRunService }: AppRunRoutesOptions): Promise<void> {
  app.get('/api/app-runs', async (request) => {
    const { path } = parseWith(appRunPathSchema, request.query);
    return appRunService.get(path);
  });

  app.post('/api/app-runs', async (request) => {
    const { path } = parseWith(appRunPathSchema, request.body ?? {});
    return appRunService.start(path);
  });

  app.post('/api/app-runs/stop', async (request) => {
    const { path } = parseWith(appRunPathSchema, request.body ?? {});
    return appRunService.stop(path);
  });

  app.post('/api/app-runs/reveal', async (request) => {
    const { path } = parseWith(appRunPathSchema, request.body ?? {});
    return appRunService.reveal(path);
  });
}
