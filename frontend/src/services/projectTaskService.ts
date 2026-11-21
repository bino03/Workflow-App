import api from '@/api';
import type { ProjectTask, RestoreTask } from '@/types/projectTask';

export async function getProjectTasks(projectPath: string): Promise<ProjectTask[]> {
  return (await api.get<ProjectTask[]>('/project-tasks', { params: { projectPath } })).data;
}

/** `restore` = o "Desfazer" de um apagar (ADR 0037): volta igual, no mesmo sítio. */
export async function createProjectTask(projectPath: string, text: string, restore?: RestoreTask): Promise<ProjectTask> {
  return (await api.post<ProjectTask>('/project-tasks', { projectPath, text, ...(restore ? { restore } : {}) })).data;
}

export async function updateProjectTask(id: string, changes: { text?: string; done?: boolean }): Promise<ProjectTask> {
  return (await api.patch<ProjectTask>(`/project-tasks/${id}`, changes)).data;
}

/** Apaga a sério e devolve a tarefa apagada, para o "Desfazer". */
export async function deleteProjectTask(id: string): Promise<ProjectTask> {
  return (await api.delete<ProjectTask>(`/project-tasks/${id}`)).data;
}
