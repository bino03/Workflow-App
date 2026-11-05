import { z } from 'zod';

// Espelha o backend (accountLabelSchema): 1–40 depois de trim, a mesma lista branca dos terminais.
const SAFE_LABEL = /^[\p{L}\p{N} ._\-()]+$/u;

export const accountFormSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Dá um nome à conta (ex.: Trabalho).')
    .max(40, 'O nome é demasiado longo.')
    .regex(SAFE_LABEL, 'Só letras, números, espaços e . _ - ( )'),
});

export type AccountFormValues = z.infer<typeof accountFormSchema>;
