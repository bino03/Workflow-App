import { AppError } from '../common/errors.js';
import type { KeyBinding } from '../state/state.schema.js';
import type { StateStore } from '../state/stateStore.js';
import {
  findAction,
  isAllowed,
  sameBinding,
  SHORTCUT_ACTIONS,
  SHORTCUT_WARNINGS,
  type ShortcutAction,
  type ShortcutWarning,
} from './catalog.js';

export type ShortcutView = ShortcutAction & { binding: KeyBinding | null };
export type KeybindingsView = { actions: ShortcutView[]; warnings: readonly ShortcutWarning[] };

/**
 * The keyboard shortcuts (ADR 0016). state.json keeps only the user's changes; everything else is the
 * catalogue's default. Changes for ids the catalogue no longer has are kept but never shown or matched.
 */
export class KeybindingsService {
  constructor(private readonly stateStore: StateStore) {}

  view(): KeybindingsView {
    const changes = this.stateStore.read().keybindings;
    return {
      actions: SHORTCUT_ACTIONS.map((action) => ({ ...action, binding: effective(action, changes) })),
      warnings: SHORTCUT_WARNINGS,
    };
  }

  /** `null` = no binding. Setting the default back removes the change, so state.json stays "changes only". */
  set(actionId: string, binding: KeyBinding | null): KeybindingsView {
    const action = findAction(actionId);
    if (!action) throw new AppError('KEYBIND_003');
    if (binding && !isAllowed(binding)) throw new AppError('KEYBIND_001');

    if (binding) {
      const changes = this.stateStore.read().keybindings;
      const taken = SHORTCUT_ACTIONS.find((other) => other.id !== action.id && sameBinding(effective(other, changes), binding));
      if (taken) throw new AppError('KEYBIND_002', `Key combination already used by ${taken.id}`);
    }

    this.stateStore.update((draft) => {
      const isDefault = binding === null ? action.default === null : sameBinding(binding, action.default);
      if (isDefault) delete draft.keybindings[action.id];
      else draft.keybindings[action.id] = binding;
    });
    return this.view();
  }

  reset(actionId: string): KeybindingsView {
    if (!findAction(actionId)) throw new AppError('KEYBIND_003');
    this.stateStore.update((draft) => void delete draft.keybindings[actionId]);
    return this.view();
  }

  resetAll(): KeybindingsView {
    this.stateStore.update((draft) => void (draft.keybindings = {}));
    return this.view();
  }
}

function effective(action: ShortcutAction, changes: Record<string, KeyBinding | null>): KeyBinding | null {
  return Object.hasOwn(changes, action.id) ? (changes[action.id] ?? null) : action.default;
}
