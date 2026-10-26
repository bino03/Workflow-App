import api from '@/api';
import type { Answers, FeedPage, GuidedMode, GuidedView } from '@/types/guided';
import type { TerminalView } from '@/types/terminal';

/**
 * Sessões guiadas (ADR 0020): o terminal escondido a quem o dono responde sem ver o TUI. Quem começa uma é o
 * serviço do propósito (`creationService`); daqui para a frente é tudo por estas rotas.
 */

export async function getGuided(id: string): Promise<GuidedView> {
  return (await api.get<GuidedView>(`/guided/${id}`)).data;
}

/** A conversa. `after` = quantas entradas o cliente já tem; a última dessas volta (pode ter mudado). */
export async function getGuidedFeed(id: string, after: number): Promise<FeedPage> {
  return (await api.get<FeedPage>(`/guided/${id}/feed`, { params: { after } })).data;
}

export async function answerQuestion(id: string, requestId: string, answers: Answers): Promise<void> {
  await api.post(`/guided/${id}/answer`, { requestId, answers });
}

export async function decidePermission(id: string, requestId: string, decision: 'allow' | 'deny'): Promise<void> {
  await api.post(`/guided/${id}/permission`, { requestId, decision });
}

/** Perguntar / Automático (ADR 0021). Passar a Automático aprova também as permissões que já estão à espera. */
export async function setGuidedMode(id: string, mode: GuidedMode): Promise<GuidedView> {
  return (await api.put<GuidedView>(`/guided/${id}/mode`, { mode })).data;
}

/** Texto livre, quando o Claude parou à espera dele. */
export async function sendGuidedMessage(id: string, text: string): Promise<void> {
  await api.post(`/guided/${id}/message`, { text });
}

/** Retoma uma sessão parada (o backend reiniciou): `--resume` no mesmo terminal. */
export async function resumeGuided(id: string, size: { cols: number; rows: number }): Promise<GuidedView> {
  return (await api.post<GuidedView>(`/guided/${id}/resume`, size)).data;
}

/** "Ver terminal": o terminal escondido passa para a grelha. */
export async function revealGuided(id: string): Promise<TerminalView> {
  return (await api.post<TerminalView>(`/guided/${id}/reveal`)).data;
}

/** Cancelar (a correr) ou Fechar (terminada): o terminal vai para o histórico, a sessão desaparece. */
export async function removeGuided(id: string): Promise<void> {
  await api.delete(`/guided/${id}`);
}
