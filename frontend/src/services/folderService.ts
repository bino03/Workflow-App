import api from '@/api';
import type { FolderBrowse, FolderList } from '@/types/folder';

export async function getFolders(): Promise<FolderList> {
  return (await api.get<FolderList>('/folders')).data;
}

export async function browseFolder(path: string): Promise<FolderBrowse> {
  return (await api.get<FolderBrowse>('/folders/browse', { params: { path } })).data;
}

export async function setFavoriteFolder(path: string, favorite: boolean): Promise<void> {
  await api.put('/folders/favorite', { path, favorite });
}
