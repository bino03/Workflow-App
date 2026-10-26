/**
 * Espelho de backend/src/imports/imports.schemas.ts (docs/api.md → Importações, ADR 0019).
 * O contrato com a skill /import (request.json / result.json) vive em WORKFLOW_PATH/docs/import-contract.md.
 */

export type ImportKind = 'skill' | 'design' | 'stack' | 'auto';

export type ImportSource =
  /** `paths` lista os ficheiros enviados, pela mesma ordem (caminhos relativos com `/`). */
  | { type: 'files'; paths: string[] }
  | { type: 'url'; url: string }
  | { type: 'project'; path: string }
  | { type: 'text'; text: string };

export type StackLayer = 'backend' | 'frontend' | 'platform' | 'desktop' | 'fullstack';

/** As perguntas de cada tipo — o "Step 1" da skill de destino no Workflow. Vazio = não respondido. */
export type ImportAnswers = {
  stack: {
    technology: string;
    layer: StackLayer | '';
    pairsWith: string[];
    conflictsWith: string[];
    whenToChoose: string;
    whenNot: string;
    versions: string;
  };
  design: { name: string; character: string; suits: string; notSuits: string };
  /** `target`: 'process' ou o id de uma stack. */
  skill: { target: string; whenToUse: string };
  auto: { notes: string };
};

export type CreateImportBody = { kind: ImportKind; source: ImportSource; answers: Partial<ImportAnswers[ImportKind]> };

export type ImportStatus = 'running' | 'needs-you' | 'review' | 'rejected' | 'failed';

export type ImportResult = {
  status: 'done' | 'rejected' | 'failed';
  kind: 'skill' | 'design' | 'stack' | 'external-skill';
  libraryId: string | null;
  /** Markdown curto escrito pela skill. */
  summary: string;
  triage: { criterion: string; ok: boolean; note: string }[];
  commitMessage: string;
  error: string | null;
};

export type ImportView = {
  id: string;
  kind: ImportKind;
  sourceLabel: string;
  status: ImportStatus;
  terminalId: string;
  createdAt: string;
  result: ImportResult | null;
  changedFiles: number;
  /** Porque falhou (também sem result.json); senão null. */
  error: string | null;
};

export type FileChange = 'added' | 'modified' | 'deleted';
export type ImportFileDiff = { path: string; change: FileChange; diff: string; truncated: boolean };
export type ImportDiff = { files: ImportFileDiff[] };
