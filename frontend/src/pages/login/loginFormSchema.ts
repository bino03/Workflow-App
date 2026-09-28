import { z } from 'zod';

// Espelha o backend (auth.routes.ts): password 1–1024. Sem lista branca de caracteres — é uma password.
export const loginFormSchema = z.object({
  password: z.string().min(1, 'Escreve a password.').max(1024, 'A password é demasiado longa.'),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
