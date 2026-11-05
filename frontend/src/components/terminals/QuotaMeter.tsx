import { readQuota, resetText } from '@/components/usage/usageLimits';
import type { UsageView } from '@/types/usage';

type QuotaMeterProps = {
  usage: UsageView | null;
  now: number;
  /** O nome da conta ativa, só quando há mais do que uma. */
  accountLabel?: string;
};

/**
 * Quota da conta ativa, na lateral (protótipo 1g). Vem da status line dos terminais (ADR 0012): só se atualiza
 * quando algum terminal recebe uma resposta.
 */
export function QuotaMeter({ usage, now, accountLabel }: QuotaMeterProps) {
  const { empty, staleAgo, cells } = readQuota(usage, now);

  return (
    <div className="flex flex-col gap-3.5" data-quota="sidebar" aria-label="Quota da conta">
      <div className="flex flex-col gap-1">
        {accountLabel && (
          <span className="text-[13px] font-medium text-text-1 truncate" data-quota-account>
            {accountLabel}
          </span>
        )}
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-3">
          Quota da conta{staleAgo ? ` · ${staleAgo}` : ''}
        </span>
      </div>
      {empty ? (
        <span className="text-[12px] text-text-3">Aparece depois da primeira resposta num terminal.</span>
      ) : (
        cells.map((cell) => (
          <div key={cell.label} className="flex flex-col gap-1.5">
            <div className="flex justify-between items-baseline text-[13px]">
              <span>{cell.label}</span>
              <span className={`font-mono text-[12.5px] font-semibold ${cell.warn ? 'text-warning' : staleAgo ? 'text-text-3' : 'text-text-1'}`}>
                {cell.pct === null ? '—' : `${cell.pct}%`}
              </span>
            </div>
            <div className="h-[5px] rounded-sm bg-surface-3 overflow-hidden">
              {cell.pct !== null && (
                <div className={`h-full ${cell.warn ? 'bg-warning' : 'bg-text-2'} ${staleAgo ? 'opacity-40' : ''}`} style={{ width: `${cell.pct}%` }} />
              )}
            </div>
            <div className="flex justify-between text-[12px] text-text-3">
              <span>{cell.window ? resetText(cell.window.resetsAt, now) : 'já repôs'}</span>
              {cell.warn && <span className="text-warning">▲ Perto do limite</span>}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
