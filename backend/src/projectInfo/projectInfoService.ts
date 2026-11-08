import { randomUUID } from 'node:crypto';
import { AppError } from '../common/errors.js';
import type { ProjectsService } from '../projects/projectsService.js';
import { type Environment, MAX_DEPLOYS, type ProjectInfo } from '../state/state.schema.js';
import type { StateStore } from '../state/stateStore.js';
import type { ProjectInfoInput } from './projectInfo.schemas.js';

export type ProjectInfoServiceOptions = {
  stateStore: StateStore;
  projects: ProjectsService;
};

/**
 * The per-project sheet (ADR 0028): kept in `state.json`, keyed by the registry path. Only projects that
 * `GET /api/projects` returns can have one. Nothing here requests the stored URLs.
 */
export class ProjectInfoService {
  private readonly stateStore: StateStore;
  private readonly projects: ProjectsService;

  constructor({ stateStore, projects }: ProjectInfoServiceOptions) {
    this.stateStore = stateStore;
    this.projects = projects;
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
      const deploysOf = new Map((previous?.environments ?? []).map((environment) => [environment.id, environment.deploys]));
      const environments: Environment[] = input.environments.map((environment) => {
        const id = environment.id ?? randomUUID();
        return { ...environment, id, deploys: deploysOf.get(id) ?? [] };
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
      });
      // Newest first; past the limit the oldest goes.
      environment.deploys.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      environment.deploys.splice(MAX_DEPLOYS);
      this.touch(draft.projectInfos, projectPath);
    });
    return this.find(state.projectInfos, projectPath);
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
