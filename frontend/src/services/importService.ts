import api from '@/api';
import type { CreateImportBody, ImportDiff, ImportView } from '@/types/imports';
import type { TerminalView } from '@/types/terminal';

/** O caminho de um ficheiro enviado: o relativo numa pasta escolhida (`webkitdirectory`), senão o nome. */
export function relativePathOf(file: File): string {
  return file.webkitRelativePath || file.name;
}

/**
 * Começa uma importação (ADR 0019). Com ficheiros, o `source` passa a `{type: 'files', paths}` com os caminhos
 * pela mesma ordem das partes `files` — o backend ignora o nome de cada parte. O drawer mostra o erro dentro
 * dele, por isso o interceptor global não notifica.
 */
export async function createImport(body: CreateImportBody, files: File[] = []): Promise<ImportView> {
  const request = files.length > 0 ? { ...body, source: { type: 'files' as const, paths: files.map(relativePathOf) } } : body;
  const form = new FormData();
  form.append('request', JSON.stringify(request));
  for (const file of files) form.append('files', file, file.name);
  return (await api.post<ImportView>('/library/imports', form, { skipErrorNotification: true })).data;
}

/** A importação aberta (há no máximo uma), ou null. */
export async function getCurrentImport(): Promise<ImportView | null> {
  return (await api.get<ImportView | null>('/library/imports/current')).data;
}

export async function getImportDiff(id: string): Promise<ImportDiff> {
  return (await api.get<ImportDiff>(`/library/imports/${id}/diff`)).data;
}

/** Commit no Workflow do que a importação mudou. Devolve o sha. */
export async function acceptImport(id: string): Promise<{ commit: string }> {
  return (await api.post<{ commit: string }>(`/library/imports/${id}/accept`)).data;
}

/** "Descartar" (uma importação acabada) — repõe o Workflow como estava. */
export async function discardImport(id: string): Promise<void> {
  await api.post(`/library/imports/${id}/discard`);
}

/** "Cancelar" enquanto corre — no backend é o mesmo que descartar. */
export async function cancelImport(id: string): Promise<void> {
  await api.delete(`/library/imports/${id}`);
}

/** "Ver terminal": o terminal escondido passa a aparecer na grelha. */
export async function revealImportTerminal(id: string): Promise<TerminalView> {
  return (await api.post<TerminalView>(`/library/imports/${id}/reveal`)).data;
}
