import api from '@/api';
import type { AccountView, AccountsView } from '@/types/account';
import type { TerminalSize, TerminalView } from '@/types/terminal';

export async function getAccounts(): Promise<AccountsView> {
  // Sondado a cada minuto: uma falha pontual não merece um toast, quem abre o drawer é que a mostra.
  return (await api.get<AccountsView>('/accounts', { skipErrorNotification: true })).data;
}

export async function createAccount(label: string): Promise<AccountView> {
  return (await api.post<AccountView>('/accounts', { label })).data;
}

export async function renameAccount(id: string, label: string): Promise<AccountView> {
  return (await api.patch<AccountView>(`/accounts/${id}`, { label })).data;
}

export async function setActiveAccount(accountId: string): Promise<AccountsView> {
  return (await api.put<AccountsView>('/accounts/active', { accountId })).data;
}

export async function removeAccount(id: string): Promise<void> {
  await api.delete(`/accounts/${id}`);
}

export async function openAccountLogin(id: string, size: TerminalSize): Promise<TerminalView> {
  return (await api.post<TerminalView>(`/accounts/${id}/login`, size)).data;
}
