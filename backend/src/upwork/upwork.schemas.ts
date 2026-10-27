import { z } from 'zod';
import type { GuidedView } from '../guided/guided.schemas.js';

/**
 * The Upwork section (ADR 0022, spec docs/features/upwork.md §4) — mirrored in `frontend/src/types/upwork.ts`.
 * Everything lives in `DATA_DIR/upwork/`; nothing here ever talks to the Upwork.
 */

export const applicationStatusSchema = z.enum(['draft', 'sent', 'interview', 'offer', 'won', 'lost', 'withdrawn']);

/** Only a job link on the Upwork itself — stored for the owner to open, never opened by the backend or the skill. */
const upworkUrl = z
  .string()
  .trim()
  .max(2000)
  .regex(/^https:\/\/www\.upwork\.com\/[^\s]*$/, 'tem de ser um link https://www.upwork.com/…');

const instant = z.iso.datetime();

/** `applications/<id>/application.json`, written only by the backend. */
export const applicationSchema = z.object({
  version: z.literal(1),
  id: z.uuid(),
  title: z.string().min(1).max(120),
  url: upworkUrl.nullable(),
  clientName: z.string().max(200).nullable(),
  status: applicationStatusSchema,
  history: z.array(z.object({ status: applicationStatusSchema, at: instant })).max(1000),
  connectsSpent: z.number().int().min(0).max(500).nullable(),
  notes: z.string().max(8000),
  guidedId: z.uuid().nullable(),
  agreement: z.string().max(20_000).nullable(),
  creationGuidedId: z.uuid().nullable(),
  projectPath: z.string().max(1024).nullable(),
  archived: z.boolean(),
  createdAt: instant,
  updatedAt: instant,
});

// Request bodies.

export const profileBodySchema = z.object({ markdown: z.string().trim().min(1).max(20_000) });

export const createApplicationSchema = z.object({
  /** The job post, pasted verbatim: the skill's input (job.md). Never on the command line. */
  job: z.string().trim().min(1).max(20_000),
  screeningQuestions: z.array(z.string().trim().min(1).max(1000)).max(15).default([]),
  url: upworkUrl.nullish(),
});

/** Every field optional, but at least one: a status change adds to the history. */
export const patchApplicationSchema = z
  .object({
    status: applicationStatusSchema,
    clientName: z.string().trim().max(200).nullable(),
    connectsSpent: z.number().int().min(0).max(500).nullable(),
    notes: z.string().max(8000),
    url: upworkUrl.nullable(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'nada para alterar');

/** Criar projeto: what was finally agreed with the client (offer, scope, milestones, relevant messages). */
/** The agreement is optional: the negotiation may be all in the conversation, which goes in the brief too. */
export const projectBodySchema = z.object({
  agreement: z
    .string()
    .trim()
    .max(20_000)
    .nullish()
    .transform((text) => (text ? text : null)),
});

/** A screenshot by its position in attachments.json (ADR 0024). */
export const attachmentParamsSchema = z.object({ index: z.coerce.number().int().min(0).max(9) });

/** `?download=1` → saved under its uploadName; anything else → shown inline. */
export const attachmentQuerySchema = z.object({ download: z.literal('1').optional().transform((value) => value === '1') });

/** `?archived=true` lists the archived ones; anything else (or nothing) the open ones. */
export const listQuerySchema = z.object({ archived: z.enum(['true', 'false']).default('false').transform((v) => v === 'true') });

export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;
export type Application = z.infer<typeof applicationSchema>;
export type CreateApplication = z.infer<typeof createApplicationSchema>;
export type PatchApplication = z.infer<typeof patchApplicationSchema>;

/** The package the skill wrote (step 5 reads it); null until it exists. */
export type PackageView = {
  title: string;
  language: string;
  verdict: 'apply' | 'maybe' | 'skip';
  updatedAt: string;
  analysis: string | null;
  coverLetter: string | null;
  screening: string | null;
  plan: string | null;
  clientQuestions: string | null;
};

/** The screenshots the skill picked to attach (`attachments.json`, ADR 0024); null until it exists. */
export type AttachmentsView = {
  updatedAt: string;
  /** false = no PORTFOLIO_PATH: the list shows, the images do not. */
  portfolioConfigured: boolean;
  items: { project: string; slug: string; file: string; uploadName: string; caption: string; available: boolean }[];
  /** Projects the letter cites that have no screenshots in the portfolio's catalog. */
  missing: string[];
};

export type ApplicationView = Omit<Application, 'version'> & {
  guided: GuidedView | null;
  package: PackageView | null;
  /** Why the package could not be read (an invalid package.json), as for an invalid result.json. */
  packageError: string | null;
  attachments: AttachmentsView | null;
  /** Why attachments.json could not be read. */
  attachmentsError: string | null;
};

export type ProfileView = { markdown: string; updatedAt: string | null };
