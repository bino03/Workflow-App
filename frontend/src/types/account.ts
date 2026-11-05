import type { UsageView } from './usage';

/** Espelho de backend/src/accounts/accounts.schemas.ts (docs/api.md → Contas do Claude). */
export type AccountView = {
  /** `primary` ou um UUID. */
  id: string;
  label: string;
  isPrimary: boolean;
  email: string | null;
  loggedIn: boolean;
  runningTerminals: number;
  usage: UsageView;
};

export type AccountsView = { activeAccountId: string; accounts: AccountView[] };

/** Principal incluída; acima disto o backend responde ACCOUNT_002. */
export const MAX_ACCOUNTS = 5;
