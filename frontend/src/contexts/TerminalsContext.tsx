import { useMemo, useState, type ReactNode } from 'react';
import { useTerminals } from '@/hooks/useTerminals';
import { TerminalsContext, type TerminalsSight } from './terminalsContextValue';

/**
 * A lista de terminais, uma só (e uma só releitura de 10 em 10 s), no `AppLayout`: a página dos Terminais e o
 * losango "Terminais" da navegação leem a mesma. A página diz também o que está à vista (`sight`), para o
 * losango acender só pelo que não se vê.
 */
export function TerminalsProvider({ children }: { children: ReactNode }) {
  const terminals = useTerminals();
  const [sight, setSight] = useState<TerminalsSight | null>(null);
  const value = useMemo(() => ({ ...terminals, sight, setSight }), [terminals, sight]);
  return <TerminalsContext value={value}>{children}</TerminalsContext>;
}
