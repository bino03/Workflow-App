import type { AccountsView } from '@/types/account';

/** O nome de uma conta. Uma conta que já não existe lê-se como a principal, que vem sempre em primeiro (como no backend). */
export function accountLabelOf(view: AccountsView, accountId: string): string {
  return (view.accounts.find((account) => account.id === accountId) ?? view.accounts[0])?.label ?? '';
}
