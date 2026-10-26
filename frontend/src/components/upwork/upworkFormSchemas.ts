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

export const newApplicationFormSchema = z.object({
  job: z.string().trim().min(1, 'Cola o anúncio.').max(20_000, 'Até 20 000 caracteres.'),
  screening: z
    .string()
    .refine((text) => screeningLines(text).length <= MAX_QUESTIONS, `No máximo ${MAX_QUESTIONS} perguntas.`)
    .refine(
      (text) => screeningLines(text).every((line) => line.length <= MAX_QUESTION_CHARS),
      `Cada pergunta até ${MAX_QUESTION_CHARS} caracteres.`,
    ),
  url: z
    .string()
    .trim()
    .max(2000, 'Até 2000 caracteres.')
    .refine((value) => value === '' || /^https:\/\/www\.upwork\.com\/\S*$/.test(value), 'Um link https://www.upwork.com/…'),
});
export type NewApplicationFormValues = z.infer<typeof newApplicationFormSchema>;

export const NEW_APPLICATION_DEFAULTS: NewApplicationFormValues = { job: '', screening: '', url: '' };
