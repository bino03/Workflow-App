import { useEffect, useRef } from 'react';

/**
 * Atalhos da app nos terminais: Alt+1…9 saltar · Alt+N novo · Alt+\ dividir/juntar · Alt+W fechar ·
 * Alt+R renomear (handoff de design; ADR 0008). Nunca Ctrl+… (é do Claude Code e do browser) nem
 * Ctrl+Alt+… (é o AltGr num teclado PT — escreve \ @ { [ …).
 */
export type ShortcutAction =
  | { type: 'jump'; index: number }
  | { type: 'new' }
  | { type: 'split' }
  | { type: 'close' }
  | { type: 'rename' };

// Por `code` (a tecla física) para não depender do layout; o \ num teclado PT é a tecla à esquerda do 1.
const BACKSLASH_CODES = new Set(['Backslash', 'IntlBackslash', 'Backquote']);

export function shortcutFromEvent(event: KeyboardEvent): ShortcutAction | null {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  const digit = /^Digit([1-9])$/.exec(event.code);
  if (digit) return { type: 'jump', index: Number(digit[1]) - 1 };
  switch (event.code) {
    case 'KeyN':
      return { type: 'new' };
    case 'KeyW':
      return { type: 'close' };
    case 'KeyR':
      return { type: 'rename' };
  }
  if (BACKSLASH_CODES.has(event.code) || event.key === '\\') return { type: 'split' };
  return null;
}

/**
 * Um único listener na janela executa os atalhos — também quando o foco está num terminal: o xterm.js
 * recusa-os (não chegam ao PTY) e o evento continua a subir até aqui.
 */
export function useTerminalShortcuts(onShortcut: (action: ShortcutAction) => void, enabled = true) {
  const handler = useRef(onShortcut);
  useEffect(() => {
    handler.current = onShortcut;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const action = shortcutFromEvent(event);
      if (!action) return;
      event.preventDefault();
      handler.current(action);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
