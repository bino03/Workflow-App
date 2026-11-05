import type { ReactElement } from 'react';
import { Dropdown, type MenuProps } from 'antd';
import { ErrorHandler } from '@/errors/errorHandler';
import { useAccounts } from '@/hooks/useAccounts';

type TerminalContextMenuProps = {
  menu: MenuProps;
  /** A editar o nome, o botão direito é o do browser: colar no campo. */
  disabled?: boolean;
  /** O terminal na lateral, ou o cabeçalho dele: o botão direito (ou a tecla de menu) sobre ele abre o menu. */
  children: ReactElement;
};

/**
 * Menu de contexto de um terminal. Nunca envolve a área de texto: aí o botão direito continua a ser o do browser, para
 * copiar e colar.
 */
export function TerminalContextMenu({ menu, disabled = false, children }: TerminalContextMenuProps) {
  const { refresh } = useAccounts();
  return (
    <Dropdown
      trigger={['contextMenu']}
      disabled={disabled}
      menu={menu}
      // A sondagem é de 60 s: quem acabou de fazer o login não pode encontrar a conta ainda desativada.
      onOpenChange={(open) => {
        if (open) refresh().catch((e: unknown) => ErrorHandler.handle(e, { showNotification: false }));
      }}
    >
      {children}
    </Dropdown>
  );
}
