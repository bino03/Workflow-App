import type { FastifyInstance } from 'fastify';
import { AppError } from '../common/errors.js';
import { MAX_SKILL_UPLOAD_BYTES, type LibraryService } from './libraryService.js';

export type LibraryRoutesOptions = {
  libraryService: LibraryService;
};

/**
 * The Workflow's library registry (ADR 0005), plus the one write the app is allowed to make into it
 * (ADR 0014). Session required, like every /api route.
 */
export async function libraryRoutes(app: FastifyInstance, { libraryService }: LibraryRoutesOptions): Promise<void> {
  app.get('/api/library/stacks', async () => libraryService.stacks());
  app.get('/api/library/themes', async () => libraryService.themes());
  app.get('/api/library/skills', async () => libraryService.skills());

  app.post<{ Params: { stackId: string } }>('/api/library/stacks/:stackId/skills', async (request, reply) => {
    // `throwFileSizeLimit: false` so an oversized file is our LIBRARY_005, not the plugin's 413.
    const part = await request.file({
      limits: { fileSize: MAX_SKILL_UPLOAD_BYTES, files: 1, fields: 0 },
      throwFileSizeLimit: false,
    });
    if (!part) throw new AppError('LIBRARY_005');
    if (part.fieldname !== 'file') {
      throw new AppError('COMMON_001', undefined, [{ field: 'file', message: 'campo de ficheiro em falta' }]);
    }

    const buffer = await part.toBuffer();
    if (part.file.truncated) throw new AppError('LIBRARY_005');

    const entry = await libraryService.uploadSkill(request.params.stackId, buffer, request.log);
    request.log.info({ stack: request.params.stackId, skill: entry.name }, 'skill written to the Workflow library');
    return reply.status(201).send(entry);
  });
}
