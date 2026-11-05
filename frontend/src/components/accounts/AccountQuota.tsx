import { readQuota, resetText } from '@/components/usage/usageLimits';
import type { UsageView } from '@/types/usage';

type AccountQuotaProps = { usage: UsageView; now: number };

/** A quota de uma conta no drawer: duas barras finas lado a lado, para caberem cinco contas sem scroll longo. */
export function AccountQuota({ usage, now }: AccountQuotaProps) {
  const { empty, staleAgo, cells } = readQuota(usage, now);

  if (empty) return <span className="text-[12px] text-text-3">Quota: aparece depois da primeira resposta.</span>;

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-2 gap-3" data-account-quota>
        {cells.map((cell) => (
          <div key={cell.label} className="flex flex-col gap-1 min-w-0">
            <div className="flex justify-between items-baseline text-[12px] text-text-2">
              <span>{cell.short}</span>
              <span className={`font-mono font-semibold ${cell.warn ? 'text-warning' : staleAgo ? 'text-text-3' : 'text-text-1'}`}>
                {cell.pct === null ? '—' : `${cell.pct}%`}
              </span>
            </div>
            <div className="h-[3px] rounded-sm bg-surface-3 overflow-hidden">
              {cell.pct !== null && (
                <div className={`h-full ${cell.warn ? 'bg-warning' : 'bg-text-2'} ${staleAgo ? 'opacity-40' : ''}`} style={{ width: `${cell.pct}%` }} />
              )}
            </div>
            <span className="text-[11.5px] text-text-3 truncate">{cell.window ? resetText(cell.window.resetsAt, now) : 'já repôs'}</span>
          </div>
        ))}
      </div>
      {staleAgo && <span className="text-[11.5px] text-text-3">Atualizada {staleAgo}</span>}
    </div>
  );
}
