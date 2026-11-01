import type { FastifyInstance } from 'fastify';
import type { AccountId } from '../state/state.schema.js';
import { readUsage } from './usageFiles.js';

export type UsageRoutesOptions = {
  dataDir: string;
  /** The active Claude account (ADR 0027); omitted → the primary. */
  activeAccountId?: () => AccountId;
};

/**
 * The subscription quota of the active account, as last seen by a status line of one of its terminals
 * (ADR 0012, ADR 0027). Session required.
 */
export async function usageRoutes(app: FastifyInstance, { dataDir, activeAccountId }: UsageRoutesOptions): Promise<void> {
  app.get('/api/usage', async () => readUsage(dataDir, activeAccountId?.() ?? 'primary'));
}
