import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ErrorHandler } from '@/errors/errorHandler';
import { useUsage } from '@/hooks/useUsage';
import { getAccounts, setActiveAccount } from '@/services/accountService';
import type { AccountsView } from '@/types/account';
import { AccountsContext } from './accountsContextValue';

const POLL_MS = 60_000;

/**
 * As contas do Claude (ADR 0027), para o cabeçalho, o drawer e a lateral dos terminais. Vive dentro do
 * `UsageProvider` porque a quota que este lê é a da conta ativa: quando a ativa muda, seja por que via for
 * (o drawer, a remoção da ativa, outro separador), a quota é relida logo.
 */
export function AccountsProvider({ children }: { children: ReactNode }) {
  const { refresh: refreshUsage } = useUsage();
  const [view, setView] = useState<AccountsView | null>(null);
  const activeId = useRef<string | null>(null);
  // Uma leitura que saiu antes de uma mudança não pode repor o estado antigo quando chega depois dela.
  const latestRead = useRef(0);

  const apply = useCallback(
    (next: AccountsView) => {
      const changed = activeId.current !== null && activeId.current !== next.activeAccountId;
      activeId.current = next.activeAccountId;
      setView(next);
      if (changed) refreshUsage();
    },
    [refreshUsage],
  );

  const refresh = useCallback(async () => {
    const read = ++latestRead.current;
    const next = await getAccounts();
    if (read === latestRead.current) apply(next);
  }, [apply]);

  const setActive = useCallback(
    async (accountId: string) => {
      const next = await setActiveAccount(accountId);
      latestRead.current += 1;
      apply(next);
    },
    [apply],
  );

  useEffect(() => {
    const poll = () => {
      refresh().catch((e: unknown) => ErrorHandler.handle(e, { showNotification: false }));
    };
    poll();
    const timer = window.setInterval(poll, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const active = view?.accounts.find((account) => account.id === view.activeAccountId) ?? null;

  return <AccountsContext value={{ view, active, refresh, setActive }}>{children}</AccountsContext>;
}
