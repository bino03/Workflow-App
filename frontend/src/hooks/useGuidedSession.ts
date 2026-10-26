import { isAxiosError } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorHandler } from '@/errors/errorHandler';
import { getGuided, getGuidedFeed } from '@/services/guidedService';
import type { FeedEntry, GuidedView } from '@/types/guided';

/** A spec (§4.4) pede 1,5 s: o bastante para uma pergunta aparecer "logo", sem SSE. */
const POLL_MS = 1500;

/** `done`/`failed`/`stopped` não mudam sem uma ação do dono — não há nada a perguntar. */
export const isLiveStatus = (view: GuidedView | null) => view !== null && !['done', 'failed', 'stopped'].includes(view.status);

/** O feed chega por páginas: a última entrada que o cliente tinha volta (pode ter mudado) e as novas vêm atrás. */
export function mergeFeed(current: FeedEntry[], page: FeedEntry[]): FeedEntry[] {
  return [...current.slice(0, Math.max(0, current.length - 1)), ...page];
}

/**
 * Uma sessão guiada (ADR 0020): a vista e a conversa, com polling enquanto está viva e o separador visível
 * (`document.visibilityState`). `gone` = a sessão deixou de existir (cancelada noutro sítio, GUIDED_001).
 * Uma sessão por montagem: para outra, quem usa monta de novo (`key={id}`).
 */
export function useGuidedSession(id: string | null) {
  const [view, setView] = useState<GuidedView | null>(null);
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [gone, setGone] = useState(false);
  const [tick, setTick] = useState(0);
  const entriesRef = useRef<FeedEntry[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      if (document.visibilityState === 'hidden') return; // retoma no visibilitychange
      try {
        const [next, page] = await Promise.all([getGuided(id), getGuidedFeed(id, entriesRef.current.length)]);
        if (cancelled) return;
        entriesRef.current = mergeFeed(entriesRef.current, page.entries);
        setEntries(entriesRef.current);
        setView(next);
        if (isLiveStatus(next)) timer = setTimeout(load, POLL_MS);
      } catch (e: unknown) {
        if (cancelled) return;
        if (isAxiosError(e) && e.response?.data?.errorCode === 'GUIDED_001') {
          ErrorHandler.handle(e, { showNotification: false });
          setGone(true);
          return;
        }
        // Uma falha de rede passageira: o próximo tick tenta outra vez, sem notificar a cada 1,5 s.
        ErrorHandler.handle(e, { showNotification: false });
        timer = setTimeout(load, POLL_MS * 2);
      }
    };

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (timer) clearTimeout(timer);
      void load();
    };
    void load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [id, tick]);

  /** Depois de uma ação (responder, retomar…): lê já, e retoma o polling se a sessão voltou a estar viva. */
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  return { view, entries, gone, refresh };
}
