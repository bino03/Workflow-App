import type { ReactNode } from 'react';
import { DownOutlined } from '@ant-design/icons';
import { ConfigProvider } from 'antd';
import { CONTROL_HEIGHT } from '@/theme';
import type { TerminalStatus, TerminalView } from '@/types/terminal';
import { StateIcon } from './StateIcon';
import { STATUS_META, summarizeActivity } from './terminalDisplay';

type TerminalsHeaderProps = {
  /** Os terminais do projeto ativo. */
  terminals: TerminalView[];
  /** O nome do projeto ativo (o mesmo da lateral), ou `null` sem projeto: aí o botão do nome não aparece. */
  projectName?: string | null;
  /** Abre o seletor de projeto (o mesmo do atalho `projectSwitch` e do nome na lateral). */
  onOpenSwitcher?: () => void;
  switcherOpen?: boolean;
  /** A combinação do `projectSwitch` ("Alt+B"), ou `null` sem bind. */
  switcherHint?: string | null;
  /** Controlos à direita (o `AppRunControl`, o `GridStylePicker` só na grelha), pela ordem em que aparecem. */
  children?: ReactNode;
};

const COUNT_LABELS: Record<TerminalStatus, string> = { running: 'a correr', exited: 'terminados', stopped: 'parados' };

/**
 * [nome do projeto ▾] · "Terminais · N abertos" + contagens por estado — o mesmo cabeçalho na grelha e no foco dividido (spec
 * correr-a-app §4.4), para que trocar de modo não mexa no layout. Uma linha de `--wfa-header-height`, como o
 * `PageHeader` dos outros ecrãs (ADR 0036, fase 3).
 */
export function TerminalsHeader({ terminals, projectName, onOpenSwitcher, switcherOpen = false, switcherHint = null, children }: TerminalsHeaderProps) {
  const counts = (Object.keys(COUNT_LABELS) as TerminalStatus[])
    .map((status) => ({ status, n: terminals.filter((t) => t.status === status).length }))
    .filter(({ n }) => n > 0);
  const activity = summarizeActivity(terminals);
  const switchLabel = `Mudar de projeto${switcherHint ? ` (${switcherHint})` : ''}`;

  return (
    <div
      className="h-[var(--wfa-header-height)] flex-none flex items-center gap-3 px-[var(--wfa-page-gutter)] bg-surface-1 border-b border-border"
      data-terminals-header
    >
      {projectName && onOpenSwitcher && (
        <>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={switcherOpen}
            aria-label={switchLabel}
            title={switchLabel}
            data-header-project
            onClick={onOpenSwitcher}
            className="min-w-0 max-w-[260px] flex items-center gap-1.5 p-0 bg-transparent border-0 cursor-pointer text-left text-text-1"
          >
            {activity && <StateIcon icon={activity.icon} title={activity.text} />}
            <span className="truncate text-[13px] leading-[18px] font-semibold">{projectName}</span>
            <DownOutlined className="flex-none text-text-2 text-[10px]" />
          </button>
          <span className="flex-none text-text-3" aria-hidden>
            ·
          </span>
        </>
      )}
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
