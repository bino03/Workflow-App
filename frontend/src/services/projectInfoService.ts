import api from '@/api';
import type { DeployInput, GitSyncResult, ProjectInfo, ProjectInfoInput } from '@/types/projectInfo';

export async function getProjectInfos(): Promise<ProjectInfo[]> {
  return (await api.get<ProjectInfo[]>('/project-infos')).data;
}

export async function saveProjectInfo(projectPath: string, info: ProjectInfoInput): Promise<ProjectInfo> {
  return (await api.put<ProjectInfo>('/project-infos', { projectPath, info })).data;
}

export async function deleteProjectInfo(projectPath: string): Promise<void> {
  await api.delete('/project-infos', { params: { projectPath } });
}

export async function registerDeploy(projectPath: string, environmentId: string, deploy: DeployInput): Promise<ProjectInfo> {
  return (await api.post<ProjectInfo>('/project-infos/deploys', { projectPath, environmentId, ...deploy })).data;
}

/** ADR 0034/0035: o topo da branch de deploy de cada ambiente entra no histórico. Sem intervalo: pergunta sempre ao remote. */
export async function syncProjectFromGit(projectPath: string): Promise<GitSyncResult> {
  return (await api.post<GitSyncResult>('/project-infos/git-sync', { projectPath })).data;
}

export async function deleteDeploy(projectPath: string, environmentId: string, deployId: string): Promise<ProjectInfo> {
  return (await api.delete<ProjectInfo>('/project-infos/deploys', { params: { projectPath, environmentId, deployId } })).data;
}
