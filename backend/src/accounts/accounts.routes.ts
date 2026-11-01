import type { FastifyInstance } from 'fastify';
import { AppError } from '../common/errors.js';
import { parseWith } from '../common/validation.js';
import { isUuid } from '../sessions/claudeSessions.js';
import type { AccountId } from '../state/state.schema.js';
import { accountLoginSchema, createAccountSchema, renameAccountSchema, setActiveAccountSchema } from './accounts.schemas.js';
import type { AccountsService } from './accountsService.js';

export type AccountsRoutesOptions = {
  accountsService: AccountsService;
};

type IdParams = { Params: { id: string } };

/** `primary` or a UUID: anything else cannot name an account — same answer as an unknown one. */
function accountId(id: string): AccountId {
  if (id !== 'primary' && !isUuid(id)) throw new AppError('ACCOUNT_001');
  return id;
}

/** The Claude accounts (ADR 0027, spec contas-do-claude §4.2). Session required, like every /api route. */
export async function accountsRoutes(app: FastifyInstance, { accountsService }: AccountsRoutesOptions): Promise<void> {
  app.get('/api/accounts', async () => accountsService.list());

  app.post('/api/accounts', async (request, reply) => {
    const { label } = parseWith(createAccountSchema, request.body);
    const view = await accountsService.create(label);
    request.log.info({ accountId: view.id }, 'account created');
    return reply.status(201).send(view);
  });

  // Before /:id, so "active" is never read as an id.
  app.put('/api/accounts/active', async (request) => {
    const { accountId: id } = parseWith(setActiveAccountSchema, request.body);
    return accountsService.setActive(id);
  });

  app.patch<IdParams>('/api/accounts/:id', async (request) => {
    const { label } = parseWith(renameAccountSchema, request.body);
    return accountsService.rename(accountId(request.params.id), label);
  });

  app.delete<IdParams>('/api/accounts/:id', async (request, reply) => {
    const id = accountId(request.params.id);
    await accountsService.remove(id);
    request.log.info({ accountId: id }, 'account removed');
    return reply.status(204).send();
  });

  app.post<IdParams>('/api/accounts/:id/login', async (request, reply) => {
    const id = accountId(request.params.id);
    const view = await accountsService.openLogin(id, parseWith(accountLoginSchema, request.body));
    request.log.info({ accountId: id, terminalId: view.id }, 'login terminal opened');
    return reply.status(201).send(view);
  });
}
