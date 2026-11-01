import { z } from 'zod';
import { accountIdSchema } from '../state/state.schema.js';
import { LABEL_PATTERN } from '../terminals/terminal.schemas.js';
import { colsSchema, rowsSchema } from '../terminals/protocol.js';
import type { UsageView } from '../usage/usageFiles.js';

/**
 * Request bodies of /api/accounts (ADR 0027) — mirrored in `frontend/src/types/account.ts`. The name is free
 * text shown in the UI: the terminals' allowlist, never `< > \` { } $`.
 */
export const accountLabelSchema = z.string().trim().min(1).max(40).regex(LABEL_PATTERN, 'only letters, digits, spaces and . _ - ( )');

export const createAccountSchema = z.object({ label: accountLabelSchema });
export const renameAccountSchema = z.object({ label: accountLabelSchema });
export const setActiveAccountSchema = z.object({ accountId: accountIdSchema });
export const accountLoginSchema = z.object({ cols: colsSchema, rows: rowsSchema });

export type AccountView = {
  id: string;
  /** "Principal" while the primary has no name of its own. */
  label: string;
  isPrimary: boolean;
  email: string | null;
  loggedIn: boolean;
  runningTerminals: number;
  usage: UsageView;
};

export type AccountsView = { activeAccountId: string; accounts: AccountView[] };
