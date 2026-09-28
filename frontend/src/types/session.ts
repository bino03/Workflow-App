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
};
