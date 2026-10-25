import { z } from 'zod';

/**
 * The imports (ADR 0019). Two kinds of shape live here:
 * - the request body of POST /api/library/imports (what the form sends);
 * - the contract with the Workflow's /import skill — `request.json` and `result.json`, version 1. The only copy
 *   of that contract is `WORKFLOW_PATH/docs/import-contract.md`: change it there first, then here.
 * Mirrored in `frontend/src/types/imports.ts`.
 */

export const IMPORT_KINDS = ['skill', 'design', 'stack', 'auto'] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

/** Free text from the user: it only ever lands inside request.json, never on a command line. */
const answer = z.string().trim().max(2000).default('');
const stackId = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'tem de ser o id de uma stack');
const stackIds = z.array(stackId).max(20).default([]);

export const answersSchemas = {
  stack: z
    .object({
      technology: answer,
      layer: z.enum(['backend', 'frontend', 'platform', 'desktop', 'fullstack', '']).default(''),
      pairsWith: stackIds,
      conflictsWith: stackIds,
      whenToChoose: answer,
      whenNot: answer,
      versions: answer,
    })
    .strict(),
  design: z.object({ name: answer, character: answer, suits: answer, notSuits: answer }).strict(),
  skill: z.object({ target: z.union([z.literal('process'), stackId]).default('process'), whenToUse: answer }).strict(),
  auto: z.object({ notes: answer }).strict(),
} as const;

/**
 * A relative path as the browser gives it (`webkitRelativePath`, or the bare name): `/`-separated segments,
 * none empty, `.` or `..`, no drive letter, colon, backslash or control character. Checked again, segment by
 * segment, before anything is written (stagingFiles.ts).
 */
const relativePath = z
  .string()
  .min(1)
  .max(512)
  .refine((path) => !/[\\:\p{Cc}]/u.test(path) && path.split('/').every((s) => s !== '' && s !== '.' && s !== '..'), {
    message: 'caminho relativo inválido',
  });

export const MAX_IMPORT_FILES = 200;

const sourceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('files'), paths: z.array(relativePath).min(1).max(MAX_IMPORT_FILES) }).strict(),
  z
    .object({
      type: z.literal('url'),
      url: z
        .url({ protocol: /^https?$/ })
        .max(2048),
    })
    .strict(),
  z.object({ type: z.literal('project'), path: z.string().min(1).max(1024) }).strict(),
  z.object({ type: z.literal('text'), text: z.string().trim().min(1).max(8000) }).strict(),
]);

/** The `request` field of the multipart body. `source.paths` lists the `files` parts, in the order they come. */
export const createImportSchema = z
  .object({ kind: z.enum(IMPORT_KINDS), source: sourceSchema, answers: z.record(z.string(), z.unknown()).default({}) })
  .strict()
  .transform((body, ctx) => {
    const answers = answersSchemas[body.kind].safeParse(body.answers);
    if (!answers.success) {
      for (const issue of answers.error.issues) ctx.addIssue({ ...issue, path: ['answers', ...issue.path] } as never);
      return z.NEVER;
    }
    return { ...body, answers: answers.data as Record<string, unknown> };
  });
export type CreateImport = z.infer<typeof createImportSchema>;

/** request.json, version 1 — written by the backend, read by /import. */
export type ImportRequestFile = {
  version: 1;
  id: string;
  kind: ImportKind;
  source:
    | { type: 'files'; path: string }
    | { type: 'url'; url: string }
    | { type: 'project'; path: string }
    | { type: 'text'; text: string };
  answers: Record<string, unknown>;
  createdAt: string;
};

/** result.json, version 1 — written by /import as its last step. Anything else is treated as invalid. */
export const importResultSchema = z.object({
  version: z.literal(1),
  id: z.uuid(),
  status: z.enum(['done', 'rejected', 'failed']),
  kind: z.enum(['skill', 'design', 'stack', 'external-skill']),
  libraryId: z.string().max(200).nullable(),
  summary: z.string().max(20_000),
  triage: z.array(z.object({ criterion: z.string().max(200), ok: z.boolean(), note: z.string().max(2000) })).max(30),
  commitMessage: z.string().max(300),
  error: z.string().max(2000).optional(),
});
export type ImportResult = z.infer<typeof importResultSchema>;

/** The backend's own record of an import, next to request.json. */
export const importMetaSchema = z.object({
  id: z.uuid(),
  kind: z.enum(IMPORT_KINDS),
  sourceLabel: z.string(),
  terminalId: z.uuid(),
  claudeSessionId: z.uuid(),
  createdAt: z.iso.datetime(),
});
export type ImportMeta = z.infer<typeof importMetaSchema>;

export type ImportStatus = 'running' | 'needs-you' | 'review' | 'rejected' | 'failed';

export type ImportView = {
  id: string;
  kind: ImportKind;
  sourceLabel: string;
  status: ImportStatus;
  terminalId: string;
  createdAt: string;
  /** The validated result.json; an invalid one shows as `failed` with `error` set. */
  result: ImportResult | null;
  /** Files the import changed in the Workflow (git status); 0 until there is a result. */
  changedFiles: number;
  /** Why it is `failed` (also without a result.json — an invalid one, a terminal that ended); else null. */
  error: string | null;
};
