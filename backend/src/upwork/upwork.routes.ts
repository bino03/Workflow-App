import type { FastifyInstance } from 'fastify';
import { parseWith } from '../common/validation.js';
import { messageBodySchema } from '../guided/guided.schemas.js';
import { createApplicationSchema, listQuerySchema, patchApplicationSchema, profileBodySchema } from './upwork.schemas.js';
import type { UpworkService } from './upworkService.js';

export type UpworkRoutesOptions = {
  upworkService: UpworkService;
};

type IdParams = { Params: { id: string } };

/**
 * The Upwork section (ADR 0022): the profile and the applications. The conversation itself (questions, permissions,
 * feed, mode) goes through /api/guided. Session required, like every /api route.
 */
export async function upworkRoutes(app: FastifyInstance, { upworkService }: UpworkRoutesOptions): Promise<void> {
  app.get('/api/upwork/profile', async () => upworkService.getProfile());

  app.put('/api/upwork/profile', async (request) => upworkService.putProfile(parseWith(profileBodySchema, request.body).markdown));

  app.get('/api/upwork/applications', async (request) => upworkService.list(parseWith(listQuerySchema, request.query).archived));

  app.post('/api/upwork/applications', async (request, reply) => {
    const view = await upworkService.create(parseWith(createApplicationSchema, request.body));
    // Never the job post: it is pasted text.
    request.log.info({ applicationId: view.id, guidedId: view.guidedId }, 'upwork application started');
    return reply.status(201).send(view);
  });

  app.get<IdParams>('/api/upwork/applications/:id', async (request) => upworkService.get(request.params.id));

  app.patch<IdParams>('/api/upwork/applications/:id', async (request) =>
    upworkService.patch(request.params.id, parseWith(patchApplicationSchema, request.body)),
  );

  app.post<IdParams>('/api/upwork/applications/:id/pause', async (request) => upworkService.pause(request.params.id));

  // A paused session wakes up first: the request lasts the few seconds the resume takes (ADR 0022 point 4).
  app.post<IdParams>('/api/upwork/applications/:id/message', async (request, reply) => {
    await upworkService.message(request.params.id, parseWith(messageBodySchema, request.body).text);
    return reply.status(204).send();
  });

  app.post<IdParams>('/api/upwork/applications/:id/archive', async (request) => upworkService.archive(request.params.id));

  app.delete<IdParams>('/api/upwork/applications/:id', async (request, reply) => {
    await upworkService.remove(request.params.id);
    request.log.info({ applicationId: request.params.id }, 'upwork application deleted');
    return reply.status(204).send();
  });
}
