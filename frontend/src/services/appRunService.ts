import api from '@/api';
import type { AppRunView } from '@/types/appRun';

export async function getAppRun(path: string): Promise<AppRunView> {
  return (await api.get<AppRunView>('/app-runs', { params: { path } })).data;
}

/** Abre o terminal escondido com `/run`. */
export async function startAppRun(path: string): Promise<AppRunView> {
  return (await api.post<AppRunView>('/app-runs', { path })).data;
}

/** Escreve `/stop` no terminal do `/run`; o backend fecha-o quando as portas fecham (ou ao fim de 20 s). */
export async function stopAppRun(path: string): Promise<AppRunView> {
  return (await api.post<AppRunView>('/app-runs/stop', { path })).data;
}

/** "Ver terminal": o terminal escondido passa a aparecer na grelha. */
export async function revealAppRun(path: string): Promise<{ terminalId: string }> {
  return (await api.post<{ terminalId: string }>('/app-runs/reveal', { path })).data;
}
