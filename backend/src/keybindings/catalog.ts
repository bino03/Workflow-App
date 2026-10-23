import type { KeyBinding } from '../state/state.schema.js';

/**
 * Every keyboard shortcut the app has (ADR 0016) — the only copy: the frontend reads labels, defaults and
 * warnings from GET /api/keybindings. Ids are stored in state.json, so an id never changes meaning.
 */
export type ShortcutGroup = 'terminals' | 'jump' | 'projects' | 'navigation';

export type ShortcutAction = { id: string; label: string; group: ShortcutGroup; default: KeyBinding | null };

const alt = (code: string): KeyBinding => ({ modifier: 'alt', code });

const JUMPS: ShortcutAction[] = Array.from({ length: 9 }, (_, i) => ({
  id: `jump${i + 1}`,
  label: `Saltar para o terminal ${i + 1}`,
  group: 'jump',
  default: alt(`Digit${i + 1}`),
}));

export const SHORTCUT_ACTIONS: readonly ShortcutAction[] = [
  { id: 'newTerminal', label: 'Novo terminal', group: 'terminals', default: alt('KeyN') },
  { id: 'splitToggle', label: 'Dividir / juntar (na grelha: voltar à grelha)', group: 'terminals', default: alt('Backslash') },
  { id: 'closeTerminal', label: 'Fechar o terminal', group: 'terminals', default: alt('KeyW') },
  { id: 'renameTerminal', label: 'Renomear o terminal', group: 'terminals', default: alt('KeyR') },
  // Alt+L ("link"): Alt+P, Alt+T and Alt+V are Claude Code's own (model, thinking, paste image).
  { id: 'togglePreview', label: 'Pré-visualizar a app em dev (link na tailnet) / desligar', group: 'terminals', default: alt('KeyL') },
  { id: 'zoomIn', label: 'Aumentar a letra do terminal', group: 'terminals', default: alt('Equal') },
  { id: 'zoomOut', label: 'Diminuir a letra do terminal', group: 'terminals', default: alt('Minus') },
  { id: 'zoomReset', label: 'Repor o tamanho da letra', group: 'terminals', default: alt('Digit0') },
  { id: 'toggleSidebar', label: 'Esconder / mostrar a lateral', group: 'terminals', default: { modifier: 'altGraph', code: 'Period' } },
  { id: 'terminalNext', label: 'Terminal seguinte', group: 'terminals', default: null },
  { id: 'terminalPrev', label: 'Terminal anterior', group: 'terminals', default: null },
  ...JUMPS,
  { id: 'projectNext', label: 'Projeto seguinte', group: 'projects', default: null },
  { id: 'projectPrev', label: 'Projeto anterior', group: 'projects', default: null },
  { id: 'projectClose', label: 'Fechar o projeto ativo', group: 'projects', default: null },
  { id: 'goTerminals', label: 'Ir para Terminais', group: 'navigation', default: null },
  { id: 'goLibrary', label: 'Ir para Biblioteca', group: 'navigation', default: null },
];

const LETTERS = Array.from({ length: 26 }, (_, i) => `Key${String.fromCharCode(65 + i)}`);
const DIGITS = Array.from({ length: 10 }, (_, i) => `Digit${i}`);

/**
 * Keys allowed per modifier. Codes are the canonical ones — the frontend folds the numeric keypad and the
 * PT keyboard's `\` key (Backquote / IntlBackslash) into these before sending. No arrows (Alt+← is the
 * browser's back), no F-keys (Alt+F4), no Esc (it leaves the grid and belongs to Claude Code).
 * AltGr only with `.`: AltGr plus a letter or digit types a character on a PT keyboard (ADR 0008).
 */
export const ALLOWED_CODES: Record<KeyBinding['modifier'], ReadonlySet<string>> = {
  alt: new Set([
    ...LETTERS,
    ...DIGITS,
    'Backslash',
    'Period',
    'Comma',
    'Slash',
    'Semicolon',
    'Quote',
    'BracketLeft',
    'BracketRight',
    'Equal',
    'Minus',
  ]),
  altGraph: new Set(['Period']),
};

export type ShortcutWarning = KeyBinding & { reason: string };

/** Combinations that work, but take a key away from the shell or the browser — shown when saving one. */
export const SHORTCUT_WARNINGS: readonly ShortcutWarning[] = [
  { modifier: 'alt', code: 'KeyB', reason: 'Em muitos shells, Alt+B recua uma palavra.' },
  { modifier: 'alt', code: 'KeyF', reason: 'Em muitos shells, Alt+F avança uma palavra; no Chrome abre o menu.' },
  { modifier: 'alt', code: 'KeyD', reason: 'Em muitos shells, Alt+D apaga a palavra seguinte; no Chrome vai para a barra de endereço.' },
  { modifier: 'alt', code: 'KeyE', reason: 'No Chrome, Alt+E abre o menu.' },
  { modifier: 'alt', code: 'Period', reason: 'Em muitos shells, Alt+. repete o último argumento.' },
];

export function findAction(id: string): ShortcutAction | undefined {
  return SHORTCUT_ACTIONS.find((action) => action.id === id);
}

export function isAllowed(binding: KeyBinding): boolean {
  return ALLOWED_CODES[binding.modifier].has(binding.code);
}

export function sameBinding(a: KeyBinding | null, b: KeyBinding | null): boolean {
  return a !== null && b !== null && a.modifier === b.modifier && a.code === b.code;
}
