import { useCallback, useEffect, useState } from 'react';
import { ErrorHandler } from '@/errors/errorHandler';
import * as terminalService from '@/services/terminalService';
import type { CreateTerminalBody, TerminalSize, TerminalView } from '@/types/terminal';

const REFRESH_ON_RETURN_MS = 5000;

/**
 * Hook local dos Terminais: dono da lista (a ordem é a do backend — por createdAt). As ações devolvem o
 * terminal atualizado e lançam o erro para quem as chamou decidir onde mostrá-lo.
 */
export function useTerminals() {
  const [terminals, setTerminals] = useState<TerminalView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    terminalService
      .getTerminals()
      .then((list) => {
        if (cancelled) return;
        setTerminals(list);
        setError(null);
      })
      .catch((e: unknown) => {
        // Reclamado mesmo num efeito cancelado (StrictMode) — senão o interceptor notifica por cima.
        ErrorHandler.handle(e, { showNotification: false });
        if (!cancelled) setError(ErrorHandler.getMessage(e));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  /** Relê a lista (um terminal terminou, foi reaberto noutro separador…). */
  const refresh = useCallback(() => setAttempt((n) => n + 1), []);

  // O bot de Telegram abre e para terminais sem esta página saber (ADR 0017): ao voltar à janela, relê a lista
  // — no máximo uma vez a cada 5 s, porque focus e visibilitychange chegam juntos.
  useEffect(() => {
    let last = Date.now();
    const onReturn = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < REFRESH_ON_RETURN_MS) return;
      last = Date.now();
      refresh();
    };
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [refresh]);

  const replace = (view: TerminalView) =>
    setTerminals((list) => (list.some((t) => t.id === view.id) ? list.map((t) => (t.id === view.id ? view : t)) : [...list, view]));

  const create = useCallback(async (body: CreateTerminalBody) => {
    const view = await terminalService.createTerminal(body);
    replace(view);
    return view;
  }, []);

  const reopen = useCallback(async (id: string, size: TerminalSize) => {
    const { freshSession, ...view } = await terminalService.reopenTerminal(id, size);
    replace(view);
    return { ...view, freshSession };
  }, []);

  const rename = useCallback(async (id: string, label: string | null) => {
    const view = await terminalService.renameTerminal(id, label);
    replace(view);
    return view;
  }, []);

  const close = useCallback(async (id: string) => {
    await terminalService.closeTerminal(id);
    setTerminals((list) => list.filter((t) => t.id !== id));
  }, []);

  /** O processo terminou (mensagem exit do WebSocket): muda o estado sem esperar pela lista. */
  const markExited = useCallback((id: string, exitCode: number) => {
    setTerminals((list) => list.map((t) => (t.id === id ? { ...t, status: 'exited', exitCode } : t)));
  }, []);

  return { terminals, loading, error, refresh, create, reopen, rename, close, markExited };
}
