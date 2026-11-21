import { useState, type ReactNode } from 'react';
import { StatusBarContext } from './statusBarContextValue';

/**
 * O que a página atual põe na barra de estado (proposta C do ADR 0036): nos Terminais, "Teclado em <terminal>" e as
 * dicas de atalhos. O resto da barra (o backend e a versão) é do `AppLayout`.
 */
export function StatusBarProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode>(null);
  return <StatusBarContext value={{ content, setContent }}>{children}</StatusBarContext>;
}
