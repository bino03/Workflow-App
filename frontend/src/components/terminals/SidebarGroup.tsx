import { useState, type ReactNode } from 'react';
import { RightOutlined } from '@ant-design/icons';

/**
 * Um grupo recolhível da lateral dos Terminais (proposta C do ADR 0036): cabeçalho de 24 px com ▸, título em caixa
 * alta e a contagem; aberto por omissão. Recolher não se guarda: é só para arrumar a vista do momento.
 */
export function SidebarGroup({ title, count, children, id }: { title: string; count: number; children: ReactNode; id: string }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="flex flex-col px-1 pb-1.5" data-sidebar-group={id}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="h-6 flex items-center gap-1 px-2 bg-transparent border-0 cursor-pointer text-[11px] font-semibold tracking-[.08em] text-text-3 hover:text-text-1"
      >
        <RightOutlined className={`text-[9px] transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="flex-1 text-left">{title}</span>
        <span className="font-mono font-normal">{count}</span>
      </button>
      {open && <div className="flex flex-col gap-px">{children}</div>}
    </section>
  );
}

/** Uma linha de 26 px de um grupo: marca à esquerda, nome, e a meta em mono à direita. */
export const SIDEBAR_ROW =
  'h-[var(--wfa-row-height)] w-full flex items-center gap-2 pl-[22px] pr-2 rounded-sm border-0 text-left text-[12.5px] text-text-1';
