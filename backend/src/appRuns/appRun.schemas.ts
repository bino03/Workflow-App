import { z } from 'zod';

/**
 * Requests and views of /api/app-runs (ADR 0030, spec correr-a-app) — mirrored in `frontend/src/types/appRun.ts`.
 * The path is only a candidate: the service resolves it through the cwdPolicy (ALLOWED_ROOTS) before using it.
 */
export const appRunPathSchema = z.object({ path: z.string().min(1).max(1024) }).strict();
export type AppRunPathRequest = z.infer<typeof appRunPathSchema>;

export type AppRunPhase = 'unavailable' | 'idle' | 'starting' | 'running' | 'stopping' | 'failed';
export type AppRunUnavailableReason = 'missing-skills' | 'self';
/** no-port: 3 min without a port · exited: the terminal ended before a port · ports-gone: the app stopped by itself. */
export type AppRunError = 'no-port' | 'exited' | 'ports-gone';

export type AppRunView = {
  path: string;
  phase: AppRunPhase;
  /** Why 'unavailable': no run/stop skill, or the Workflow App itself. */
  unavailableReason: AppRunUnavailableReason | null;
  terminalId: string | null;
  /** The click on Correr. */
  startedAt: string | null;
  /** The first port seen — what "A correr · 12 min" counts from. */
  runningSince: string | null;
  ports: number[];
  error: AppRunError | null;
};
