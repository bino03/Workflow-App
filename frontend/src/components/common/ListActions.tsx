import { Button, type ButtonProps } from 'antd';
import type { ReactNode } from 'react';

/** Coluna de ações de uma tabela — tables-and-lists.md §1. */
export function ListActions({ children }: { children: ReactNode }) {
  return (
    // Uma linha clicável não pode navegar quando se carrega numa ação.
    <div className="flex flex-col items-start gap-1" onClick={(event) => event.stopPropagation()}>
      {children}
    </div>
  );
}

type ListActionProps = Omit<ButtonProps, 'type' | 'size' | 'danger'>;

const ACTION_WIDTH = { minWidth: 110 };

export function ListActionPrimary({ style, ...props }: ListActionProps) {
  return <Button size="small" style={{ ...ACTION_WIDTH, ...style }} {...props} />;
}

export function ListActionSecondary({ style, ...props }: ListActionProps) {
  return <Button type="text" size="small" style={{ ...ACTION_WIDTH, ...style }} {...props} />;
}

export function ListActionDanger({ style, ...props }: ListActionProps) {
  return (
    <Button
      type="text"
      size="small"
      style={{ ...ACTION_WIDTH, opacity: 0.75, color: 'var(--wfa-color-accent)', ...style }}
      {...props}
    />
  );
}
