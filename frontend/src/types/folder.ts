/** Espelho de backend/src/folders/foldersService.ts (docs/api.md → Sessões gravadas e pastas). */
export type FolderView = { path: string; favorite: boolean; lastUsedAt: string | null };

export type FolderList = { roots: string[]; favorites: FolderView[]; recents: FolderView[] };

export type FolderEntry = { name: string; path: string; sessionCount: number };

/** `parent` é null numa raiz — nunca se sobe acima dela. */
export type FolderBrowse = { path: string; parent: string | null; entries: FolderEntry[] };
