/** Espelho de backend/src/sessions/sessions.routes.ts (docs/api.md → Sessões gravadas e pastas). */
export type SavedSession = {
  id: string;
  startedAt: string | null;
  updatedAt: string;
  messageCount: number;
  /** Título gerado pelo Claude Code, senão o primeiro prompt. */
  preview: string | null;
  /** O terminal fechado na app que usou esta sessão (o histórico só aparece aqui). */
  closed: { label: string | null; summary: string | null; closedAt: string } | null;
  /** Terminal gravado que a usa — retomá-la é recusado. */
  openIn: string | null;
  /** Tamanho do último pedido, em tokens (ADR 0027); null sem resposta do assistente. */
  contextTokens: number | null;
  /** A conta do Claude onde correu da última vez na app; null se a app nunca a correu. */
  accountId: string | null;
};
