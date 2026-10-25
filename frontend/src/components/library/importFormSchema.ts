import { z } from 'zod';

/** Texto livre: o que o backend aceita (até 2000), sem `< > \` { } $` (skill-frontend-design-system, regra 6). */
const UNSAFE = /[<>`{}$]/;
const answer = z
  .string()
  .max(2000, 'Até 2000 caracteres.')
  .refine((value) => !UNSAFE.test(value), 'Sem < > ` { } $.');
const stackIds = z.array(z.string()).max(20, 'No máximo 20 stacks.');

export const IMPORT_SOURCE_TYPES = ['files', 'url', 'project', 'text'] as const;
export type ImportSourceType = (typeof IMPORT_SOURCE_TYPES)[number];

/**
 * O formulário do drawer Importar (ADR 0019). As respostas de todos os tipos vivem no mesmo objeto — só as
 * do tipo escolhido são enviadas. Os ficheiros ficam fora do formulário (estado do drawer): o que os torna
 * válidos (quantos, quanto pesam) decide-se ao lado da zona de arrastar.
 */
export const importFormSchema = z
  .object({
    kind: z.enum(['skill', 'design', 'stack', 'auto']),
    sourceType: z.enum(IMPORT_SOURCE_TYPES),
    url: z.string().trim().max(2048, 'Até 2048 caracteres.'),
    projectPath: z.string().trim().max(1024, 'Até 1024 caracteres.'),
    text: answer.pipe(z.string().max(8000)),
    stack: z.object({
      technology: answer,
      layer: z.enum(['backend', 'frontend', 'platform', 'desktop', 'fullstack', '']),
      pairsWith: stackIds,
      conflictsWith: stackIds,
      whenToChoose: answer,
      whenNot: answer,
      versions: answer,
    }),
    design: z.object({ name: answer, character: answer, suits: answer, notSuits: answer }),
    skill: z.object({ target: z.string().min(1), whenToUse: answer }),
    auto: z.object({ notes: answer }),
  })
  .superRefine((values, ctx) => {
    if (values.sourceType === 'url' && !/^https?:\/\/\S+$/i.test(values.url)) {
      ctx.addIssue({ code: 'custom', path: ['url'], message: 'Um endereço http:// ou https://.' });
    }
    if (values.sourceType === 'project' && !/^([a-zA-Z]:[\\/]|\/)/.test(values.projectPath)) {
      ctx.addIssue({ code: 'custom', path: ['projectPath'], message: 'O caminho completo da pasta (ex. C:\\…\\projetos\\App).' });
    }
    if (values.sourceType === 'text' && values.text.trim().length === 0) {
      ctx.addIssue({ code: 'custom', path: ['text'], message: 'Descreve o que queres importar.' });
    }
  });

export type ImportFormValues = z.infer<typeof importFormSchema>;

export const IMPORT_FORM_DEFAULTS: ImportFormValues = {
  kind: 'auto',
  sourceType: 'files',
  url: '',
  projectPath: '',
  text: '',
  stack: { technology: '', layer: '', pairsWith: [], conflictsWith: [], whenToChoose: '', whenNot: '', versions: '' },
  design: { name: '', character: '', suits: '', notSuits: '' },
  skill: { target: 'process', whenToUse: '' },
  auto: { notes: '' },
};
