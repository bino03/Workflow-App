import type { ComponentType } from 'react';
import { LayoutSection } from './LayoutSection';
import { PasskeysSection } from './PasskeysSection';
import { ShortcutsSection } from './ShortcutsSection';

export type SettingsSection = { id: string; title: string; component: ComponentType };

/**
 * A única lista das Definições: a página mostra as secções por esta ordem e o índice sai daqui.
 * Uma definição nova é uma linha nova — o título é o da secção e o da entrada do índice.
 */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'layout', title: 'Layout dos terminais', component: LayoutSection },
  { id: 'shortcuts', title: 'Atalhos', component: ShortcutsSection },
  { id: 'passkeys', title: 'Passkeys', component: PasskeysSection },
];
