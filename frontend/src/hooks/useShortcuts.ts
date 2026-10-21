import { useEffect, useRef } from 'react';
import { useKeybindings } from '@/hooks/useKeybindings';
import { actionFromEvent } from '@/keyboard/shortcuts';

/**
 * Um listener na janela que executa os atalhos (`keyboard/shortcuts.ts`) — também quando o foco está num
 * terminal: o xterm.js recusa as combinações com bind (não chegam ao PTY) e o evento continua a subir até
 * aqui. `onShortcut` devolve `true` para as ações que são suas; só essas ficam com `preventDefault`. Há
 * mais do que um listener (Terminais e o layout), cada um com as suas ações.
 */
export function useShortcuts(onShortcut: (actionId: string) => boolean, enabled = true) {
  const { indexRef } = useKeybindings();
  const handler = useRef(onShortcut);
  useEffect(() => {
    handler.current = onShortcut;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const actionId = actionFromEvent(event, indexRef.current);
      if (actionId && handler.current(actionId)) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, indexRef]);
}
