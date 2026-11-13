import type { ReactNode } from 'react';
import type { TerminalStatus, TerminalView } from '@/types/terminal';
import { STATUS_META } from './terminalDisplay';

type TerminalsHeaderProps = {
  /** Os terminais do projeto ativo. */
  terminals: TerminalView[];
  /** Controlos à direita (o `AppRunControl`, o `GridStylePicker` só na grelha), pela ordem em que aparecem. */
  children?: ReactNode;
};

const COUNT_LABELS: Record<TerminalStatus, string> = { running: 'a correr', exited: 'terminados', stopped: 'parados' };

/**
 * "Terminais · N abertos" + contagens por estado — o mesmo cabeçalho na grelha e no foco dividido (spec
 * correr-a-app §4.4), para que trocar de modo não mexa no layout.
 */
export function TerminalsHeader({ terminals, children }: TerminalsHeaderProps) {
  const counts = (Object.keys(COUNT_LABELS) as TerminalStatus[])
    .map((status) => ({ status, n: terminals.filter((t) => t.status === status).length }))
    .filter(({ n }) => n > 0);

  return (
    <div className="h-16 flex-none flex items-center gap-5 px-5" data-terminals-header>
      <div className="flex flex-col gap-0.5">
        <span className="kicker">Terminais</span>
        <span className="text-[20px] leading-[26px] font-semibold">{terminals.length} abertos</span>
      </div>
      <div className="flex gap-4 text-[13px] text-text-2 pt-4">
        {counts.map(({ status, n }) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className={`state-icon ${STATUS_META[status].icon}`} aria-hidden />
            {n} {COUNT_LABELS[status]}
          </span>
        ))}
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}
