import { useCallback, useEffect, useState } from 'react';
import { ErrorHandler } from '@/errors/errorHandler';
import * as appRunService from '@/services/appRunService';
import type { AppRunPhase, AppRunView } from '@/types/appRun';

/**
 * De quanto em quanto tempo se relê o estado: a transição tem de se ver depressa; parada, só para apanhar uma
 * mudança feita de fora (a skill acrescentada, o terminal revelado fechado na grelha). O backend atualiza o
 * estado no próprio GET (ADR 0030) — sem sondagem, "A arrancar…" nunca passava a "A correr".
 */
const POLL_MS: Record<AppRunPhase, number> = {
  starting: 2_000,
  stopping: 2_000,
  running: 5_000,
  failed: 10_000,
  idle: 10_000,
  unavailable: 30_000,
};

/**
 * Estado de Correr/Parar do projeto ativo (spec correr-a-app §4.4). Usar com `key={path}` — um projeto novo
 * começa do zero. As ações devolvem o estado novo e lançam o erro para o componente o mostrar.
 */
export function useAppRun(path: string) {
  const [view, setView] = useState<AppRunView | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    appRunService
      .getAppRun(path)
      .then((next) => {
        if (!cancelled) setView((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
      })
      // Uma releitura que falha (o backend a reiniciar) fica com o último estado; a seguinte tenta outra vez.
      .catch((e: unknown) => ErrorHandler.handle(e, { showNotification: false }));
    return () => {
      cancelled = true;
    };
  }, [path, attempt]);

  const phase = view?.phase ?? 'idle';
  useEffect(() => {
    const reread = () => document.visibilityState === 'visible' && setAttempt((n) => n + 1);
    // Um intervalo, não um timeout por resposta: com a janela escondida salta a vez sem parar a sondagem.
    const timer = window.setInterval(reread, POLL_MS[phase]);
    document.addEventListener('visibilitychange', reread);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', reread);
    };
  }, [phase]);

  const start = useCallback(async () => setView(await appRunService.startAppRun(path)), [path]);
  const stop = useCallback(async () => setView(await appRunService.stopAppRun(path)), [path]);
  const reveal = useCallback(async () => (await appRunService.revealAppRun(path)).terminalId, [path]);

  return { view, start, stop, reveal };
}
