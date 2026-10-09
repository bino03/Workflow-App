import { useCallback, useEffect, useState } from 'react';
import { ErrorHandler } from '@/errors/errorHandler';
import { listPasskeys } from '@/services/passkeyService';
import type { PasskeySummary } from '@/types/auth';

/** As passkeys registadas (secção das Definições, ADR 0015). `null` enquanto carrega. */
export function usePasskeys() {
  const [passkeys, setPasskeys] = useState<PasskeySummary[] | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listPasskeys()
      .then((list) => !cancelled && setPasskeys(list))
      .catch((e: unknown) => {
        ErrorHandler.handle(e);
        if (!cancelled) setPasskeys([]);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const refresh = useCallback(() => setAttempt((current) => current + 1), []);

  return { passkeys, refresh };
}
