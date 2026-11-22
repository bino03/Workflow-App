import { createContext } from 'react';
import type { useTerminals } from '@/hooks/useTerminals';

/** O que a página dos Terminais mostra neste momento: o projeto ativo e os terminais na grelha / em foco. */
export type TerminalsSight = { activePath: string | null; visibleIds: string[] };

export type TerminalsContextValue = ReturnType<typeof useTerminals> & {
  /** `null` fora da página dos Terminais: nada está à vista. */
  sight: TerminalsSight | null;
  setSight: (sight: TerminalsSight | null) => void;
};

export const TerminalsContext = createContext<TerminalsContextValue | null>(null);
