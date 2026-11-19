import { randomUUID } from 'node:crypto';
import { AppError } from '../common/errors.js';
import type { ProjectsService } from '../projects/projectsService.js';
import { type Environment, MAX_DEPLOYS, type ProjectInfo } from '../state/state.schema.js';
import type { StateStore } from '../state/stateStore.js';
import type { ProjectInfoInput } from './projectInfo.schemas.js';
import { type BranchTip, type GitWarningReason, type ProjectGit, UNCHANGED } from './projectGit.js';

export type GitSyncWarning = { environmentId: string; reason: GitWarningReason };
export type GitSyncResult = { info: ProjectInfo | null; warnings: GitSyncWarning[] };

export type ProjectInfoServiceOptions = {
  stateStore: StateStore;
  projects: ProjectsService;
  git: ProjectGit;
};

/**
 * The per-project sheet (ADR 0028): kept in `state.json`, keyed by the registry path. Only projects that
 * `GET /api/projects` returns can have one. Nothing here requests the stored URLs.
 */
export class ProjectInfoService {
  private readonly stateStore: StateStore;
  private readonly projects: ProjectsService;
  private readonly git: ProjectGit;
  // One sync in flight per project: a second request waits for the first (ADR 0035, point 3).
  private readonly running = new Map<string, Promise<GitSyncResult>>();

  constructor({ stateStore, projects, git }: ProjectInfoServiceOptions) {
    this.stateStore = stateStore;
    this.projects = projects;
    this.git = git;
  }

  /** Only the sheets of the projects the registry shows today; a hidden project keeps its sheet on disk. */
  async list(): Promise<ProjectInfo[]> {
    const visible = new Set((await this.projects.list()).map((project) => project.path));
    return this.stateStore.read().projectInfos.filter((info) => visible.has(info.projectPath));
  }

  async save(projectPath: string, input: ProjectInfoInput): Promise<ProjectInfo> {
    await this.assertInRegistry(projectPath);
    const state = this.stateStore.update((draft) => {
      const previous = draft.projectInfos.find((info) => info.projectPath === projectPath);
      // An environment that keeps its id keeps its deploys; one that disappears takes them with it.
      const previousOf = new Map((previous?.environments ?? []).map((environment) => [environment.id, environment]));
      const environments: Environment[] = input.environments.map((environment) => {
        const id = environment.id ?? randomUUID();
        const before = previousOf.get(id);
        // A new deploy branch starts over: its current tip is the next git deploy.
        const lastGitCommit = before && before.deployBranch === environment.deployBranch ? before.lastGitCommit : null;
        return { ...environment, id, lastGitCommit, deploys: before?.deploys ?? [] };
      });
      const info: ProjectInfo = { ...input, environments, projectPath, updatedAt: new Date().toISOString() };
      if (previous) draft.projectInfos[draft.projectInfos.indexOf(previous)] = info;
      else draft.projectInfos.push(info);
    });
    return this.find(state.projectInfos, projectPath);
  }

  async remove(projectPath: string): Promise<void> {
    await this.assertInRegistry(projectPath);
    this.stateStore.update((draft) => {
      draft.projectInfos = draft.projectInfos.filter((info) => info.projectPath !== projectPath);
    });
  }

  async registerDeploy(
    projectPath: string,
    environmentId: string,
    deploy: { at?: string | undefined; version?: string | null | undefined; note?: string | null | undefined },
  ): Promise<ProjectInfo> {
    await this.assertInRegistry(projectPath);
    const state = this.stateStore.update((draft) => {
      const environment = this.environment(draft.projectInfos, projectPath, environmentId);
      environment.deploys.push({
        id: randomUUID(),
        at: deploy.at ?? new Date().toISOString(),
        version: deploy.version ?? null,
        note: deploy.note ?? null,
        source: 'manual',
        commit: null,
      });
      // Newest first; past the limit the oldest goes.
      environment.deploys.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      environment.deploys.splice(MAX_DEPLOYS);
      this.touch(draft.projectInfos, projectPath);
    });
    return this.find(state.projectInfos, projectPath);
  }

  /** Whether the project's sheet follows a deploy branch — the hook trigger only syncs those (ADR 0035, point 6). */
  hasDeployBranch(projectPath: string): boolean {
    const info = this.stateStore.read().projectInfos.find((candidate) => candidate.projectPath === projectPath);
    return info?.environments.some((environment) => environment.deployBranch) ?? false;
  }

