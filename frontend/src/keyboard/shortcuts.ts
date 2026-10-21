import type { KeyBinding, ShortcutView } from '@/types/keybindings';

/**
 * Atalhos da app (ADR 0016; regras de teclas no ADR 0008): só Alt+… e AltGr+…. Nunca Ctrl+… (é do Claude
 * Code e do browser — Ctrl+= faria zoom na página toda) nem Ctrl+Alt+… (é o AltGr num teclado PT). O
 * AltGr distingue-se de um Ctrl+Alt a sério com `getModifierState('AltGraph')`, que o browser expõe à
 * parte de `ctrlKey`. Que teclas cada modificador aceita decide o backend (catálogo).
 */

/** Por `code` (a tecla física): o teclado numérico, e o \ do teclado PT (a tecla à esquerda do 1). */
const CODE_SYNONYMS: Record<string, string> = {
  IntlBackslash: 'Backslash',
  Backquote: 'Backslash',
  NumpadAdd: 'Equal',
  NumpadSubtract: 'Minus',
  Numpad0: 'Digit0',
  NumpadDecimal: 'Period',
};

/** Último recurso, pelo carácter — só se a tecla física não tem bind (o + de um teclado PT não é `Equal`). */
const KEY_FALLBACK: Record<string, string> = { '\\': 'Backslash', '+': 'Equal', '.': 'Period' };

/** Teclas que sozinhas não fazem uma combinação — a captura espera pela seguinte. */
export const MODIFIER_CODES = new Set(['AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight']);

const KEY_LABELS: Record<string, string> = {
  Backslash: '\\',
  Period: '.',
  Comma: ',',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Equal: '=',
  Minus: '-',
};

/** bindingKey → id da ação. */
export type ShortcutIndex = ReadonlyMap<string, string>;

function isAltGraph(event: KeyboardEvent): boolean {
  return typeof event.getModifierState === 'function' && event.getModifierState('AltGraph');
}

/**
 * A combinação de um evento, ou `null` se não é Alt/AltGr sem Shift. Usada pelos listeners, pelo xterm e
 * pela captura das Definições — os três têm de ver a mesma tecla.
 */
export function bindingFromEvent(event: KeyboardEvent): KeyBinding | null {
  // AltGr chega com ctrlKey+altKey a true — tem de se verificar antes do guard do Alt, que rejeita ctrlKey.
  const modifier = isAltGraph(event) ? 'altGraph' : event.altKey && !event.ctrlKey && !event.metaKey ? 'alt' : null;
  if (!modifier || event.shiftKey) return null;
  return { modifier, code: CODE_SYNONYMS[event.code] ?? event.code };
}

export const bindingKey = (binding: KeyBinding) => `${binding.modifier}+${binding.code}`;

export function buildShortcutIndex(actions: ShortcutView[]): ShortcutIndex {
  return new Map(actions.flatMap((action) => (action.binding ? [[bindingKey(action.binding), action.id] as const] : [])));
}

/** A ação que este evento dispara, ou `null`. */
export function actionFromEvent(event: KeyboardEvent, index: ShortcutIndex): string | null {
  const binding = bindingFromEvent(event);
  if (!binding) return null;
  const exact = index.get(bindingKey(binding));
  if (exact) return exact;
  const fallback = KEY_FALLBACK[event.key];
  return fallback ? (index.get(bindingKey({ modifier: binding.modifier, code: fallback })) ?? null) : null;
}

export function sameBinding(a: KeyBinding | null, b: KeyBinding | null): boolean {
  return a !== null && b !== null && a.modifier === b.modifier && a.code === b.code;
}

/** "Alt+N", "AltGr+.", "Alt+\". */
export function formatBinding(binding: KeyBinding): string {
  const { code } = binding;
  const key = code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : (KEY_LABELS[code] ?? code);
  return `${binding.modifier === 'altGraph' ? 'AltGr' : 'Alt'}+${key}`;
}
