import api from '@/api';
import type { GuidedView } from '@/types/guided';
import type { TerminalView } from '@/types/terminal';

/**
 * "Novo projeto" (spec novo-projeto-guiado): o `/create` do Workflow numa sessão guiada. A descrição vai só para o
 * brief, nunca para a linha de comando. Depois de começar, tudo passa pelo `guidedService`.
 */
export async function startCreation(description: string): Promise<GuidedView> {
  return (await api.post<GuidedView>('/creations', { description })).data;
}

/** A criação aberta (há no máximo uma), ou null. */
export async function getCurrentCreation(): Promise<GuidedView | null> {
  return (await api.get<GuidedView | null>('/creations/current')).data;
}

/** "Abrir projeto": um terminal novo, visível, na pasta que o `/create` criou. */
export async function openCreatedProject(id: string): Promise<TerminalView> {
  return (await api.post<TerminalView>(`/creations/${id}/open`)).data;
}
