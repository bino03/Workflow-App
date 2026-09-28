import { useEffect, useState } from 'react';
import { getHealth } from '@/services/healthService';

const POLL_INTERVAL_MS = 15_000;

export type BackendHealth = 'checking' | 'online' | 'offline';

/** Estado da ligação ao backend para a barra de estado. Falhar aqui não notifica: a barra é o aviso. */
export function useBackendHealth(): BackendHealth {
  const [health, setHealth] = useState<BackendHealth>('checking');

  useEffect(() => {
    let cancelled = false;
    const check = () =>
      getHealth()
        .then((online) => !cancelled && setHealth(online ? 'online' : 'offline'))
        .catch(() => !cancelled && setHealth('offline'));

    void check();
    const timer = window.setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return health;
}
