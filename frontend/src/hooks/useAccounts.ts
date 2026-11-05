import { use } from 'react';
import { AccountsContext } from '@/contexts/accountsContextValue';

/** As contas do Claude, do `<AccountsProvider>` (no `AppLayout`). */
export function useAccounts() {
  const value = use(AccountsContext);
  if (!value) throw new Error('useAccounts fora do <AccountsProvider>');
  return value;
}
