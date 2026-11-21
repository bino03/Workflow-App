import { createContext, type ReactNode } from 'react';

export type StatusBarContextValue = {
  /** O que a página atual pôs na barra de estado. */
  content: ReactNode;
  setContent: (content: ReactNode) => void;
};

export const StatusBarContext = createContext<StatusBarContextValue | null>(null);
