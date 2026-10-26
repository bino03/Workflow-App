import { join } from 'node:path';

/**
 * Where the Upwork section keeps its data (ADR 0022): `DATA_DIR/upwork/`, outside both repositories — personal data.
 * `profile.md` is the owner's freelancer profile; `applications/<id>/application.json` the record and `job.md` the post
 * (backend only).
 */
export const UPWORK_FILES = {
  dir: 'upwork',
  profile: 'profile.md',
  applications: 'applications',
  record: 'application.json',
  /** The post as pasted, kept with the record: the session's job.md goes when it is archived. */
  job: 'job.md',
} as const;

export function upworkPaths(dataDir: string) {
  const dir = join(dataDir, UPWORK_FILES.dir);
  const applications = join(dir, UPWORK_FILES.applications);
  return {
    dir,
    profile: join(dir, UPWORK_FILES.profile),
    applications,
    folderOf: (id: string) => join(applications, id),
    recordOf: (id: string) => join(applications, id, UPWORK_FILES.record),
    jobOf: (id: string) => join(applications, id, UPWORK_FILES.job),
  };
}

/**
 * The profile a new owner starts from (sections decided with the owner, spec §7). The skill reads it as it is —
 * the headings are a guide, not a contract.
 */
export const PROFILE_TEMPLATE = `# Quem sou
<!-- Uma ou duas frases: o que fazes e em que ponto estás (ex.: a começar na Upwork, sem reviews). -->

# Título
<!-- A linha que te descreve a um cliente, ex.: "Full-stack developer — React + TypeScript, Node". -->

# Competências
<!-- Tecnologias e áreas, as mais fortes primeiro. -->

# Projetos
<!-- Um por linha: **Nome** — o que fizeste, com que stack — link público (se houver). A skill só cita o que está aqui
     ou no registo de projetos do Workflow; nunca inventa. -->

# Disponibilidade
<!-- Horas por semana e fuso horário. -->

# Tom
<!-- Como queres soar nas cartas: direto, formal, descontraído… -->

# Nunca prometer
<!-- O que a skill nunca deve oferecer: prazos, tipos de trabalho, tecnologias que não dominas. -->
`;

/**
 * The skill's input (`job.md`): the post verbatim, the screening questions numbered, the application's id. Never
 * the job's URL (ADR 0022 point 1): the skill does not need it, and not having it is the simplest way not to open it.
 */
export function jobMarkdown(applicationId: string, job: string, screeningQuestions: readonly string[]): string {
  const questions = screeningQuestions.length > 0 ? screeningQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n') : '(nenhuma)';
  return `# Anúncio\n\n${job}\n\n# Perguntas de triagem\n\n${questions}\n\n# appId\n\n${applicationId}\n`;
}

/** Until the skill names the job: its first non-empty line, without Markdown heading marks. */
export function titleFromJob(job: string): string {
  const line = job.split(/\r?\n/).map((l) => l.replace(/^#+\s*/, '').trim()).find((l) => l.length > 0) ?? 'Candidatura';
  return line.length > 120 ? `${line.slice(0, 119)}…` : line;
}

export type ProjectBriefParts = { title: string; job: string; coverLetter: string | null; plan: string | null; agreement: string };

/**
 * The brief `/create` starts from when an application is won (spec upwork §4.2): the post, the letter that was sent,
 * the technical plan and the agreement — in this order. Over `maxChars`, the letter and the plan give way (the post and
 * the agreement are capped at 20 000 each, and the agreement is what was really agreed), so a long application never
 * fails to become a project.
 */
export function projectBrief(parts: ProjectBriefParts, maxChars: number): string {
  const whole = composeBrief(parts);
  if (whole.length <= maxChars) return whole;
  const note = '\n\n(… cortado: o brief passava do limite.)';
  const fixed = composeBrief({ ...parts, coverLetter: '', plan: '' }).length + 2 * note.length;
  const each = Math.max(0, Math.floor((maxChars - fixed) / 2));
  const cut = (text: string | null) => (text && text.trim().length > each ? text.trim().slice(0, each) + note : text);
  return composeBrief({ ...parts, coverLetter: cut(parts.coverLetter), plan: cut(parts.plan) }).slice(0, maxChars);
}

function composeBrief({ title, job, coverLetter, plan, agreement }: ProjectBriefParts): string {
  return [
    '# Projeto ganho na Upwork',
    '',
    `Este projeto vem de uma candidatura ganha na Upwork: **${title}**. O acordo final (no fim) manda sobre o anúncio`,
    'quando os dois divergem — é o âmbito combinado com o cliente.',
    '',
    '## Anúncio original',
    '',
    job.trim(),
    '',
    '## Carta enviada',
    '',
    coverLetter?.trim() || '(sem carta guardada)',
    '',
    '## Plano técnico da candidatura',
    '',
    plan?.trim() || '(sem plano guardado)',
    '',
    '## Acordo final',
    '',
    agreement.trim(),
    '',
  ].join('\n');
}

