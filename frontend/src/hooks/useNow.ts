import { useEffect, useState } from 'react';

/** O relógio da UI: `Date.now()` a cada `intervalMs` enquanto `active`; parado (sem timer) quando não há nada a contar. */
export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    // Acerta logo ao ativar: o último valor pode ser de há muito (o hook ficou parado).
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(first);
    };
  }, [active, intervalMs]);
  return now;
}
