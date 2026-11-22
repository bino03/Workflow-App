import { use, useEffect, useMemo } from 'react';
import { TerminalsContext, type TerminalsContextValue, type TerminalsSight } from '@/contexts/terminalsContextValue';

/** A lista de terminais do `AppLayout` (ver `TerminalsProvider`). */
export function useSharedTerminals(): TerminalsContextValue {
  const value = use(TerminalsContext);
  if (!value) throw new Error('useSharedTerminals fora do TerminalsProvider');
  return value;
}

/** A página dos Terminais publica o que tem à vista; ao sair, nada fica à vista. */
export function usePublishSight(activePath: string | null, visibleIds: string[]): void {
  const { setSight } = useSharedTerminals();
  const key = visibleIds.join(',');
  const sight = useMemo<TerminalsSight>(() => ({ activePath, visibleIds: key ? key.split(',') : [] }), [activePath, key]);
  useEffect(() => {
    setSight(sight);
  }, [setSight, sight]);
  useEffect(() => () => setSight(null), [setSight]);
}
