import { use } from 'react';
import { KeybindingsContext } from '@/contexts/keybindingsContextValue';

export function useKeybindings() {
  const value = use(KeybindingsContext);
  if (!value) throw new Error('useKeybindings fora do <KeybindingsProvider>');
  return value;
}
