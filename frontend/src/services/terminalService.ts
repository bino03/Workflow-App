import api from '@/api';
import type { CreateTerminalBody, ReopenedTerminal, TerminalSize, TerminalView } from '@/types/terminal';

export async function getTerminals(): Promise<TerminalView[]> {
  return (await api.get<TerminalView[]>('/terminals')).data;
}

export async function createTerminal(body: CreateTerminalBody): Promise<TerminalView> {
  return (await api.post<TerminalView>('/terminals', body)).data;
}

export async function reopenTerminal(id: string, size: TerminalSize): Promise<ReopenedTerminal> {
  return (await api.post<ReopenedTerminal>(`/terminals/${id}/reopen`, size)).data;
}

export async function renameTerminal(id: string, label: string | null): Promise<TerminalView> {
  return (await api.patch<TerminalView>(`/terminals/${id}`, { label })).data;
}

export async function closeTerminal(id: string): Promise<void> {
  await api.delete(`/terminals/${id}`);
}
