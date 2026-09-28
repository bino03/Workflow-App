/**
 * Espelho de backend/src/terminals/{terminalsService,terminal.schemas,protocol,terminals.gateway}.ts
 * (docs/api.md → Terminais e Protocolo do WebSocket).
 */

/** running/exited vêm da memória do backend; stopped = gravado mas sem processo (o backend reiniciou). */
export type TerminalStatus = 'running' | 'exited' | 'stopped';

export type TerminalView = {
  id: string;
  /** null → a UI mostra o nome da pasta. */
  label: string | null;
  cwd: string;
  claudeSessionId: string;
  status: TerminalStatus;
  exitCode: number | null;
  createdAt: string;
  lastOpenedAt: string;
};

export type TerminalSize = { cols: number; rows: number };

export type CreateTerminalBody = TerminalSize & {
  cwd: string;
  mode: 'new' | 'resume' | 'continue';
  sessionId?: string;
  label?: string;
};

// ── WebSocket (/api/terminals/:id/ws) ─────────────────────────────────
// Frames binários = bytes do terminal (nos dois sentidos); frames de texto = JSON de controlo.

export type ServerControlMessage =
  | { type: 'ready'; status: 'running' | 'exited'; exitCode: number | null }
  | { type: 'exit'; code: number };

export type ClientControlMessage = { type: 'resize'; cols: number; rows: number };

export const TERMINAL_LIMITS = { minCols: 2, maxCols: 1000, minRows: 1, maxRows: 500 } as const;

/** Códigos de fecho do socket. */
export const WS_CLOSE = {
  /** O terminal não está a correr em memória (parado, fechado, ou reaberto → ligar de novo). */
  terminalGone: 4404,
  /** A sessão de login acabou. */
  sessionEnded: 4401,
} as const;
