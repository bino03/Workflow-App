import { z } from 'zod';

/** The version this code writes. Older files go through `migrate` on load. */
export const STATE_VERSION = 2;

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
  // ADR 0017: launched (and reopened) with --remote-control. Older files have no field → false, no migration.
  remoteControl: z.boolean().default(false),
  // ADR 0019: a terminal started by an import — hidden from the grid and the bot until revealed, reopened with
  // the imports' --settings and the same --add-dir folders. Older files → null / false / [], no migration.
  importId: z.uuid().nullable().default(null),
  hidden: z.boolean().default(false),
  addDirs: z.array(z.string().min(1)).max(4).default([]),
  // ADR 0020: a terminal started by a guided session — hidden like an import's, reopened with the guided
  // --settings, the same --add-dir folders and --permission-mode default. Older files → null, no migration.
  guidedId: z.uuid().nullable().default(null),
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

/**
 * One key combination (ADR 0016). `code` is a `KeyboardEvent.code` — the physical key. Only the shape is
 * checked here; which actions and keys are allowed is the catalogue's job, so an action dropped from the
 * catalogue never stops the backend from starting.
 */
export const keyBindingSchema = z.object({
  modifier: z.enum(['alt', 'altGraph']),
  code: z.string().min(1).max(32),
});

/** Only the user's changes: a missing action keeps its default, `null` = no binding. */
export const keyBindingsSchema = z.record(z.string().min(1).max(64), keyBindingSchema.nullable());

function uniqueBy<T>(items: T[], key: (item: T) => string): boolean {
  return new Set(items.map(key)).size === items.length;
}

export const stateSchema = z
  .object({
    version: z.literal(STATE_VERSION),
    terminals: z.array(savedTerminalSchema),
    closedTerminals: z.array(closedTerminalSchema),
    folders: z.array(folderSchema),
    keybindings: keyBindingsSchema,
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
export type KeyBinding = z.infer<typeof keyBindingSchema>;
export type AppState = z.infer<typeof stateSchema>;

export function emptyState(): AppState {
  return { version: STATE_VERSION, terminals: [], closedTerminals: [], folders: [], keybindings: {} };
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
  // v1 → v2: keyboard shortcuts (ADR 0016). No changes yet = every action on its default.
  if (version === 1) return { ...raw, version: 2, keybindings: {} };
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
