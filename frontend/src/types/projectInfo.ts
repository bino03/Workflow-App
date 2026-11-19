/** Espelho de /api/project-infos (backend/src/state/state.schema.ts e projectInfo/projectInfo.schemas.ts, ADR 0028 e 0034). */

export type Lifecycle = 'development' | 'production' | 'maintenance' | 'paused' | 'archived';
export type EnvironmentKind = 'production' | 'staging' | 'development' | 'other';

/** Registado à mão (`manual`) ou o topo da branch de deploy no `origin` (`git`, ADR 0034: versão = hash curto, nota = assunto). */
export type Deploy = {
  id: string;
  /** ISO. */
  at: string;
  version: string | null;
  note: string | null;
  source: 'manual' | 'git';
  /** O hash completo, só nos deploys do git. */
  commit: string | null;
};

export type Environment = {
  id: string;
  kind: EnvironmentKind;
  name: string;
  /** Todos os URLs são http(s) ≤ 500 ou null. */
  url: string | null;
  hosting: string | null;
  version: string | null;
  dashboardUrl: string | null;
  logsUrl: string | null;
  /** Só guardado: a app nunca o chama. */
  healthUrl: string | null;
  monthlyCostEur: number | null;
  /** A branch cujo topo no `origin` é o deploy; null = sem automático. */
  deployBranch: string | null;
  /** O último topo visto — só o backend o escreve. */
  lastGitCommit: string | null;
  /** Mais recente primeiro (máx. 20). */
  deploys: Deploy[];
};

export type ProjectLink = { label: string; url: string };

export type ProjectDomain = {
  name: string;
  registrar: string | null;
  /** AAAA-MM-DD. */
  renewsAt: string | null;
};

export type ProjectInfo = {
  /** O `path` do `ProjectEntry`. */
  projectPath: string;
  lifecycle: Lifecycle | null;
  client: string | null;
  /** Máx. 5. */
  environments: Environment[];
  repoUrl: string | null;
  database: string | null;
  ci: string | null;
  domain: ProjectDomain | null;
  /** Máx. 10. */
  links: ProjectLink[];
  notes: string;
  updatedAt: string;
};

/** Um ambiente a gravar: sem deploys (têm rotas próprias); sem `id` é um ambiente novo. */
export type EnvironmentInput = Omit<Environment, 'id' | 'deploys' | 'lastGitCommit'> & { id?: string };

/** O corpo do `PUT`: a ficha sem `deploys`, `projectPath` e `updatedAt`. */
export type ProjectInfoInput = Omit<ProjectInfo, 'projectPath' | 'updatedAt' | 'environments'> & {
  environments: EnvironmentInput[];
};

export type GitWarningReason = 'no-git' | 'no-repo' | 'outside-roots' | 'no-remote' | 'no-branch' | 'fetch-failed' | 'timeout';
export type GitSyncWarning = { environmentId: string; reason: GitWarningReason };

/** Resposta de `POST /project-infos/git-sync` (ADR 0035). */
export type GitSyncResult = { info: ProjectInfo | null; warnings: GitSyncWarning[] };

export type DeployInput = {
  /** ISO; omitido = agora. */
  at?: string;
  version?: string | null;
  note?: string | null;
};
