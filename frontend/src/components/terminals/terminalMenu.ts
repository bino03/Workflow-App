import type { MenuProps } from 'antd';
import { accountMenuItems } from '@/components/accounts/accountLabel';
import type { AccountsView } from '@/types/account';
import type { TerminalView } from '@/types/terminal';

type MenuItems = NonNullable<MenuProps['items']>;

/** O que o menu faz à vista do terminal depende do modo e do que está no ecrã: é a página que o sabe. */
export type TerminalViewAction = { label: string; disabled?: boolean };

const CONTINUE_PREFIX = 'continue:';

export type TerminalMenuAction = { type: 'reopen' | 'rename' | 'view' | 'preview' | 'close' } | { type: 'continue'; accountId: string };

export function parseTerminalMenuKey(key: string): TerminalMenuAction {
  if (key.startsWith(CONTINUE_PREFIX)) return { type: 'continue', accountId: key.slice(CONTINUE_PREFIX.length) };
  return { type: key as 'reopen' | 'rename' | 'view' | 'preview' | 'close' };
}

/** As ações de um terminal, conforme o estado dele. "Fechar" fica sempre em último, separado, por ser a perigosa. */
export function terminalMenuItems(terminal: TerminalView, viewAction: TerminalViewAction, accounts: AccountsView | null): MenuItems {
  const running = terminal.status === 'running';
  const otherAccounts = accounts ? accountMenuItems(accounts, terminal.accountId, CONTINUE_PREFIX) : [];
  const groups: MenuItems[] = [
    running
      ? []
      : [
          { key: 'reopen', label: 'Reabrir' },
          ...(otherAccounts.length > 0 ? [{ key: 'continue', label: 'Continuar noutra conta', children: otherAccounts }] : []),
        ],
    [
      { key: 'rename', label: 'Renomear' },
      { key: 'view', label: viewAction.label, disabled: viewAction.disabled },
    ],
    running ? [{ key: 'preview', label: terminal.preview ? 'Desligar a pré-visualização' : 'Pré-visualizar' }] : [],
    [{ key: 'close', label: 'Fechar', danger: true }],
  ];

  // Uma linha entre grupos, nunca no início, no fim ou duas seguidas.
  return groups.filter((group) => group.length > 0).flatMap((group, index) => (index === 0 ? group : [{ type: 'divider' as const }, ...group]));
}
