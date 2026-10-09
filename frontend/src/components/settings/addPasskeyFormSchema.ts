import { z } from 'zod';

// Espelha o backend (passkeyRegistrationSchema): nome 1–64 depois de trim, password 1–1024.
const SAFE_NAME = /^[\p{L}\p{N}\s.,'()_-]+$/u;

export const addPasskeyFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Dá um nome à passkey (ex.: iPhone).')
    .max(64, 'O nome é demasiado longo.')
    .regex(SAFE_NAME, "Só letras, números, espaços e . , ' ( ) _ -"),
  password: z.string().min(1, 'Escreve a password.').max(1024, 'A password é demasiado longa.'),
});

export type AddPasskeyFormValues = z.infer<typeof addPasskeyFormSchema>;
