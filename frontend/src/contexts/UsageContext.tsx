import { useEffect, useState, type ReactNode } from 'react';
import { getUsage } from '@/services/usageService';
import type { UsageView } from '@/types/usage';
import { UsageContext } from './usageContextValue';

const POLL_MS = 60_000;

/**
 * A quota da subscrição, sondada a cada minuto num só sítio: a lateral dos terminais e o aviso de limite
 * (em qualquer página) leem a mesma sondagem. Uma falha mantém o último valor (o indicador passa a velho sozinho).
 */
export function UsageProvider({ children }: { children: ReactNode }) {
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

  return <UsageContext value={{ usage, now }}>{children}</UsageContext>;
}
