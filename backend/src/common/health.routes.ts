import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', { config: { public: true } }, async () => ({ status: 'ok' }));
}
