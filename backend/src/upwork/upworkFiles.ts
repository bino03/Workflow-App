import { join } from 'node:path';

/**
 * Where the Upwork section keeps its data (ADR 0022): `DATA_DIR/upwork/`, outside both repositories — personal data.
 * `profile.md` is the owner's freelancer profile; `applications/<id>/application.json` the record (backend only).
 */
export const UPWORK_FILES = {
  dir: 'upwork',
  profile: 'profile.md',
  applications: 'applications',
  record: 'application.json',
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