  /**
   * ADR 0034/0035: the tip of `origin/<deployBranch>` of each environment that has one joins that environment's
   * history when it is a commit not seen before. `ls-remote` first; the fetch only when the tip changed. No interval.
   */
  async syncFromGit(projectPath: string): Promise<GitSyncResult> {
    await this.assertInRegistry(projectPath);
    const pending = this.running.get(projectPath);
    if (pending) return pending;
    const current = this.stateStore.read().projectInfos.find((info) => info.projectPath === projectPath) ?? null;
    const tracked = current?.environments.filter((environment) => environment.deployBranch) ?? [];
    if (tracked.length === 0) return { info: current, warnings: [] };
    const work = this.runSync(projectPath, tracked).finally(() => this.running.delete(projectPath));
    this.running.set(projectPath, work);
    return work;
  }

  private async runSync(projectPath: string, tracked: Environment[]): Promise<GitSyncResult> {
    // A tip is "known" only when every environment on that branch has already seen it.
    const isKnown = (branch: string, commit: string) =>
      tracked.filter((environment) => environment.deployBranch === branch).every((environment) => environment.lastGitCommit === commit);
    const tips = await this.git.tips(projectPath, tracked.map((environment) => environment.deployBranch!), isKnown);
    const warnings: GitSyncWarning[] = [];
    const fresh: { environmentId: string; branch: string; tip: BranchTip }[] = [];
    for (const environment of tracked) {
      const tip = tips.get(environment.deployBranch!);
      if (tip === undefined || tip === UNCHANGED) continue;
      if (typeof tip === 'string') warnings.push({ environmentId: environment.id, reason: tip });
      else if (tip.commit !== environment.lastGitCommit) fresh.push({ environmentId: environment.id, branch: environment.deployBranch!, tip });
    }
    if (fresh.length === 0) {
      const info = this.stateStore.read().projectInfos.find((candidate) => candidate.projectPath === projectPath) ?? null;
      return { info, warnings };
    }
    // git ran outside the (synchronous) update; inside it, check again that nothing changed meanwhile.
    const state = this.stateStore.update((draft) => {
      const info = draft.projectInfos.find((candidate) => candidate.projectPath === projectPath);
      for (const { environmentId, branch, tip } of fresh) {
        const environment = info?.environments.find((env) => env.id === environmentId);
        if (!environment || environment.deployBranch !== branch) continue;
        environment.lastGitCommit = tip.commit;
        if (environment.deploys.some((deploy) => deploy.commit === tip.commit)) continue;
        environment.deploys.push({
          id: randomUUID(),
          at: tip.at,
          version: tip.commit.slice(0, 7),
          note: tip.subject ? tip.subject.slice(0, 280).trim() : null,
          source: 'git',
          commit: tip.commit,
        });
        environment.deploys.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
        environment.deploys.splice(MAX_DEPLOYS);
      }
      this.touch(draft.projectInfos, projectPath);
    });
    return { info: state.projectInfos.find((info) => info.projectPath === projectPath) ?? null, warnings };
  }

  async removeDeploy(projectPath: string, environmentId: string, deployId: string): Promise<ProjectInfo> {
    await this.assertInRegistry(projectPath);
    const state = this.stateStore.update((draft) => {
      const environment = this.environment(draft.projectInfos, projectPath, environmentId);
      const index = environment.deploys.findIndex((deploy) => deploy.id === deployId);
      if (index === -1) throw new AppError('PROJECT_003');
      environment.deploys.splice(index, 1);
      this.touch(draft.projectInfos, projectPath);
    });
    return this.find(state.projectInfos, projectPath);
  }

  private async assertInRegistry(projectPath: string): Promise<void> {
    const known = (await this.projects.list()).some((project) => project.path === projectPath);
    if (!known) throw new AppError('PROJECT_001');
  }

  /** The environment of a sheet, or PROJECT_002 — a project without a sheet has no environments either. */
  private environment(infos: ProjectInfo[], projectPath: string, environmentId: string): Environment {
    const environment = infos.find((info) => info.projectPath === projectPath)?.environments.find((env) => env.id === environmentId);
    if (!environment) throw new AppError('PROJECT_002');
    return environment;
  }

  private touch(infos: ProjectInfo[], projectPath: string): void {
    const info = infos.find((candidate) => candidate.projectPath === projectPath);
    if (info) info.updatedAt = new Date().toISOString();
  }

  private find(infos: ProjectInfo[], projectPath: string): ProjectInfo {
    const info = infos.find((candidate) => candidate.projectPath === projectPath);
    if (!info) throw new AppError('COMMON_002');
    return info;
  }
}
