import { Tooltip } from 'antd';
import { readQuota, resetText, shortResetText } from '@/components/usage/usageLimits';
import { useAccounts } from '@/hooks/useAccounts';
import { useUsage } from '@/hooks/useUsage';

const SHORT_LABEL: Record<string, string> = { 'Janela de 5 h': '5h', Semanal: 'sem' };

/**
 * A quota da conta ativa na barra de título, antes do utilizador (proposta C do canvas, ADR 0036):
 * `5h 42% ↻14:30 · sem 81% ↻seg`, em mono. Vem da status line dos terminais (ADR 0012), por isso só se atualiza
 * quando algum terminal recebe uma resposta. Um valor velho fica a cinzento e o tooltip diz há quanto tempo.
 */
export function TitleBarQuota() {
  const { usage, now } = useUsage();
  const { view, active } = useAccounts();
  const { empty, staleAgo, cells } = readQuota(usage, now);
  const accountLabel = (view?.accounts.length ?? 0) > 1 ? active?.label : undefined;

  const detail = empty
    ? 'A quota aparece depois da primeira resposta num terminal.'
    : [
        ...cells.map((cell) => `${cell.label}: ${cell.pct === null ? '—' : `${cell.pct}%`} · ${cell.window ? resetText(cell.window.resetsAt, now) : 'já repôs'}`),
        ...(staleAgo ? [`Lida ${staleAgo}`] : []),
      ].join('\n');

  return (
    <Tooltip title={<span className="whitespace-pre-line">{detail}</span>} placement="bottomRight" mouseEnterDelay={0.3}>
      <div
        className="flex items-center gap-3 px-3 border-l border-border font-mono text-[11px] text-text-3 cursor-default"
        data-quota="titlebar"
        aria-label="Quota da conta"
      >
        {accountLabel && (
          <span className="max-w-[120px] truncate font-sans text-[12px] text-text-2" data-quota-account>
            {accountLabel}
          </span>
        )}
        {empty ? (
          <span>quota —</span>
        ) : (
          cells.map((cell) => (
            <span key={cell.label} className="whitespace-nowrap">
              {SHORT_LABEL[cell.label] ?? cell.short}{' '}
              <span className={cell.warn ? 'text-warning' : staleAgo ? 'text-text-3' : 'text-text-1'}>{cell.pct === null ? '—' : `${cell.pct}%`}</span>
              {cell.window && <span className="text-[var(--wfa-neutral-600)]"> ↻{shortResetText(cell.window.resetsAt, now)}</span>}
            </span>
          ))
        )}
      </div>
    </Tooltip>
  );
}
