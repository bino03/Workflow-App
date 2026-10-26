/**
 * Sessões guiadas (ADR 0020) — espelho de `backend/src/guided/guided.schemas.ts` e `transcriptFeed.ts`.
 * Mudam juntos.
 */

export type GuidedPurpose = 'create';

/** Como se decidem as permissões (ADR 0021): um cartão cada, ou aprovadas pela app. As perguntas são sempre cartões. */
export type GuidedMode = 'ask' | 'auto';

export type GuidedStatus = 'working' | 'question' | 'permission' | 'waiting-text' | 'needs-you' | 'stopped' | 'done' | 'failed';

export type QuestionOption = { label: string; description: string };

/** Uma pergunta da AskUserQuestion, como a ferramenta a manda. */
export type Question = {
  question: string;
  header: string;
  multiSelect: boolean;
  options: QuestionOption[];
};

/** Chave = o texto da pergunta; valor = o label escolhido, os labels separados por ", " (várias), ou o texto do "Outro". */
export type Answers = Record<string, string>;

export type GuidedPending =
  | { requestId: string; type: 'question'; questions: Question[] }
  | { requestId: string; type: 'permission'; tool: string; summary: string }
  | null;

/** O `result.json` do `/create` em modo app (contrato v1, no Workflow: `skill-create.md` → "Modo app"). */
export type CreateResult = {
  version: 1;
  status: 'done' | 'failed';
  projectPath: string | null;
  projectName: string | null;
  summary: string;
  openDecisions: string[];
  nextStep: string | null;
  error: string | null;
};

export type GuidedView = {
  id: string;
  purpose: GuidedPurpose;
  status: GuidedStatus;
  terminalId: string;
  createdAt: string;
  mode: GuidedMode;
  pending: GuidedPending;
  result: CreateResult | null;
  /** Porquê, quando não há um resultado que se perceba (um `result.json` inválido). */
  error: string | null;
};

export type FeedEntry =
  | { id: string; type: 'assistant-text'; markdown: string; at: string }
  | { id: string; type: 'user-text'; text: string; at: string }
  | { id: string; type: 'question'; questions: Question[]; answers: Answers | null; at: string }
  | { id: string; type: 'permission'; summary: string; decision: 'allow' | 'deny' | null; at: string }
  | { id: string; type: 'activity'; summary: string; count: number; at: string };

export type FeedPage = { entries: FeedEntry[]; cursor: string };

/** O "Outro" da AskUserQuestion: o Claude Code junta-o sempre; a UI faz o mesmo. */
export const OTHER_OPTION = 'Outro';
