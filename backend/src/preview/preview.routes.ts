import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../common/errors.js';
import { parseWith } from '../common/validation.js';
import { isUuid } from '../sessions/claudeSessions.js';
import type { TerminalsService } from '../terminals/terminalsService.js';
import type { PreviewService } from './previewService.js';

export type PreviewRoutesOptions = {
  terminalsService: TerminalsService;
  /** Undefined when TAILSCALE_BIN is not set: the routes still exist and answer PREVIEW_006. */
  previewService: PreviewService | undefined;
};

type IdParams = { Params: { id: string } };

/** The client only names the terminal and, at most, one of the ports the backend offered (ADR 0018). */
export const startPreviewSchema = z.object({ devPort: z.number().int().min(1).max(65535).optional() }).strict();

/** Dev-server previews of a terminal (docs/features/pre-visualizacao.md §4.2). Session required. */
export async function previewRoutes(app: FastifyInstance, { terminalsService, previewService }: PreviewRoutesOptions): Promise<void> {
  const resolve = (id: string): PreviewService => {
    if (!isUuid(id) || !terminalsService.get(id)) throw new AppError('TERMINAL_001');
    if (!previewService) throw new AppError('PREVIEW_006');
    return previewService;
  };

  app.post<IdParams>('/api/terminals/:id/preview', async (request) => {
    const previews = resolve(request.params.id);
    const { devPort } = parseWith(startPreviewSchema, request.body ?? {});
    const result = await previews.start(request.params.id, devPort);
    if ('preview' in result) request.log.info({ terminalId: request.params.id, httpsPort: result.preview.httpsPort }, 'preview on');
    return result;
  });

  app.delete<IdParams>('/api/terminals/:id/preview', async (request, reply) => {
    const previews = resolve(request.params.id);
    if (await previews.stop(request.params.id, 'manual')) request.log.info({ terminalId: request.params.id }, 'preview off');
    return reply.status(204).send();
  });
}
