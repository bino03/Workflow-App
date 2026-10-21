import { createContext, type RefObject } from 'react';
import type { ShortcutIndex } from '@/keyboard/shortcuts';
import type { KeyBinding, KeybindingsView } from '@/types/keybindings';

export type KeybindingsContextValue = {
  /** `null` enquanto carrega — até lá, nenhum atalho dispara. */
  view: KeybindingsView | null;
  /** O índice atual. Ref para os listeners e o xterm o lerem sem se voltarem a registar a cada mudança. */
  indexRef: RefObject<ShortcutIndex>;
  /** Os três atualizam a vista com a resposta do backend; um erro sobe para quem chamou. */
  setBinding: (actionId: string, binding: KeyBinding | null) => Promise<void>;
  resetBinding: (actionId: string) => Promise<void>;
  resetAll: () => Promise<void>;
};

export const KeybindingsContext = createContext<KeybindingsContextValue | null>(null);
