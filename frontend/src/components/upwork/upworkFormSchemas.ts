import { z } from 'zod';

// Sem lista branca de caracteres, como a descrição do Novo projeto e a ReplyBox: é texto colado que vai para
// ficheiros da sessão, nunca para uma linha de comando — e um anúncio traz "$50/hr", código com `{}`, `<` e `>`.
// Os limites são os do backend (upwork.schemas.ts).

export const profileFormSchema = z.object({
  markdown: z.string().trim().min(1, 'Escreve o teu perfil.').max(20_000, 'Até 20 000 caracteres.'),
});
export type ProfileFormValues = z.infer<typeof profileFormSchema>;

const MAX_QUESTIONS = 15;
const MAX_QUESTION_CHARS = 1000;

/** As perguntas de triagem, uma por linha (as vazias não contam), pela ordem em que foram coladas. */
export function screeningLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Um link do job na Upwork, ou vazio — o mesmo nos dois formulários. */
const upworkLink = z
  .string()
  .trim()
  .max(2000, 'Até 2000 caracteres.')
  .refine((value) => value === '' || /^https:\/\/www\.upwork\.com\/\S*$/.test(value), 'Um link https://www.upwork.com/…');

export const newApplicationFormSchema = z.object({
  job: z.string().trim().min(1, 'Cola o anúncio.').max(20_000, 'Até 20 000 caracteres.'),
  screening: z
    .string()
    .refine((text) => screeningLines(text).length <= MAX_QUESTIONS, `No máximo ${MAX_QUESTIONS} perguntas.`)
    .refine(
      (text) => screeningLines(text).every((line) => line.length <= MAX_QUESTION_CHARS),
      `Cada pergunta até ${MAX_QUESTION_CHARS} caracteres.`,
    ),
  url: upworkLink,
});
export type NewApplicationFormValues = z.infer<typeof newApplicationFormSchema>;

export const NEW_APPLICATION_DEFAULTS: NewApplicationFormValues = { job: '', screening: '', url: '' };

/** O nome do cliente vem da Upwork ("Acme Inc.", "J. & Sons (UK)"): lista branca (regra 6), com `&` e parênteses. */
const CLIENT_NAME = /^[\p{L}\p{N}\s.,'&()-]*$/u;

/** Dados da candidatura (separador Dados): tudo à mão, o estado incluído (ADR 0022 ponto 6). */
export const applicationDataFormSchema = z.object({
  status: z.enum(['draft', 'sent', 'interview', 'offer', 'won', 'lost', 'withdrawn']),
  clientName: z.string().trim().max(200, 'Até 200 caracteres.').regex(CLIENT_NAME, 'Só letras, números, espaços e . , \' & ( ) -'),
  // O InputNumber vazio devolve null = sem valor.
  connectsSpent: z.number().int('Um número inteiro.').min(0, 'De 0 a 500.').max(500, 'De 0 a 500.').nullable(),
  url: upworkLink,
  // As notas são do dono e mostram-se só como texto: "ofereceram $500" é normal — só o limite do backend.
  notes: z.string().max(8000, 'Até 8000 caracteres.'),
});
export type ApplicationDataFormValues = z.infer<typeof applicationDataFormSchema>;

export const createProjectFormSchema = z.object({
  agreement: z.string().trim().min(1, 'Cola o que ficou combinado.').max(20_000, 'Até 20 000 caracteres.'),
});
export type CreateProjectFormValues = z.infer<typeof createProjectFormSchema>;
