import { useEffect, useState } from 'react';
import { getUsage } from '@/services/usageService';
import type { UsageView } from '@/types/usage';

const POLL_MS = 60_000;

/**
 * A quota da subscrição, sondada a cada minuto. `now` avança com cada sondagem, para o "há X min" e para
 * saber se uma janela já repôs. Uma falha mantém o último valor (o indicador passa a velho sozinho).
 */
export function useUsage() {
  const [usage, setUsage] = useState<UsageView | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      getUsage()
        .then((next) => !cancelled && setUsage(next))
        .catch(() => {})
        .finally(() => !cancelled && setNow(Date.now()));
    };
    poll();
    const timer = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return { usage, now };
}
