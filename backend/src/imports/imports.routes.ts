import type { FastifyInstance } from 'fastify';
import { AppError } from '../common/errors.js';
import { parseWith } from '../common/validation.js';
import { MAX_IMPORT_FILES, createImportSchema } from './imports.schemas.js';
import type { ImportService } from './importService.js';
import { MAX_IMPORT_BYTES, type StagedFile } from './stagingFiles.js';

export type ImportsRoutesOptions = {
  importService: ImportService;
};

type IdParams = { Params: { id: string } };

/** What @fastify/multipart throws when a limit is crossed, or the body is not multipart at all. */
const LIMIT_CODES = new Set(['FST_FILES_LIMIT', 'FST_FIELDS_LIMIT', 'FST_PARTS_LIMIT', 'FST_REQ_FILE_TOO_LARGE']);

/**
 * Imports into the Workflow library through its own /import skill (ADR 0019). Session required, like every
 * /api route. Review (diff, accept, discard) comes in step 6 of the spec.
 */
export async function importsRoutes(app: FastifyInstance, { importService }: ImportsRoutesOptions): Promise<void> {
  /**
   * multipart: one `request` field (JSON: kind, source, answers) and, for `source.type: 'files'`, one `files`
   * part per entry of `source.paths`, in the same order. The client's file names are ignored.
   */
  app.post('/api/library/imports', async (request, reply) => {
    let body: unknown;
    const files: StagedFile[] = [];
    let total = 0;
    try {
      const parts = request.parts({
        limits: { fileSize: MAX_IMPORT_BYTES, files: MAX_IMPORT_FILES, fields: 1, fieldSize: 64 * 1024 },
      });
      for await (const part of parts) {
        if (part.type === 'field') {
          if (part.fieldname !== 'request' || typeof part.value !== 'string') throw new AppError('COMMON_001');
          body = JSON.parse(part.value);
          continue;
        }
        if (part.fieldname !== 'files') throw new AppError('COMMON_001');
        const data = await part.toBuffer();
        total += data.length;
        if (part.file.truncated || total > MAX_IMPORT_BYTES) throw new AppError('IMPORT_004');
        files.push({ path: '', data });
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      const code = (error as { code?: unknown })?.code;
      if (typeof code === 'string' && LIMIT_CODES.has(code)) throw new AppError('IMPORT_004');
      // Not multipart, or a request field that is not JSON.
      throw new AppError('COMMON_001');
    }
    if (body === undefined) {
      throw new AppError('COMMON_001', undefined, [{ field: 'request', message: 'campo em falta' }]);
    }
    const view = await importService.create(parseWith(createImportSchema, body), files);
    request.log.info({ importId: view.id, kind: view.kind }, 'import started');
    return reply.status(201).send(view);
  });

  app.get('/api/library/imports/current', async () => importService.current());

  app.post<IdParams>('/api/library/imports/:id/reveal', async (request) => {
    const view = importService.reveal(request.params.id);
    request.log.info({ importId: request.params.id, terminalId: view.id }, 'import terminal revealed');
    return view;
  });

  app.delete<IdParams>('/api/library/imports/:id', async (request, reply) => {
    await importService.cancel(request.params.id);
    request.log.info({ importId: request.params.id }, 'import cancelled');
    return reply.status(204).send();
  });
}
