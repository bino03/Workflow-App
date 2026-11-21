import api from '@/api';
import type { BranchList } from '@/types/branch';

export async function getBranches(path: string): Promise<BranchList> {
  return (await api.get<BranchList>('/branches', { params: { path } })).data;
}
