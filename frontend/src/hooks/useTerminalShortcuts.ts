import { useEffect, useRef } from 'react';

/**
 * Atalhos da app nos terminais: Alt+1…9 saltar · Alt+N novo · Alt+\ dividir/juntar · Alt+W fechar ·
 * Alt+R renomear · Alt+= / Alt+- zoom só no terminal · Alt+0 repor (handoff de design; ADR 0008).
 * AltGr+. esconde/mostra a lateral (2026-09-29) — a única exceção à regra abaixo.
 * Nunca Ctrl+… (é do Claude Code e do browser — Ctrl+= faria zoom na página toda) nem Ctrl+Alt+… (é o
 * AltGr num teclado PT — escreve \ @ { [ …), **exceto** AltGr+.: o `.` não precisa de AltGr para se
 * escrever num teclado PT, por isso não colide com escrita normal; distingue-se de um Ctrl+Alt a sério
 * (duas teclas separadas) com `getModifierState('AltGraph')`, que o browser expõe à parte de `ctrlKey`.
 */
export type ShortcutAction =
  | { type: 'jump'; index: number }
  | { type: 'new' }
  | { type: 'split' }
  | { type: 'close' }
  | { type: 'rename' }
  | { type: 'zoom'; direction: 'in' | 'out' | 'reset' }
  | { type: 'toggleSidebar' };

// Por `code` (a tecla física) para não depender do layout; o \ num teclado PT é a tecla à esquerda do 1.
const BACKSLASH_CODES = new Set(['Backslash', 'IntlBackslash', 'Backquote']);
const ZOOM_IN_CODES = new Set(['Equal', 'NumpadAdd']);
const ZOOM_OUT_CODES = new Set(['Minus', 'NumpadSubtract']);
const ZOOM_RESET_CODES = new Set(['Digit0', 'Numpad0']);
const PERIOD_CODES = new Set(['Period', 'NumpadDecimal']);

function isAltGraph(event: KeyboardEvent): boolean {
  return typeof event.getModifierState === 'function' && event.getModifierState('AltGraph');
}

export function shortcutFromEvent(event: KeyboardEvent): ShortcutAction | null {
  // AltGr chega com ctrlKey+altKey ambos a true — tem de se verificar antes do guard de baixo, que
  // rejeita qualquer evento com ctrlKey.
  if (isAltGraph(event) && !event.shiftKey && (PERIOD_CODES.has(event.code) || event.key === '.')) {
    return { type: 'toggleSidebar' };
  }
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
  if (ZOOM_IN_CODES.has(event.code) || event.key === '+') return { type: 'zoom', direction: 'in' };
  if (ZOOM_OUT_CODES.has(event.code)) return { type: 'zoom', direction: 'out' };
  if (ZOOM_RESET_CODES.has(event.code)) return { type: 'zoom', direction: 'reset' };
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
