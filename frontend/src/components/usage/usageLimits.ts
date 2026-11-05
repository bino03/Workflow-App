import type { UsageView, UsageWindow } from '@/types/usage';

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const hhmm = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/** "repõe às 14:30" (hoje) · "repõe segunda, 09:00". */
export function resetText(resetsAt: string, now: number): string {
  const date = new Date(resetsAt);
  const today = new Date(now);
  return date.toDateString() === today.toDateString() ? `repõe às ${hhmm(date)}` : `repõe ${WEEKDAYS[date.getDay()]}, ${hhmm(date)}`;
}

const WARN_PCT = 80;
/** Mais velho do que isto, o valor passa a cinzento com "há X min": sem atividade não há atualizações. */
const STALE_MS = 10 * 60_000;

function agoText(fetchedAt: string, now: number): string {
  const minutes = Math.max(1, Math.round((now - Date.parse(fetchedAt)) / 60_000));
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 24 * 60) return `há ${Math.round(minutes / 60)} h`;
  const days = Math.floor(minutes / (24 * 60));
  return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}

export type QuotaCell = { label: string; short: string; window: UsageWindow | null; pct: number | null; warn: boolean };

export type QuotaReading = {
  /** A status line ainda não viu nenhuma resposta desta conta. */
  empty: boolean;
  /** Preenchido só quando o valor já é velho: "há 2 h". */
  staleAgo: string | null;
  cells: QuotaCell[];
};

/** O que os medidores da quota mostram: a lateral (`QuotaMeter`) e cada conta no drawer (`AccountQuota`). */
export function readQuota(usage: UsageView | null, now: number): QuotaReading {
  const fetchedAt = usage?.fetchedAt ?? null;
  const stale = fetchedAt !== null && now - Date.parse(fetchedAt) > STALE_MS;
  const rows = [
    { label: 'Janela de 5 h', short: '5 h', window: usage?.fiveHour ?? null },
    { label: 'Semanal', short: 'Semana', window: usage?.weekly ?? null },
  ];
  const cells = rows.map((row) => {
    // Depois da hora de reposição, o valor guardado já não diz nada: "—".
    const expired = row.window !== null && Date.parse(row.window.resetsAt) <= now;
    const window = expired ? null : row.window;
    const pct = window ? Math.round(window.usedPct) : null;
    return { ...row, window, pct, warn: pct !== null && pct >= WARN_PCT && !stale };
  });
  return { empty: fetchedAt === null, staleAgo: stale && fetchedAt ? agoText(fetchedAt, now) : null, cells };
}

export type LimitWarningKey = 'fiveHour100' | 'fiveHour90' | 'weekly90';

type LimitRule = { key: LimitWarningKey; field: 'fiveHour' | 'weekly'; threshold: number; label: string };

/** Por ordem de urgência: com vários por ver, aparece o primeiro. */
const RULES: LimitRule[] = [
  { key: 'fiveHour100', field: 'fiveHour', threshold: 100, label: 'janela de 5 h' },
  { key: 'fiveHour90', field: 'fiveHour', threshold: 90, label: 'janela de 5 h' },
  { key: 'weekly90', field: 'weekly', threshold: 90, label: 'limite semanal' },
];

/** O `resetsAt` da janela em que cada aviso já levou OK. */
export type AcknowledgedWarnings = Partial<Record<LimitWarningKey, string>>;

export type LimitWarning = LimitRule & { window: UsageWindow };

/**
 * O aviso a mostrar agora, ou `null`. Uma janela já reposta não avisa. Um OK vale até à hora de reposição
 * que tinha quando foi dado — o `resetsAt` pode oscilar uns segundos entre leituras, por isso não se compara
 * por igualdade.
 */
export function pendingWarning(usage: UsageView | null, acknowledged: AcknowledgedWarnings, now: number): LimitWarning | null {
  for (const rule of RULES) {
    const window = usage?.[rule.field] ?? null;
    if (!window || Date.parse(window.resetsAt) <= now || window.usedPct < rule.threshold) continue;
    const acknowledgedUntil = acknowledged[rule.key];
    if (acknowledgedUntil && Date.parse(acknowledgedUntil) > now) continue;
    return { ...rule, window };
  }
  return null;
}

/** O OK cobre também os avisos mais baixos da mesma janela: depois do de 100%, o de 90% já não faz sentido. */
export function acknowledge(acknowledged: AcknowledgedWarnings, warning: LimitWarning): AcknowledgedWarnings {
  const next = { ...acknowledged };
  for (const rule of RULES) {
    if (rule.field === warning.field && rule.threshold <= warning.threshold) next[rule.key] = warning.window.resetsAt;
  }
  return next;
}
