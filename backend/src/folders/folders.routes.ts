import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseWith } from '../common/validation.js';
import type { FoldersService } from './foldersService.js';

const pathSchema = z.string().min(1).max(1024);
const browseQuerySchema = z.object({ path: pathSchema });
const favoriteBodySchema = z.object({ path: pathSchema, favorite: z.boolean() });

export type FoldersRoutesOptions = {
  foldersService: FoldersService;
};

/** Folders for the "Novo terminal" drawer (docs/api.md → Sessões gravadas e pastas). Session required. */
export async function foldersRoutes(app: FastifyInstance, { foldersService }: FoldersRoutesOptions): Promise<void> {
  app.get('/api/folders', async () => foldersService.list());

  app.get('/api/folders/browse', async (request) => {
    const { path } = parseWith(browseQuerySchema, request.query);
    return foldersService.browse(path);
  });

  app.put('/api/folders/favorite', async (request, reply) => {
    const { path, favorite } = parseWith(favoriteBodySchema, request.body);
    foldersService.setFavorite(path, favorite);
    return reply.status(204).send();
  });
}
