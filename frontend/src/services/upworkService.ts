import api from '@/api';
import { API_BASE_URL } from '@/config/apiBase';
import type { GuidedView } from '@/types/guided';
import type { ApplicationChanges, ApplicationView, NewApplication, PreparedAttachments, ProfileView } from '@/types/upwork';

/**
 * Secção Upwork (ADR 0022). A app nunca fala com a Upwork: o anúncio entra colado e o pacote sai copiado.
 * As perguntas, permissões, o feed e o modo da conversa passam pelo `guidedService` (`guidedId`).
 */
export async function getProfile(): Promise<ProfileView> {
  return (await api.get<ProfileView>('/upwork/profile')).data;
}

export async function saveProfile(markdown: string): Promise<ProfileView> {
  return (await api.put<ProfileView>('/upwork/profile', { markdown })).data;
}

export async function getApplications(archived: boolean): Promise<ApplicationView[]> {
  return (await api.get<ApplicationView[]>('/upwork/applications', { params: { archived } })).data;
}

export async function getApplication(id: string): Promise<ApplicationView> {
  return (await api.get<ApplicationView>(`/upwork/applications/${id}`)).data;
}

/** Preparar anexos (ADR 0025): copia os prints, com o nome para a Upwork, para a pasta da candidatura e abre-a. */
export async function prepareAttachments(id: string): Promise<PreparedAttachments> {
  return (await api.post<PreparedAttachments>(`/upwork/applications/${id}/attachments/prepare`)).data;
}

/** Um print a anexar (ADR 0024), pela posição no `attachments.json`: `download` guarda-o com o nome para a Upwork. */
export function attachmentUrl(id: string, index: number, download = false): string {
  return `${API_BASE_URL}/upwork/applications/${id}/attachments/${index}${download ? '?download=1' : ''}`;
}

/** Cria o registo e arranca a sessão guiada `upwork` que gera o pacote. */
export async function createApplication(data: NewApplication): Promise<ApplicationView> {
  return (await api.post<ApplicationView>('/upwork/applications', data)).data;
}

/** Mudar o estado para `sent` também pausa a sessão (fecha o terminal). */
export async function updateApplication(id: string, changes: ApplicationChanges): Promise<ApplicationView> {
  return (await api.patch<ApplicationView>(`/upwork/applications/${id}`, changes)).data;
}

export async function pauseApplication(id: string): Promise<ApplicationView> {
  return (await api.post<ApplicationView>(`/upwork/applications/${id}/pause`)).data;
}

/** Escreve na conversa; se a sessão está pausada, o backend retoma-a antes. */
export async function sendApplicationMessage(id: string, text: string): Promise<void> {
  await api.post(`/upwork/applications/${id}/message`, { text });
}

/** "Criar projeto" (só `won`): começa uma criação no ecrã Novo projeto, com o acordo no brief. */
export async function createProjectFromApplication(id: string, agreement: string): Promise<GuidedView> {
  return (await api.post<GuidedView>(`/upwork/applications/${id}/project`, { agreement })).data;
}

export async function archiveApplication(id: string): Promise<ApplicationView> {
  return (await api.post<ApplicationView>(`/upwork/applications/${id}/archive`)).data;
}

export async function deleteApplication(id: string): Promise<void> {
  await api.delete(`/upwork/applications/${id}`);
}
