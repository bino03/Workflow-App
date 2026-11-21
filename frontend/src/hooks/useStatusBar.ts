import { use, useEffect, type ReactNode } from 'react';
import { StatusBarContext } from '@/contexts/statusBarContextValue';

export function useStatusBarContent(): ReactNode {
  return use(StatusBarContext)?.content ?? null;
}

/** Põe `content` na barra de estado enquanto a página está montada; ao sair, a barra fica limpa. */
export function useStatusBar(content: ReactNode): void {
  const setContent = use(StatusBarContext)?.setContent;
  useEffect(() => {
    setContent?.(content);
  }, [setContent, content]);
  useEffect(() => () => setContent?.(null), [setContent]);
}
