import type { ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import { CONTROL_HEIGHT } from '@/theme';
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
 * correr-a-app §4.4), para que trocar de modo não mexa no layout. Uma linha de `--wfa-header-height`, como o
 * `PageHeader` dos outros ecrãs (ADR 0036, fase 3).
 */
export function TerminalsHeader({ terminals, children }: TerminalsHeaderProps) {
  const counts = (Object.keys(COUNT_LABELS) as TerminalStatus[])
    .map((status) => ({ status, n: terminals.filter((t) => t.status === status).length }))
    .filter(({ n }) => n > 0);

  return (
    <div
      className="h-[var(--wfa-header-height)] flex-none flex items-center gap-3 px-[var(--wfa-page-gutter)] bg-surface-1 border-b border-border"
      data-terminals-header
    >
      <span className="kicker flex-none">Terminais</span>
      <span className="flex-none text-[13px] leading-[18px] font-semibold text-text-1">{terminals.length} abertos</span>
      <div className="flex gap-3 text-[12.5px] text-text-2">
        {counts.map(({ status, n }) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className={`state-icon ${STATUS_META[status].icon}`} aria-hidden />
            {n} {COUNT_LABELS[status]}
          </span>
        ))}
      </div>
      <div className="flex-1" />
      <ConfigProvider theme={{ token: { controlHeight: CONTROL_HEIGHT } }}>
        <div className="flex-none flex items-center gap-2">{children}</div>
      </ConfigProvider>
    </div>
  );
}
