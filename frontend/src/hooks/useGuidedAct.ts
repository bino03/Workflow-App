import { useCallback, useState } from 'react';
import { ErrorHandler } from '@/errors/errorHandler';

/**
 * Uma ação do dono numa sessão guiada (responder, permitir, mudar o modo…): desativa tudo enquanto corre, os
 * erros vão ao ErrorHandler, e no fim relê a sessão. Devolve se correu bem (a ReplyBox só limpa nesse caso).
 */
export function useGuidedAct(refresh: () => void) {
  const [busy, setBusy] = useState(false);

  const act = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      setBusy(true);
      try {
        await action();
        return true;
      } catch (e) {
        ErrorHandler.handle(e);
        return false;
      } finally {
        setBusy(false);
        refresh();
      }
    },
    [refresh],
  );

  return { busy, act };
}
