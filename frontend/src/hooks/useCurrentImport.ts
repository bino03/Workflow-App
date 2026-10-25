import { useCallback, useEffect, useState } from 'react';
import { ErrorHandler } from '@/errors/errorHandler';
import { getCurrentImport } from '@/services/importService';
import type { ImportView } from '@/types/imports';

/** Enquanto a skill corre (ou espera), pergunta-se o estado a este ritmo — nunca depois de pronta. */
const POLL_MS = 3000;
const isLive = (view: ImportView | null) => view?.status === 'running' || view?.status === 'needs-you';

/**
 * A importação aberta (ADR 0019), ou null. Faz polling de `GET /library/imports/current` só enquanto a
 * importação está `running` ou `needs-you`; `review`/`rejected`/`failed` não mudam sem uma ação do dono.
 */
export function useCurrentImport() {
  const [current, setCurrent] = useState<ImportView | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      getCurrentImport()
        .then((view) => {
          if (cancelled) return;
          setCurrent(view);
          if (isLive(view)) timer = setTimeout(load, POLL_MS);
        })
        .catch((e: unknown) => {
          // Silencioso: a faixa simplesmente não aparece; o próximo refresh tenta outra vez.
          ErrorHandler.handle(e, { showNotification: false });
        });
    };
    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [attempt]);

  /** Depois de uma ação (criar, aceitar, descartar), volta a ler — e retoma o polling se for o caso. */
  const refresh = useCallback(() => setAttempt((n) => n + 1), []);
  /** A resposta de uma ação já traz o estado novo (ou nenhum). */
  const replace = useCallback((view: ImportView | null) => {
    setCurrent(view);
    if (isLive(view)) setAttempt((n) => n + 1);
  }, []);

  return { current, refresh, replace };
}
