import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseWith } from '../common/validation.js';
import { resolveAllowedPath } from '../folders/cwdPolicy.js';
import { listBranches } from './gitBranches.js';

export type BranchesRoutesOptions = { allowedRoots: readonly string[] };

const branchesQuerySchema = z.object({ path: z.string().min(1).max(1000) });

/** The local branches of a project folder, read-only, for the sidebar (proposta C, ADR 0036). Session required. */
export async function branchesRoutes(app: FastifyInstance, { allowedRoots }: BranchesRoutesOptions): Promise<void> {
  app.get('/api/branches', async (request) => {
    const { path } = parseWith(branchesQuerySchema, request.query);
    return listBranches(resolveAllowedPath(path, allowedRoots), allowedRoots);
  });
}
