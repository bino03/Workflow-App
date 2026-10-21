import api from '@/api';
import type { KeyBinding, KeybindingsView } from '@/types/keybindings';

/** Todas as rotas devolvem a vista inteira — a página nunca junta alterações à mão. */
export async function getKeybindings(): Promise<KeybindingsView> {
  return (await api.get<KeybindingsView>('/keybindings')).data;
}

/** `null` = sem bind. */
export async function setKeybinding(actionId: string, binding: KeyBinding | null): Promise<KeybindingsView> {
  return (await api.put<KeybindingsView>(`/keybindings/${encodeURIComponent(actionId)}`, { binding })).data;
}

/** Volta ao predefinido só desta ação. */
export async function resetKeybinding(actionId: string): Promise<KeybindingsView> {
  return (await api.delete<KeybindingsView>(`/keybindings/${encodeURIComponent(actionId)}`)).data;
}

export async function resetAllKeybindings(): Promise<KeybindingsView> {
  return (await api.post<KeybindingsView>('/keybindings/reset')).data;
}
