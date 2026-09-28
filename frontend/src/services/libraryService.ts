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
