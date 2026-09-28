import { createContext, type ReactNode } from 'react';

export type ConfirmOptions = {
  message: ReactNode;
  /** Por omissão "Confirmar eliminação" — numa ação que não elimina, passar sempre. */
  title?: string;
  /** Por omissão "Eliminar" — o rótulo é a ação real ("Fechar terminal", "Sair"). */
  actionLabel?: string;
  /** Botão de confirmação vermelho. Por omissão true; false numa ação não destrutiva. */
  danger?: boolean;
  /** Pode ser assíncrono: o botão fica em loading e o diálogo só fecha no fim. */
  onConfirm: () => void | Promise<void>;
};

export type ConfirmFn = (options: ConfirmOptions) => void;

export const ConfirmDialogContext = createContext<ConfirmFn | null>(null);
