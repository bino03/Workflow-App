import { z } from 'zod';

// Espelha o backend: username com os caracteres de APP_USERNAME (config.ts, ADR 0011), password 1–1024.
// A password não tem lista branca de caracteres — é uma password.
export const loginFormSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'Escreve o nome de utilizador.')
    .max(64, 'O nome de utilizador é demasiado longo.')
    .regex(/^[A-Za-z0-9._-]+$/, 'Só letras, números, ponto, hífen e underscore.'),
  password: z.string().min(1, 'Escreve a password.').max(1024, 'A password é demasiado longa.'),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
