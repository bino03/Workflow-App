import { useCallback, useSyncExternalStore } from 'react';

/** focus = foco dividido (por omissão: um terminal, Alt+\ divide em dois) · grid = grelha (ADR 0008). */
export type LayoutMode = 'focus' | 'grid';

// Preferência do dispositivo, no localStorage (decidido no /design-database — docs/database.md).
const KEY = 'workflow-app.layout';
const CHANGE_EVENT = 'workflow-app:layout';

function read(): LayoutMode {
  try {
    return localStorage.getItem(KEY) === 'grid' ? 'grid' : 'focus';
  } catch {
    return 'focus';
  }
}

function subscribe(onChange: () => void) {
  // storage: outros separadores; o evento próprio: este separador (o storage não dispara aqui).
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** O modo de layout dos terminais, partilhado entre a página e o drawer Definições. */
export function useLayoutMode(): [LayoutMode, (mode: LayoutMode) => void] {
  const mode = useSyncExternalStore(subscribe, read, () => 'focus' as const);
  const setMode = useCallback((next: LayoutMode) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // localStorage indisponível: a escolha dura só esta visita.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return [mode, setMode];
}
