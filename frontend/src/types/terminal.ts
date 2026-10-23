/**
 * Espelho de backend/src/terminals/{terminalsService,terminal.schemas,protocol,terminals.gateway}.ts
 * (docs/api.md → Terminais e Protocolo do WebSocket).
 */

/** running/exited vêm da memória do backend; stopped = gravado mas sem processo (o backend reiniciou, ou o bot parou-o). */
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
  /** Lançado com --remote-control (pelo bot de Telegram): também no app Claude. Reabrir mantém-no (ADR 0017). */
  remoteControl: boolean;
  /** Pré-visualização viva na tailnet (ADR 0018), ou null. */
  preview: TerminalPreview | null;
};

// ── Pré-visualização (backend/src/preview/{previewService,listeningPorts}.ts) ─────────────
export type TerminalPreview = { url: string; devPort: number; httpsPort: number; startedAt: string };
/** Uma porta TCP à escuta num processo abaixo do claude do terminal. */
export type DevPort = { port: number; pid: number; process: string };
/** Uma porta → ligada; várias → escolher uma e pedir de novo com devPort. */
export type StartPreviewResult = { preview: TerminalPreview } | { ports: DevPort[] };

export type TerminalSize = { cols: number; rows: number };

/** Resposta do reabrir: freshSession = não havia conversa gravada (.jsonl), começou uma nova no mesmo terminal. */
export type ReopenedTerminal = TerminalView & { freshSession: boolean };

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
