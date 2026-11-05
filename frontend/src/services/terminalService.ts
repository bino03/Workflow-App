import api from '@/api';
import type { CreateTerminalBody, ReopenedTerminal, StartPreviewResult, TerminalSize, TerminalView } from '@/types/terminal';

export async function getTerminals(): Promise<TerminalView[]> {
  return (await api.get<TerminalView[]>('/terminals')).data;
}

export async function createTerminal(body: CreateTerminalBody): Promise<TerminalView> {
  return (await api.post<TerminalView>('/terminals', body)).data;
}

/** `accountId` omitido: reabre na conta do próprio terminal. */
export async function reopenTerminal(id: string, size: TerminalSize, accountId?: string): Promise<ReopenedTerminal> {
  return (await api.post<ReopenedTerminal>(`/terminals/${id}/reopen`, { ...size, accountId })).data;
}

/** O tamanho do contexto da conversa, em tokens; `null` sem resposta do assistente gravada. */
export async function getTerminalContext(id: string): Promise<{ tokens: number | null }> {
  return (await api.get<{ tokens: number | null }>(`/terminals/${id}/context`)).data;
}

export async function renameTerminal(id: string, label: string | null): Promise<TerminalView> {
  return (await api.patch<TerminalView>(`/terminals/${id}`, { label })).data;
}

export async function closeTerminal(id: string): Promise<void> {
  await api.delete(`/terminals/${id}`);
}

export async function startPreview(id: string, devPort?: number): Promise<StartPreviewResult> {
  return (await api.post<StartPreviewResult>(`/terminals/${id}/preview`, devPort === undefined ? {} : { devPort })).data;
}

export async function stopPreview(id: string): Promise<void> {
  await api.delete(`/terminals/${id}/preview`);
}
