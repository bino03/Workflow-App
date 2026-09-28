import { use } from 'react';
import { ConfirmDialogContext } from '@/contexts/confirmDialogContextValue';

export function useConfirm() {
  const confirm = use(ConfirmDialogContext);
  if (!confirm) throw new Error('useConfirm fora do <ConfirmDialogProvider>');
  return confirm;
}
