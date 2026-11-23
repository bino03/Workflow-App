import { useCallback, useEffect, useRef, useState } from 'react';
import { apiWebSocketUrl } from '@/config/apiBase';
import { ErrorHandler } from '@/errors/errorHandler';
import * as terminalService from '@/services/terminalService';
import { type CreateTerminalBody, type TerminalEventMessage, type TerminalSize, type TerminalView, WS_CLOSE } from '@/types/terminal';

const REFRESH_ON_RETURN_MS = 5000;
/** Só a rede: o estado das sessões chega pelo WebSocket de eventos (ADR 0038). */
const REFRESH_EVERY_MS = 60_000;
const EVENTS_RECONNECT_MS = [1000, 2000, 5000, 10_000, 30_000];

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

  // O estado das sessões na hora (ADR 0038): cada mensagem muda só activity/agents de um terminal já na lista (um
  // que ela não tem chega na releitura seguinte). Ao religar relê a lista — pode ter perdido eventos. 4401 → não
  // religa (o AuthContext leva ao /login).
  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let timer: number | undefined;
    let failures = 0;
    let opened = false;
    const connect = () => {
      const ws = new WebSocket(apiWebSocketUrl('/terminals/events/ws'));
      socket = ws;
      ws.onopen = () => {
        if (opened) refresh();
        opened = true;
        failures = 0;
      };
      ws.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        let message: TerminalEventMessage;
        try {
          message = JSON.parse(event.data) as TerminalEventMessage;
        } catch {
          return;
        }
        if (message.type !== 'terminal') return;
        setTerminals((list) =>
          list.map((t) => (t.id === message.id ? { ...t, activity: message.activity, agents: message.agents } : t)),
        );
      };
      ws.onclose = (event) => {
        if (disposed || socket !== ws || event.code === WS_CLOSE.sessionEnded) return;
        socket = null;
        const delay = EVENTS_RECONNECT_MS[Math.min(failures++, EVENTS_RECONNECT_MS.length - 1)];
        timer = window.setTimeout(() => !disposed && connect(), delay);
      };
    };
    connect();
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      socket?.close();
    };
  }, [refresh]);

  // O bot de Telegram abre e para terminais sem esta página saber (ADR 0017). Voltar à janela não chega — com a
  // janela do PC sempre focada enquanto se usa o telemóvel não há evento nenhum (visto a 2026-10-22) —, por isso
  // relê também de REFRESH_EVERY_MS em REFRESH_EVERY_MS enquanto a página está visível (a rede do ADR 0038).
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

  const reopen = useCallback(async (id: string, size: TerminalSize, accountId?: string) => {
    const { freshSession, ...view } = await terminalService.reopenTerminal(id, size, accountId);
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

  /** Liga a pré-visualização; com várias portas devolve-as para escolher (nada muda até lá). */
  const startPreview = useCallback(async (id: string, devPort?: number) => {
    const result = await terminalService.startPreview(id, devPort);
    if ('preview' in result) setTerminals((list) => list.map((t) => (t.id === id ? { ...t, preview: result.preview } : t)));
    return result;
  }, []);

  const stopPreview = useCallback(async (id: string) => {
    await terminalService.stopPreview(id);
    setTerminals((list) => list.map((t) => (t.id === id ? { ...t, preview: null } : t)));
  }, []);

  /** O processo terminou (mensagem exit do WebSocket): muda o estado sem esperar pela lista. */
  const markExited = useCallback((id: string, exitCode: number) => {
    setTerminals((list) => list.map((t) => (t.id === id ? { ...t, status: 'exited', exitCode } : t)));
  }, []);

  return { terminals, loading, error, refresh, create, reopen, rename, close, markExited, startPreview, stopPreview };
}
