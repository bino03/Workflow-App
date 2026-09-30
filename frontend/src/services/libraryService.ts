import api from '@/api';
import type { LibraryList, SkillEntry, StackEntry, ThemeEntry } from '@/types/library';

export async function getStacks(): Promise<LibraryList<StackEntry>> {
  return (await api.get<LibraryList<StackEntry>>('/library/stacks')).data;
}

export async function getThemes(): Promise<LibraryList<ThemeEntry>> {
  return (await api.get<LibraryList<ThemeEntry>>('/library/themes')).data;
}

export async function getSkills(): Promise<LibraryList<SkillEntry>> {
  return (await api.get<LibraryList<SkillEntry>>('/library/skills')).data;
}

/**
 * A única escrita da app na biblioteca do Workflow (ADR 0014). O destino do ficheiro é decidido pelo
 * backend a partir do frontmatter — o nome do ficheiro escolhido aqui é ignorado.
 * O drawer mostra o erro dentro dele, por isso o interceptor global não notifica.
 */
export async function uploadSkill(stackId: string, file: File): Promise<SkillEntry> {
  const body = new FormData();
  body.append('file', file);
  const { data } = await api.post<SkillEntry>(`/library/stacks/${encodeURIComponent(stackId)}/skills`, body, {
    skipErrorNotification: true,
  });
  return data;
}
