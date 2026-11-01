import { z } from 'zod';
import { accountIdSchema } from '../state/state.schema.js';
import { colsSchema, rowsSchema } from './protocol.js';

/**
 * Request bodies of /api/terminals — mirrored in `frontend/src/types/terminal.ts`.
 * The label is free text shown in the UI: an allowlist, never `< > \` { } $`.
 */
export const labelSchema = z
  .string()
  .trim()
  .max(80)
  .regex(/^[\p{L}\p{N} ._\-()]*$/u, 'only letters, digits, spaces and . _ - ( )');

const sizeSchema = { cols: colsSchema, rows: rowsSchema };

export const createTerminalSchema = z
  .object({
    cwd: z.string().min(1).max(1024),
    mode: z.enum(['new', 'resume', 'continue']),
    sessionId: z.uuid().optional(),
    label: labelSchema.optional(),
    // ADR 0027: omitted → the active account.
    accountId: accountIdSchema.optional(),
    ...sizeSchema,
  })
  .refine((body) => body.mode !== 'resume' || body.sessionId !== undefined, {
    message: 'required when mode is resume',
    path: ['sessionId'],
  });

// accountId: "Continuar noutra conta" (ADR 0027); omitted → the terminal's own account.
export const reopenTerminalSchema = z.object({ ...sizeSchema, accountId: accountIdSchema.optional() });

export const renameTerminalSchema = z.object({ label: labelSchema.nullable() });
