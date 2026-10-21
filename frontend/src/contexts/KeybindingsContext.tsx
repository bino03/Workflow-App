import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorHandler } from '@/errors/errorHandler';
import { buildShortcutIndex, type ShortcutIndex } from '@/keyboard/shortcuts';
import { getKeybindings, resetAllKeybindings, resetKeybinding, setKeybinding } from '@/services/keybindingService';
import type { KeybindingsView } from '@/types/keybindings';
import { KeybindingsContext, type KeybindingsContextValue } from './keybindingsContextValue';

/**
 * As binds dos atalhos (ADR 0016), carregadas uma vez por sessão no layout autenticado — servem os
 * Terminais, a Biblioteca (navegação) e as Definições. Vêm do backend, que tem o único catálogo.
 */
export function KeybindingsProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<KeybindingsView | null>(null);
  const indexRef = useRef<ShortcutIndex>(new Map());

  useEffect(() => {
    let cancelled = false;
    getKeybindings()
      .then((loaded) => !cancelled && setView(loaded))
      .catch((e: unknown) => ErrorHandler.handle(e));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    indexRef.current = view ? buildShortcutIndex(view.actions) : new Map();
  }, [view]);

  const value = useMemo<KeybindingsContextValue>(
    () => ({
      view,
      indexRef,
      setBinding: async (actionId, binding) => setView(await setKeybinding(actionId, binding)),
      resetBinding: async (actionId) => setView(await resetKeybinding(actionId)),
      resetAll: async () => setView(await resetAllKeybindings()),
    }),
    [view],
  );

  return <KeybindingsContext value={value}>{children}</KeybindingsContext>;
}
