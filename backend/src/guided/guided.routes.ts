import type { FastifyInstance } from 'fastify';
import { parseWith } from '../common/validation.js';
import { answerBodySchema, feedQuerySchema, messageBodySchema, modeBodySchema, permissionBodySchema, resumeBodySchema } from './guided.schemas.js';
import type { GuidedService } from './guidedService.js';

export type GuidedRoutesOptions = {
  guidedService: GuidedService;
};

type IdParams = { Params: { id: string } };

/**
 * Guided sessions (ADR 0020), generic: the purpose's own routes (e.g. /api/creations) start them. Session
 * required, like every /api route. The owner's text reaches a PTY only through `message`: cleaned, as one
 * bracketed paste, and only while claude waits for it.
 */
export async function guidedRoutes(app: FastifyInstance, { guidedService }: GuidedRoutesOptions): Promise<void> {
  app.get<IdParams>('/api/guided/:id', async (request) => guidedService.get(request.params.id));

  app.get<IdParams & { Querystring: { after?: string } }>('/api/guided/:id/feed', async (request) => {
    const { after } = parseWith(feedQuerySchema, request.query);
    return guidedService.feed(request.params.id, after);
  });

  app.post<IdParams>('/api/guided/:id/answer', async (request, reply) => {
    await guidedService.answer(request.params.id, parseWith(answerBodySchema, request.body));
    request.log.info({ guidedId: request.params.id }, 'guided question answered');
    return reply.status(204).send();
  });

  app.post<IdParams>('/api/guided/:id/permission', async (request, reply) => {
    const body = parseWith(permissionBodySchema, request.body);
    await guidedService.permission(request.params.id, body);
    request.log.info({ guidedId: request.params.id, decision: body.decision }, 'guided permission decided');
    return reply.status(204).send();
  });

  /** Perguntar / Automático (ADR 0021): only how permissions are decided; questions always ask. */
  app.put<IdParams>('/api/guided/:id/mode', async (request) => {
    const { mode } = parseWith(modeBodySchema, request.body);
    const view = await guidedService.setMode(request.params.id, mode);
    request.log.info({ guidedId: request.params.id, mode }, 'guided permission mode set');
    return view;
  });

  app.post<IdParams>('/api/guided/:id/message', async (request, reply) => {
    const { text } = parseWith(messageBodySchema, request.body);
    await guidedService.message(request.params.id, text);
    // Never the text itself: it is the owner's, like a terminal's content.
    request.log.info({ guidedId: request.params.id, chars: text.length }, 'guided message sent');
    return reply.status(204).send();
  });

  app.post<IdParams>('/api/guided/:id/resume', async (request) => {
    const view = await guidedService.resume(request.params.id, parseWith(resumeBodySchema, request.body));
    request.log.info({ guidedId: request.params.id }, 'guided session resumed');
    return view;
  });

  app.post<IdParams>('/api/guided/:id/reveal', async (request) => {
    const view = guidedService.reveal(request.params.id);
    request.log.info({ guidedId: request.params.id, terminalId: view.id }, 'guided terminal revealed');
    return view;
  });

  app.delete<IdParams>('/api/guided/:id', async (request, reply) => {
    await guidedService.remove(request.params.id);
    request.log.info({ guidedId: request.params.id }, 'guided session removed');
    return reply.status(204).send();
  });
}
