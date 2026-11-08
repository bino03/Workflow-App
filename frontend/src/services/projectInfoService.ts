import api from '@/api';
import type { DeployInput, ProjectInfo, ProjectInfoInput } from '@/types/projectInfo';

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

export async function deleteDeploy(projectPath: string, environmentId: string, deployId: string): Promise<ProjectInfo> {
  return (await api.delete<ProjectInfo>('/project-infos/deploys', { params: { projectPath, environmentId, deployId } })).data;
}
