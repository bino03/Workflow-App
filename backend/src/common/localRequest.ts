import type { FastifyRequest } from 'fastify';

const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * The owner is at the backend's own machine: the request comes from loopback **and** the page that sent it was opened as
 * localhost. The IP alone is not enough — behind `tailscale serve` (ADR 0018) every request arrives from 127.0.0.1, but
 * the page's Origin is the tailnet name. No Origin → not local (a window on someone else's screen is the worse error).
 * Used to decide whether to open a window on this machine (Preparar anexos, ADR 0025) — never for access control.
 */
export function isLocalRequest(request: FastifyRequest): boolean {
  if (!LOOPBACK_IPS.has(request.ip)) return false;
  const origin = request.headers.origin;
  if (!origin) return false;
  try {
    return LOCAL_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}
