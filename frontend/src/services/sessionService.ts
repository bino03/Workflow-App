import api from '@/api';
import type { SavedSession } from '@/types/session';

export async function getSessions(cwd: string): Promise<SavedSession[]> {
  return (await api.get<SavedSession[]>('/sessions', { params: { cwd } })).data;
}
