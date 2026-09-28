import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/** Everything the API owns lives under /api; the rest of the URL space belongs to the SPA. */
export function isApiPath(url: string): boolean {
  const path = url.split('?', 1)[0] ?? '';
  return path === '/api' || path.startsWith('/api/');
}

export function hasSpaBuild(distDir: string): boolean {
  return existsSync(join(distDir, 'index.html'));
}

/** Origins the browser sends when the page comes from this backend itself. */
export function selfOrigins(port: number): string[] {
  return [`http://localhost:${port}`, `http://127.0.0.1:${port}`];
}

// Vite fingerprints everything under assets/, so those never change; index.html must always revalidate.
const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'no-cache';

/**
 * Serves the built frontend. `wildcard: true` looks files up per request, so a new `npm run build`
 * is served without restarting the backend (with `false` the file list is frozen at startup).
 */
export async function registerSpa(app: FastifyInstance, distDir: string): Promise<void> {
  await app.register(fastifyStatic, {
    root: distDir,
    wildcard: true,
    cacheControl: false,
    setHeaders: (reply, filePath) => {
      const isAsset = filePath.replaceAll('\\', '/').includes('/assets/');
      reply.header('Cache-Control', isAsset ? IMMUTABLE : REVALIDATE);
    },
  });
}

/**
 * A browser navigation to a client-side route (`/terminals`, `/library/x`) gets index.html.
 * Not for the API, not for other methods, and not for paths that look like a missing file.
 */
export function isSpaNavigation(request: FastifyRequest): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  if (isApiPath(request.url)) return false;
  const lastSegment = (request.url.split('?', 1)[0] ?? '').split('/').pop() ?? '';
  return !lastSegment.includes('.');
}

/** Cache-Control comes from `setHeaders` above (index.html → no-cache). */
export function sendSpaIndex(reply: FastifyReply): FastifyReply {
  return reply.sendFile('index.html');
}
