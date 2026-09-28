import type { UsageView, UsageWindow } from '@/types/usage';

type QuotaMeterProps = { usage: UsageView | null; now: number; variant: 'sidebar' | 'header' };

const WARN_PCT = 80;
/** Mais velho do que isto, o valor passa a cinzento com "há X min" — sem atividade não há atualizações. */
const STALE_MS = 10 * 60_000;
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const hhmm = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/** "repõe às 14:30" (hoje) · "repõe segunda, 09:00". */
function resetText(resetsAt: string, now: number): string {
  const date = new Date(resetsAt);
  const today = new Date(now);
  return date.toDateString() === today.toDateString() ? `repõe às ${hhmm(date)}` : `repõe ${WEEKDAYS[date.getDay()]}, ${hhmm(date)}`;
}

function ago(fetchedAt: string, now: number): string {
  const minutes = Math.max(1, Math.round((now - Date.parse(fetchedAt)) / 60_000));
  return minutes < 60 ? `há ${minutes} min` : `há ${Math.round(minutes / 60)} h`;
}

type Row = { label: string; short: string; window: UsageWindow | null };

/**
 * Quota da conta (protótipo 1g lateral / 1i cabeçalho). Vem da status line dos terminais (ADR 0012): só se
 * atualiza quando algum terminal recebe uma resposta.
 */
export function QuotaMeter({ usage, now, variant }: QuotaMeterProps) {
  const rows: Row[] = [
    { label: 'Janela de 5 h', short: '5 h', window: usage?.fiveHour ?? null },
    { label: 'Semanal', short: 'Semana', window: usage?.weekly ?? null },
  ];
  const fetchedAt = usage?.fetchedAt ?? null;
  const stale = fetchedAt !== null && now - Date.parse(fetchedAt) > STALE_MS;

  const cells = rows.map((row) => {
    // Depois da hora de reposição, o valor guardado já não diz nada: "—".
    const expired = row.window !== null && Date.parse(row.window.resetsAt) <= now;
    const window = expired ? null : row.window;
    const pct = window ? Math.round(window.usedPct) : null;
    const warn = pct !== null && pct >= WARN_PCT && !stale;
    return { ...row, window, pct, warn };
  });

  if (variant === 'header') {
    return (
      <div className="flex items-center gap-6" data-quota="header" aria-label="Quota da conta">
        {cells.map((cell) => (
          <div key={cell.short} className="flex items-center gap-2.5 text-[12.5px]">
            <span className="text-text-2">{cell.short}</span>
            <div className="w-24 h-1 rounded-sm bg-surface-3 overflow-hidden">
              {cell.pct !== null && (
                <div className={`h-full ${cell.warn ? 'bg-warning' : 'bg-text-2'} ${stale ? 'opacity-40' : ''}`} style={{ width: `${cell.pct}%` }} />
              )}
            </div>
            <span className={`font-mono font-semibold ${cell.warn ? 'text-warning' : stale ? 'text-text-3' : 'text-text-1'}`}>
              {cell.pct === null ? '—' : `${cell.pct}%`}
            </span>
            {cell.window && <span className="text-text-3">{resetText(cell.window.resetsAt, now)}</span>}
          </div>
        ))}
        {stale && fetchedAt && <span className="text-[12px] text-text-3">{ago(fetchedAt, now)}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5" data-quota="sidebar" aria-label="Quota da conta">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-3">
        Quota da conta{stale && fetchedAt ? ` · ${ago(fetchedAt, now)}` : ''}
      </span>
      {fetchedAt === null ? (
        <span className="text-[12px] text-text-3">Aparece depois da primeira resposta num terminal.</span>
      ) : (
        cells.map((cell) => (
          <div key={cell.label} className="flex flex-col gap-1.5">
            <div className="flex justify-between items-baseline text-[13px]">
              <span>{cell.label}</span>
              <span className={`font-mono text-[12.5px] font-semibold ${cell.warn ? 'text-warning' : stale ? 'text-text-3' : 'text-text-1'}`}>
                {cell.pct === null ? '—' : `${cell.pct}%`}
              </span>
            </div>
            <div className="h-[5px] rounded-sm bg-surface-3 overflow-hidden">
              {cell.pct !== null && (
                <div className={`h-full ${cell.warn ? 'bg-warning' : 'bg-text-2'} ${stale ? 'opacity-40' : ''}`} style={{ width: `${cell.pct}%` }} />
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
