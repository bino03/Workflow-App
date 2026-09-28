import type { FastifyInstance } from 'fastify';
import { AppError } from '../common/errors.js';
import { parseWith } from '../common/validation.js';
import { isUuid } from '../sessions/claudeSessions.js';
import { createTerminalSchema, renameTerminalSchema, reopenTerminalSchema } from './terminal.schemas.js';
import type { TerminalsService } from './terminalsService.js';

export type TerminalsRoutesOptions = {
  terminalsService: TerminalsService;
};

type IdParams = { Params: { id: string } };

/** An id that is not even a UUID cannot name a terminal: same answer as an unknown one. */
function terminalId(id: string): string {
  if (!isUuid(id)) throw new AppError('TERMINAL_001');
  return id;
}

/** REST side of the terminals (docs/features/terminais.md §4.2). Session required, like every /api route. */
export async function terminalsRoutes(app: FastifyInstance, { terminalsService }: TerminalsRoutesOptions): Promise<void> {
  app.get('/api/terminals', async () => terminalsService.list());

  app.post('/api/terminals', async (request, reply) => {
    const body = parseWith(createTerminalSchema, request.body);
    const view = await terminalsService.create(body);
    request.log.info({ terminalId: view.id }, 'terminal created');
    return reply.status(201).send(view);
  });

  app.post<IdParams>('/api/terminals/:id/reopen', async (request) => {
    const id = terminalId(request.params.id);
    const view = await terminalsService.reopen(id, parseWith(reopenTerminalSchema, request.body));
    request.log.info({ terminalId: id }, 'terminal reopened');
    return view;
  });

  app.patch<IdParams>('/api/terminals/:id', async (request) => {
    const id = terminalId(request.params.id);
    const { label } = parseWith(renameTerminalSchema, request.body);
    return terminalsService.rename(id, label);
  });

  app.delete<IdParams>('/api/terminals/:id', async (request, reply) => {
    const id = terminalId(request.params.id);
    await terminalsService.close(id);
    request.log.info({ terminalId: id }, 'terminal closed');
    return reply.status(204).send();
  });
}
