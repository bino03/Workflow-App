import { z } from 'zod';
import { MAX_ENVIRONMENTS, deploySchema, environmentSchema, projectInfoSchema } from '../state/state.schema.js';

/**
 * Request bodies of /api/project-infos (ADR 0028) — mirrored in `frontend/src/types/projectInfo.ts`.
 * The sheet comes without `deploys` (they have their own routes) and an environment without `id` is a new one.
 */
const environmentInputSchema = environmentSchema.omit({ deploys: true, lastGitCommit: true }).extend({ id: z.uuid().optional() });

export const projectInfoInputSchema = projectInfoSchema
  .omit({ projectPath: true, updatedAt: true })
  .extend({ environments: z.array(environmentInputSchema).max(MAX_ENVIRONMENTS).default([]) });

const projectPathSchema = z.string().min(1).max(1000);

export const putProjectInfoSchema = z.object({ projectPath: projectPathSchema, info: projectInfoInputSchema });
export const projectPathQuerySchema = z.object({ projectPath: projectPathSchema });

export const registerDeploySchema = z.object({
  projectPath: projectPathSchema,
  environmentId: z.uuid(),
  at: deploySchema.shape.at.optional(),
  version: deploySchema.shape.version.optional(),
  note: deploySchema.shape.note.optional(),
});

/** ADR 0034/0035: no interval and no `force` — every call asks the remote (`ls-remote` first). */
export const gitSyncSchema = z.object({ projectPath: projectPathSchema });

export const removeDeployQuerySchema = z.object({
  projectPath: projectPathSchema,
  environmentId: z.uuid(),
  deployId: z.uuid(),
});

export type ProjectInfoInput = z.infer<typeof projectInfoInputSchema>;
