/** Uma combinação (ADR 0016): `code` é a tecla física (`KeyboardEvent.code`), nunca o carácter. */
export type KeyBinding = { modifier: 'alt' | 'altGraph'; code: string };

export type ShortcutGroup = 'terminals' | 'jump' | 'projects' | 'navigation';

/** Uma ação do catálogo do backend, com a bind em vigor (alteração do dono ou predefinido). */
export type ShortcutView = {
  id: string;
  label: string;
  group: ShortcutGroup;
  default: KeyBinding | null;
  binding: KeyBinding | null;
};

/** Combinação que funciona, mas tira a tecla ao shell ou ao browser — avisa-se ao gravar. */
export type ShortcutWarning = KeyBinding & { reason: string };

export type KeybindingsView = { actions: ShortcutView[]; warnings: ShortcutWarning[] };
