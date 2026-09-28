import { z } from 'zod';

/** The version this code writes. Older files go through `migrate` on load. */
export const STATE_VERSION = 1;

/** Closed terminals kept in the history, newest by `closedAt`. */
export const MAX_CLOSED_TERMINALS = 200;
/** Non-favourite folders kept, newest by `lastUsedAt`. Favourites never count. */
export const MAX_RECENT_FOLDERS = 10;

const instant = z.iso.datetime();

export const savedTerminalSchema = z.object({
  id: z.uuid(),
  label: z.string().max(80).nullable(),
  cwd: z.string().min(1),
  claudeSessionId: z.uuid(),
  createdAt: instant,
  updatedAt: instant,
  lastOpenedAt: instant,
});

export const closedTerminalSchema = z.object({
  id: z.uuid(),
  label: z.string().max(80).nullable(),
  cwd: z.string().min(1),
  claudeSessionId: z.uuid(),
  openedAt: instant,
  closedAt: instant,
  summary: z.string().max(600).nullable(),
  summarySource: z.enum(['ai-title', 'last-message']).nullable(),
});

export const folderSchema = z.object({
  path: z.string().min(1),
  favorite: z.boolean().default(false),
  lastUsedAt: instant.optional(),
});

function uniqueBy<T>(items: T[], key: (item: T) => string): boolean {
  return new Set(items.map(key)).size === items.length;
}

export const stateSchema = z
  .object({
    version: z.literal(STATE_VERSION),
    terminals: z.array(savedTerminalSchema),
    closedTerminals: z.array(closedTerminalSchema),
    folders: z.array(folderSchema),
  })
  .refine((state) => uniqueBy(state.terminals, (terminal) => terminal.id), {
    message: 'terminal ids must be unique',
    path: ['terminals'],
  })
  .refine((state) => uniqueBy(state.folders, (folder) => folder.path), {
    message: 'folder paths must be unique',
    path: ['folders'],
  });

export type SavedTerminal = z.infer<typeof savedTerminalSchema>;
export type ClosedTerminal = z.infer<typeof closedTerminalSchema>;
export type Folder = z.infer<typeof folderSchema>;
export type AppState = z.infer<typeof stateSchema>;

export function emptyState(): AppState {
  return { version: STATE_VERSION, terminals: [], closedTerminals: [], folders: [] };
}

/**
 * Brings a parsed file up to STATE_VERSION. Each schema change adds one step (vN → vN+1) here;
 * old files are never edited by hand.
 */
export function migrate(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || !('version' in raw)) return raw; // the schema reports it
  const { version } = raw;
  if (typeof version === 'number' && version > STATE_VERSION) {
    throw new Error(`state.json has version ${version}, written by a newer Workflow App (this one reads ${STATE_VERSION})`);
  }
  return raw;
}

/** Keeps the history and the recent folders within their limits. Pure: returns a new state. */
export function enforceLimits(state: AppState): AppState {
  const closedTerminals = [...state.closedTerminals]
    .sort((a, b) => b.closedAt.localeCompare(a.closedAt))
    .slice(0, MAX_CLOSED_TERMINALS);

  const favourites = state.folders.filter((folder) => folder.favorite);
  const recents = state.folders
    .filter((folder) => !folder.favorite)
    // Never-used folders sort last, so they are the first to go.
    .sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''))
    .slice(0, MAX_RECENT_FOLDERS);

  return { ...state, closedTerminals, folders: [...favourites, ...recents] };
}
