import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorHandler } from '@/errors/errorHandler';
import * as terminalService from '@/services/terminalService';
import type { CreateTerminalBody, TerminalSize, TerminalView } from '@/types/terminal';

const REFRESH_ON_RETURN_MS = 5000;
const REFRESH_EVERY_MS = 10_000;

/**
 * Hook local dos Terminais: dono da lista (a ordem é a do backend — por createdAt). As ações devolvem o
 * terminal atualizado e lançam o erro para quem as chamou decidir onde mostrá-lo.
 */
export function useTerminals() {
  const [terminals, setTerminals] = useState<TerminalView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const loaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    terminalService
      .getTerminals()
      .then((list) => {
        if (cancelled) return;
        loaded.current = true;
        // Igual ao que já está → o mesmo estado, sem re-renderizar a página a cada releitura.
        setTerminals((current) => (JSON.stringify(current) === JSON.stringify(list) ? current : list));
        setError(null);
      })
      .catch((e: unknown) => {
        // Reclamado mesmo num efeito cancelado (StrictMode) — senão o interceptor notifica por cima.
        ErrorHandler.handle(e, { showNotification: false });
        // Uma releitura que falha (o backend a reiniciar) não troca a página por um erro: fica a última lista.
        if (!cancelled && !loaded.current) setError(ErrorHandler.getMessage(e));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  /** Relê a lista (um terminal terminou, foi reaberto noutro separador…). */
  const refresh = useCallback(() => setAttempt((n) => n + 1), []);

  // O bot de Telegram abre e para terminais sem esta página saber (ADR 0017). Voltar à janela não chega — com a
  // janela do PC sempre focada enquanto se usa o telemóvel não há evento nenhum (visto a 2026-10-22) —, por isso
  // relê também de REFRESH_EVERY_MS em REFRESH_EVERY_MS enquanto a página está visível.
  useEffect(() => {
    let last = Date.now();
    const reread = (minGapMs: number) => {
      if (document.visibilityState !== 'visible' || Date.now() - last < minGapMs) return;
      last = Date.now();
      refresh();
    };
    const onReturn = () => reread(REFRESH_ON_RETURN_MS);
    const timer = window.setInterval(() => reread(REFRESH_EVERY_MS - 500), REFRESH_EVERY_MS);
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      window.clearInterval(timer);
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
