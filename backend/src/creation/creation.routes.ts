import type { FastifyInstance } from 'fastify';
import { parseWith } from '../common/validation.js';
import { createCreationSchema } from './creation.schemas.js';
import type { CreationService } from './creationService.js';

export type CreationRoutesOptions = {
  creationService: CreationService;
};

type IdParams = { Params: { id: string } };

/**
 * "Novo projeto": starts the Workflow's `/create` as a guided session (ADR 0020); everything after the start goes
 * through /api/guided. Session required, like every /api route.
 */
export async function creationRoutes(app: FastifyInstance, { creationService }: CreationRoutesOptions): Promise<void> {
  app.post('/api/creations', async (request, reply) => {
    const view = await creationService.create(parseWith(createCreationSchema, request.body));
    // Never the description itself: it is the owner's text.
    request.log.info({ guidedId: view.id }, 'creation started');
    return reply.status(201).send(view);
  });

  app.get('/api/creations/current', async () => creationService.current());

  app.post<IdParams>('/api/creations/:id/open', async (request, reply) => {
    const view = await creationService.open(request.params.id);
    request.log.info({ guidedId: request.params.id, terminalId: view.id }, 'created project opened');
    return reply.status(201).send(view);
  });
}
