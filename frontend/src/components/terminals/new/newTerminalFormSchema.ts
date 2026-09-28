import { z } from 'zod';

// Espelha o createTerminalSchema do backend (terminal.schemas.ts). O rótulo é texto livre mostrado na UI:
// lista branca, nunca < > ` { } $.
export const newTerminalFormSchema = z
  .object({
    cwd: z.string().min(1, 'Escolhe uma pasta.'),
    mode: z.enum(['new', 'resume', 'continue']),
    sessionId: z.string().optional(),
    label: z
      .string()
      .trim()
      .max(80, 'No máximo 80 caracteres.')
      .regex(/^[\p{L}\p{N} ._\-()]*$/u, 'Só letras, números, espaços e . _ - ( )'),
  })
  .refine((values) => values.mode !== 'resume' || !!values.sessionId, {
    message: 'Escolhe a sessão a retomar.',
    path: ['sessionId'],
  });

export type NewTerminalFormValues = z.infer<typeof newTerminalFormSchema>;
