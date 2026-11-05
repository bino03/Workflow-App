import { createContext } from 'react';
import type { AccountView, AccountsView } from '@/types/account';

export type AccountsContextValue = {
  /** `null` até à primeira resposta. */
  view: AccountsView | null;
  active: AccountView | null;
  /** Relê as contas. Lança o erro para quem chamou decidir como o mostrar. */
  refresh: () => Promise<void>;
  /** Muda a conta ativa. A quota da lateral acompanha. Lança o erro como o `refresh`. */
  setActive: (accountId: string) => Promise<void>;
};

export const AccountsContext = createContext<AccountsContextValue | null>(null);
