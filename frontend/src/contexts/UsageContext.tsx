import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { getUsage } from '@/services/usageService';
import type { UsageView } from '@/types/usage';
import { UsageContext } from './usageContextValue';

const POLL_MS = 60_000;

/**
 * A quota da conta ativa, sondada a cada minuto num só sítio: a lateral dos terminais e o aviso de limite
 * (em qualquer página) leem a mesma sondagem. Uma falha mantém o último valor (o indicador passa a velho sozinho).
 */
export function UsageProvider({ children }: { children: ReactNode }) {
  const [usage, setUsage] = useState<UsageView | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Depois de mudar de conta, uma leitura que saiu antes não pode repor a quota da conta anterior.
  const latestRead = useRef(0);

  const refresh = useCallback(() => {
    const read = ++latestRead.current;
    getUsage()
      .then((next) => {
        if (read === latestRead.current) setUsage(next);
      })
      .catch(() => {})
      .finally(() => {
        if (read === latestRead.current) setNow(Date.now());
      });
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    return () => {
      latestRead.current += 1;
      window.clearInterval(timer);
    };
  }, [refresh]);

  return <UsageContext value={{ usage, now, refresh }}>{children}</UsageContext>;
}
