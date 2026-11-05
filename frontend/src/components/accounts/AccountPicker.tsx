import type { KeyboardEvent, ReactElement } from 'react';
import { Dropdown, type DropdownProps, type MenuProps } from 'antd';
import { ErrorHandler } from '@/errors/errorHandler';
import { useAccounts } from '@/hooks/useAccounts';
import { accountMenuItems } from './accountLabel';

type AccountPickerProps = {
  /** A conta que não faz sentido escolher. Por omissão, a ativa. */
  excludeId?: string;
  /** Título por cima das contas. */
  title?: string;
  placement?: DropdownProps['placement'];
  onPick: (accountId: string) => void;
  /** O botão que abre a lista. */
  children: ReactElement;
};

/** A lista das outras contas, para abrir um terminal numa delas. Com uma só conta não aparece. */
export function AccountPicker({ excludeId, title, placement, onPick, children }: AccountPickerProps) {
  const { view, refresh } = useAccounts();
  if (!view || view.accounts.length < 2) return null;

  const accounts: MenuProps['items'] = accountMenuItems(view, excludeId ?? view.activeAccountId);

  // Os eventos do React atravessam o portal do menu: sem isto, escolher uma conta também ativava o cabeçalho do projeto
  // na lateral, que num projeto vazio abre um terminal. Só Enter e Espaço: o Esc tem de chegar à window, onde o menu o lê.
  const stopActivation = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
  };

  return (
    <span className="inline-flex" onClick={(event) => event.stopPropagation()} onKeyDown={stopActivation}>
      <Dropdown
        trigger={['click']}
        placement={placement}
        menu={{
          items: title ? [{ type: 'group', label: title, children: accounts }] : accounts,
          onClick: ({ key }) => onPick(key),
        }}
        // A sondagem é de 60 s: quem acabou de fazer o login não pode encontrar a conta ainda desativada.
        onOpenChange={(open) => {
          if (open) refresh().catch((e: unknown) => ErrorHandler.handle(e, { showNotification: false }));
        }}
      >
        {children}
      </Dropdown>
    </span>
  );
}
