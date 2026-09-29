import api from '@/api';
import type { ProjectEntry } from '@/types/project';

export async function getProjects(): Promise<ProjectEntry[]> {
  return (await api.get<ProjectEntry[]>('/projects')).data;
}
