import type { UsageView, UsageWindow } from '@/types/usage';

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const hhmm = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/** "repõe às 14:30" (hoje) · "repõe segunda, 09:00". */
export function resetText(resetsAt: string, now: number): string {
  const date = new Date(resetsAt);
  const today = new Date(now);
  return date.toDateString() === today.toDateString() ? `repõe às ${hhmm(date)}` : `repõe ${WEEKDAYS[date.getDay()]}, ${hhmm(date)}`;
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
