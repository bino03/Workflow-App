import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ClaudeSessions } from '../sessions/claudeSessions.js';
import type { Folder } from '../state/state.schema.js';
import type { StateStore } from '../state/stateStore.js';
import { findRoot, isInsideRoot, resolveAllowedPath } from './cwdPolicy.js';

export type FolderView = { path: string; favorite: boolean; lastUsedAt: string | null };
export type FolderList = { roots: string[]; favorites: FolderView[]; recents: FolderView[] };
export type FolderEntry = { name: string; path: string; sessionCount: number };
export type FolderBrowse = { path: string; parent: string | null; entries: FolderEntry[] };

export type FoldersServiceDeps = {
  stateStore: StateStore;
  sessions: ClaudeSessions;
  allowedRoots: readonly string[];
};

const byLastUsed = (a: Folder, b: Folder) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '');
const view = (folder: Folder): FolderView => ({ path: folder.path, favorite: folder.favorite, lastUsedAt: folder.lastUsedAt ?? null });

/** The folders of the "Novo terminal" drawer: favourites, recents, and a one-level-at-a-time browser. */
export class FoldersService {
  constructor(private readonly deps: FoldersServiceDeps) {}

  /** Favourites and recents that still exist inside ALLOWED_ROOTS — the roots may have changed. */
  list(): FolderList {
    const usable = this.deps.stateStore.read().folders.filter((folder) => this.isUsable(folder.path));
    return {
      roots: [...this.deps.allowedRoots],
      favorites: usable.filter((f) => f.favorite).sort(byLastUsed).map(view),
      recents: usable.filter((f) => !f.favorite).sort(byLastUsed).map(view),
    };
  }

  /** The sub-folders of one folder. Never above a root (`parent` is null there); hidden folders (`.git`…) skipped. */
  async browse(path: string): Promise<FolderBrowse> {
    const real = resolveAllowedPath(path, this.deps.allowedRoots);
    const root = findRoot(real, this.deps.allowedRoots)!;
    const atRoot = isInsideRoot(root, real); // real is the root itself
    const dirents = await readdir(real, { withFileTypes: true }).catch(() => []);
    const names = dirents
      // Links and junctions are left out: where they point is only checked when one is opened.
      .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith('.'))
      .map((dirent) => dirent.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const entries = await Promise.all(
      names.map(async (name) => {
        const entryPath = join(real, name);
        return { name, path: entryPath, sessionCount: await this.deps.sessions.countSessions(entryPath) };
      }),
    );
    return { path: real, parent: atRoot ? null : dirname(real), entries };
  }

  setFavorite(path: string, favorite: boolean): void {
    const real = resolveAllowedPath(path, this.deps.allowedRoots);
    this.deps.stateStore.update((draft) => {
      const folder = draft.folders.find((f) => f.path === real);
      if (folder) folder.favorite = favorite;
      else if (favorite) draft.folders.push({ path: real, favorite: true });
      // A folder that was only a favourite (never used) has nothing left to keep.
      draft.folders = draft.folders.filter((f) => f.favorite || f.lastUsedAt !== undefined);
    });
  }

  private isUsable(path: string): boolean {
    try {
      resolveAllowedPath(path, this.deps.allowedRoots);
      return true;
    } catch {
      return false;
    }
  }
}
