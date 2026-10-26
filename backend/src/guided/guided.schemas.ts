import { z } from 'zod';
import { colsSchema, rowsSchema } from '../terminals/protocol.js';

/**
 * Guided sessions (ADR 0020) — mirrored in `frontend/src/types/guided.ts`. The files the hook writes are
 * parsed here too: they come from a process the backend started, but a bad one must never break a request.
 */

export const guidedPurposeSchema = z.enum(['create']);

const instant = z.iso.datetime();

/** One AskUserQuestion question, as the tool sends it. */
export const questionSchema = z.object({
  question: z.string().min(1).max(2000),
  header: z.string().max(200).default(''),
  multiSelect: z.boolean().default(false),
  options: z
    .array(z.object({ label: z.string().min(1).max(500), description: z.string().max(2000).default('') }))
    .min(1)
    .max(10),
});

/** `pending-<requestId>.json`, written by the hook while it waits. */
export const pendingFileSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('question'),
    requestId: z.uuid(),
    pid: z.number().int().positive(),
    at: instant,
    questions: z.array(questionSchema).min(1).max(8),
  }),
  z.object({
    type: z.literal('permission'),
    requestId: z.uuid(),
    pid: z.number().int().positive(),
    at: instant,
    tool: z.string().min(1).max(200),
    summary: z.string().max(2000),
  }),
]);

export const guidedMetaSchema = z.object({
  id: z.uuid(),
  purpose: guidedPurposeSchema,
  terminalId: z.uuid(),
  claudeSessionId: z.uuid(),
  createdAt: instant,
});

/**
 * The `/create` result (Workflow: docs/skills/skill-create.md → "Modo app", the source of truth). Unknown
 * fields are dropped; a `version` other than 1 is a contract the app does not know.
 */
export const createResultSchema = z.object({
  version: z.literal(1),
  status: z.enum(['done', 'failed']),
  projectPath: z.string().min(1).max(1024).nullable().default(null),
  projectName: z.string().min(1).max(200).nullable().default(null),
  summary: z.string().max(20_000).default(''),
  openDecisions: z.array(z.string().max(2000)).max(100).default([]),
  nextStep: z.string().max(500).nullable().default(null),
  error: z.string().max(2000).optional(),
});

// Request bodies.

/** Key = the question's text, value = the chosen label, labels joined by `, ` (multiSelect), or the "Outro" text. */
export const answerBodySchema = z.object({
  requestId: z.uuid(),
  answers: z.record(z.string().min(1).max(2000), z.string().trim().min(1).max(4000)),
});

export const permissionBodySchema = z.object({
  requestId: z.uuid(),
  decision: z.enum(['allow', 'deny']),
});

export const messageBodySchema = z.object({ text: z.string().trim().min(1).max(8000) });

export const resumeBodySchema = z.object({ cols: colsSchema, rows: rowsSchema });

/** `after` = how many feed entries the client already has (0 or absent = all). */
export const feedQuerySchema = z.object({ after: z.coerce.number().int().min(0).max(1_000_000).default(0) });

export type GuidedPurpose = z.infer<typeof guidedPurposeSchema>;
export type Question = z.infer<typeof questionSchema>;
export type PendingFile = z.infer<typeof pendingFileSchema>;
export type GuidedMeta = z.infer<typeof guidedMetaSchema>;
export type CreateResult = z.infer<typeof createResultSchema>;

export type GuidedStatus = 'working' | 'question' | 'permission' | 'waiting-text' | 'needs-you' | 'stopped' | 'done' | 'failed';

export type GuidedPending =
  | { requestId: string; type: 'question'; questions: Question[] }
  | { requestId: string; type: 'permission'; tool: string; summary: string }
  | null;

export type GuidedView = {
  id: string;
  purpose: GuidedPurpose;
  status: GuidedStatus;
  terminalId: string;
  createdAt: string;
  pending: GuidedPending;
  result: CreateResult | null;
  /** Why it failed when there is no usable result (an invalid result.json). */
  error: string | null;
};
