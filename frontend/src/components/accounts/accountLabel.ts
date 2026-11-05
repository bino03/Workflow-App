import type { AccountsView } from '@/types/account';

/** O nome de uma conta. Uma conta que já não existe lê-se como a principal, que vem sempre em primeiro (como no backend). */
export function accountLabelOf(view: AccountsView, accountId: string): string {
  return (view.accounts.find((account) => account.id === accountId) ?? view.accounts[0])?.label ?? '';
}

/**
 * As outras contas, para um menu. Uma conta sem login fica desativada: o terminal só pediria o login, com a conversa à
 * espera. O login faz-se no drawer "Escolher conta".
 */
export function accountMenuItems(view: AccountsView, excludeId: string, keyPrefix = '') {
  return view.accounts
    .filter((account) => account.id !== excludeId)
    .map((account) => ({
      key: `${keyPrefix}${account.id}`,
      disabled: !account.loggedIn,
      label: account.loggedIn ? account.label : `${account.label} · sem sessão iniciada`,
    }));
}
