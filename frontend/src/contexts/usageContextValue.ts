import { createContext } from 'react';
import type { UsageView } from '@/types/usage';

export type UsageContextValue = {
  /** `null` até à primeira resposta. */
  usage: UsageView | null;
  /** Avança com cada sondagem — para o "há X min" e para saber se uma janela já repôs. */
  now: number;
};

export const UsageContext = createContext<UsageContextValue | null>(null);
