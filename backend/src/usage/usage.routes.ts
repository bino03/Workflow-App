import type { FastifyInstance } from 'fastify';
import { readUsage } from './usageFiles.js';

export type UsageRoutesOptions = {
  dataDir: string;
};

/** The subscription quota, as last seen by any terminal's status line (ADR 0012). Session required. */
export async function usageRoutes(app: FastifyInstance, { dataDir }: UsageRoutesOptions): Promise<void> {
  app.get('/api/usage', async () => readUsage(dataDir));
}
