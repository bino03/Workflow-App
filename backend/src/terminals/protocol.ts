import { z } from 'zod';

/**
 * WebSocket protocol of `/api/terminals/:id/ws` — mirrored in `frontend/src/types/terminal.ts`.
 *
 * Binary frames carry terminal bytes (both ways): server → client is PTY output (UTF-8),
 * client → server is keyboard input written to the PTY as-is.
 * Text frames carry JSON control messages, validated with the schemas below.
 */

export const TERMINAL_LIMITS = {
  minCols: 2,
  maxCols: 1000,
  minRows: 1,
  maxRows: 500,
} as const;

export const colsSchema = z.number().int().min(TERMINAL_LIMITS.minCols).max(TERMINAL_LIMITS.maxCols);
export const rowsSchema = z.number().int().min(TERMINAL_LIMITS.minRows).max(TERMINAL_LIMITS.maxRows);

// client → server
export const clientControlSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('resize'), cols: colsSchema, rows: rowsSchema }),
]);
export type ClientControlMessage = z.infer<typeof clientControlSchema>;

export type TerminalStatus = 'running' | 'exited';

// server → client
export type ServerControlMessage =
  /** First message after connecting: the client resets its screen, then binary scrollback follows. */
  | { type: 'ready'; status: TerminalStatus; exitCode: number | null }
  | { type: 'exit'; code: number };
