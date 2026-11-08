import { z } from 'zod';
import type { DeployInput, EnvironmentKind, ProjectInfo, ProjectInfoInput } from '@/types/projectInfo';
import { ENVIRONMENT_KIND_LABEL } from './projectInfoFormat';

export const MAX_ENVIRONMENTS = 5;
export const MAX_LINKS = 10;

/** Texto livre curto: o que o backend aceita (≤ max), sem `< > \` { } $` (skill-frontend-design-system, regra 6). */
const UNSAFE = /[<>`{}$]/;
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Até ${max} caracteres.`)
    .refine((value) => !UNSAFE.test(value), 'Sem < > ` { } $.');
const requiredText = (max: number) => text(max).min(1, 'Obrigatório.');

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** Vazio (= sem valor) ou um endereço http(s) — o backend recusa `javascript:` e `file:`. */
const optionalUrl = z
  .string()
  .trim()
  .max(500, 'Até 500 caracteres.')
  .refine((value) => value === '' || isHttpUrl(value), 'Um endereço http:// ou https://.');

function parseCost(value: string): number {
  return Number(value.trim().replace(',', '.'));
}

const environmentFormSchema = z.object({
  /** O `id` do ambiente já gravado; vazio num ambiente novo. (Não se chama `id`: o `useFieldArray` usa esse nome.) */
  envId: z.string(),
  kind: z.enum(['production', 'staging', 'development', 'other']),
  name: requiredText(40),
  url: optionalUrl,
  hosting: text(80),
  version: text(80),
  dashboardUrl: optionalUrl,
  logsUrl: optionalUrl,
  healthUrl: optionalUrl,
  monthlyCost: z
    .string()
    .trim()
    .refine((value) => value === '' || (Number.isFinite(parseCost(value)) && parseCost(value) >= 0 && parseCost(value) <= 100_000), 'Um valor entre 0 e 100 000.'),
});

export const projectInfoFormSchema = z
  .object({
    lifecycle: z.enum(['', 'development', 'production', 'maintenance', 'paused', 'archived']),
    client: text(80),
    environments: z.array(environmentFormSchema).max(MAX_ENVIRONMENTS, `No máximo ${MAX_ENVIRONMENTS} ambientes.`),
    repoUrl: optionalUrl,
    database: text(120),
    ci: text(120),
    domainName: text(120),
    domainRegistrar: text(80),
    domainRenewsAt: z
      .string()
      .refine((value) => value === '' || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))), 'Uma data AAAA-MM-DD.'),
    links: z.array(z.object({ label: requiredText(60), url: optionalUrl.min(1, 'Obrigatório.') })).max(MAX_LINKS, `No máximo ${MAX_LINKS} links.`),
    // As notas ficam só guardadas (nunca vão para uma linha de comando): só `max`, como o texto colado da Upwork.
    notes: z.string().max(4000, 'Até 4000 caracteres.'),
  })
  .superRefine((values, ctx) => {
    if (values.domainName === '' && (values.domainRegistrar !== '' || values.domainRenewsAt !== '')) {
      ctx.addIssue({ code: 'custom', path: ['domainName'], message: 'Indica o nome do domínio.' });
    }
  });

export type ProjectInfoFormValues = z.infer<typeof projectInfoFormSchema>;
export type EnvironmentFormValues = ProjectInfoFormValues['environments'][number];

const nullIfEmpty = (value: string): string | null => (value.trim() === '' ? null : value.trim());

/** A ficha gravada (ou nada) como valores do formulário: `null` passa a texto vazio. */
export function toFormValues(info: ProjectInfo | undefined): ProjectInfoFormValues {
  return {
    lifecycle: info?.lifecycle ?? '',
    client: info?.client ?? '',
    environments: (info?.environments ?? []).map((environment) => ({
      envId: environment.id,
      kind: environment.kind,
      name: environment.name,
      url: environment.url ?? '',
      hosting: environment.hosting ?? '',
      version: environment.version ?? '',
      dashboardUrl: environment.dashboardUrl ?? '',
      logsUrl: environment.logsUrl ?? '',
      healthUrl: environment.healthUrl ?? '',
      monthlyCost: environment.monthlyCostEur === null ? '' : String(environment.monthlyCostEur).replace('.', ','),
    })),
    repoUrl: info?.repoUrl ?? '',
    database: info?.database ?? '',
    ci: info?.ci ?? '',
    domainName: info?.domain?.name ?? '',
    domainRegistrar: info?.domain?.registrar ?? '',
    domainRenewsAt: info?.domain?.renewsAt ?? '',
    links: (info?.links ?? []).map((link) => ({ ...link })),
    notes: info?.notes ?? '',
  };
}

/** Os valores do formulário (já validados) como corpo do `PUT`: texto vazio passa a `null`, ambientes novos sem `id`. */
export function toProjectInfoInput(values: ProjectInfoFormValues): ProjectInfoInput {
  return {
    lifecycle: values.lifecycle === '' ? null : values.lifecycle,
    client: nullIfEmpty(values.client),
    environments: values.environments.map((environment) => ({
      ...(environment.envId === '' ? {} : { id: environment.envId }),
      kind: environment.kind,
      name: environment.name,
      url: nullIfEmpty(environment.url),
      hosting: nullIfEmpty(environment.hosting),
      version: nullIfEmpty(environment.version),
      dashboardUrl: nullIfEmpty(environment.dashboardUrl),
      logsUrl: nullIfEmpty(environment.logsUrl),
      healthUrl: nullIfEmpty(environment.healthUrl),
      monthlyCostEur: environment.monthlyCost === '' ? null : parseCost(environment.monthlyCost),
    })),
    repoUrl: nullIfEmpty(values.repoUrl),
    database: nullIfEmpty(values.database),
    ci: nullIfEmpty(values.ci),
    domain:
      values.domainName === ''
        ? null
        : { name: values.domainName, registrar: nullIfEmpty(values.domainRegistrar), renewsAt: nullIfEmpty(values.domainRenewsAt) },
    links: values.links.map((link) => ({ label: link.label, url: link.url })),
    notes: values.notes,
  };
}

/** O formulário "Registar deploy": data e hora (de um `datetime-local`), versão e nota opcionais. */
export const deployFormSchema = z.object({
  at: z
    .string()
    .min(1, 'Indica a data e a hora.')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Uma data e hora válidas.'),
  version: text(80),
  note: text(280),
});

export type DeployFormValues = z.infer<typeof deployFormSchema>;

/** "Agora" no formato do `datetime-local` (hora local, ao minuto): `2026-11-08T21:30`. */
export function nowForInput(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** Os valores do formulário (já validados) como corpo do `POST` de um deploy: a hora local passa a ISO (UTC). */
export function toDeployInput(values: DeployFormValues): DeployInput {
  return { at: new Date(values.at).toISOString(), version: nullIfEmpty(values.version), note: nullIfEmpty(values.note) };
}

/** Um ambiente novo: produção se ainda não há, senão staging. */
export function newEnvironment(existing: readonly EnvironmentFormValues[]): EnvironmentFormValues {
  const kind: EnvironmentKind = existing.some((environment) => environment.kind === 'production') ? 'staging' : 'production';
  return { envId: '', kind, name: ENVIRONMENT_KIND_LABEL[kind], url: '', hosting: '', version: '', dashboardUrl: '', logsUrl: '', healthUrl: '', monthlyCost: '' };
}
