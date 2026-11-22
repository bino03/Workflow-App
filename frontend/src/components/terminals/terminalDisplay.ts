import type { TerminalActivity, TerminalAgent, TerminalStatus, TerminalView } from '@/types/terminal';

/** Estado → texto, forma e tag (tokens-and-colors §3: cor e forma, nunca só cor). */
export const STATUS_META: Record<TerminalStatus, { label: string; icon: string; tag: string }> = {
  running: { label: 'A correr', icon: 'is-run', tag: 'tag-run' },
  exited: { label: 'Terminado', icon: 'is-stop', tag: 'tag-stop' },
  stopped: { label: 'Parado', icon: 'is-stop', tag: 'tag-stop' },
};

/** O último segmento de um caminho Windows ou POSIX. */
export function folderName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "26 set · 18:42" — datas das sessões gravadas (protótipo 1j), na hora local. */
export function formatSessionDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]} · ${time}`;
}

/** A data curta das sessões na lateral (proposta C): "14:30" hoje · "ontem" · "18 nov". */
export function shortSessionDate(iso: string, now: number): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date(now);
  if (date.toDateString() === today.toDateString()) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'ontem';
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "Terminado · código 1", "Parado" — o detalhe na lateral e no banner. */
export function statusDetail(terminal: TerminalView): string {
  if (terminal.status === 'exited') return terminal.exitCode === null ? 'terminou' : `código ${terminal.exitCode}`;
  if (terminal.status === 'stopped') return 'sem processo';
  return 'a correr';
}

/** O estado de sessão do Claude (hooks, ADR 0031) → forma e texto. Os mesmos três da app inteira (tokens §3). */
export const ACTIVITY_META: Record<TerminalActivity, { label: string; icon: string }> = {
  working: { label: 'A trabalhar', icon: 'is-work' },
  'needs-you': { label: 'Precisa de ti', icon: 'is-wait' },
  waiting: { label: 'À tua espera', icon: 'is-idle' },
};

/**
 * O ícone de um terminal: a `activity` quando o claude a reporta, senão o `status` (terminais que não são do
 * Claude — "Correr a app", importações — e os que não correm têm `activity: null`).
 */
export function terminalStateMeta(terminal: Pick<TerminalView, 'status' | 'activity'>): { label: string; icon: string } {
  return terminal.activity ? ACTIVITY_META[terminal.activity] : STATUS_META[terminal.status];
}

/** Do mais para o menos urgente: precisa de ti > à tua espera > a trabalhar. */
const URGENCY: TerminalActivity[] = ['needs-you', 'waiting', 'working'];

const COUNT_TEXT: Record<TerminalActivity, (n: number) => string> = {
  'needs-you': (n) => (n === 1 ? '1 precisa de ti' : `${n} precisam de ti`),
  waiting: (n) => `${n} à tua espera`,
  working: (n) => `${n} a trabalhar`,
};

export type ActivitySummary = {
  /** O estado mais urgente. */
  activity: TerminalActivity;
  icon: string;
  /** "2 precisam de ti · 1 a trabalhar" — para o tooltip. */
  text: string;
};

/**
 * Resume várias sessões no estado mais urgente, com a contagem por estado. `null` se nenhuma tem `activity`
 * (nada a mostrar: quem chama fica com o que já mostrava). `only` limita os estados contados.
 */
export function summarizeActivity(terminals: Pick<TerminalView, 'activity'>[], only: TerminalActivity[] = URGENCY): ActivitySummary | null {
  const counts = URGENCY.filter((a) => only.includes(a)).map((activity) => ({
    activity,
    n: terminals.filter((t) => t.activity === activity).length,
  }));
  const present = counts.filter(({ n }) => n > 0);
  const top = present[0];
  if (!top) return null;
  return {
    activity: top.activity,
    icon: ACTIVITY_META[top.activity].icon,
    text: present.map(({ activity, n }) => COUNT_TEXT[activity](n)).join(' · '),
  };
}

/** Uma sessão que precisa do dono (precisa de ti, ou à tua espera) — o que acende a lista e a navegação. */
export function wantsAttention(terminal: Pick<TerminalView, 'activity'>): boolean {
  return terminal.activity === 'needs-you' || terminal.activity === 'waiting';
}

/** Só os agentes que ainda estão a correr (decisão do dono: os `done` não aparecem). Mantém a ordem do backend (mais antigo primeiro). */
export function runningAgents(terminal: Pick<TerminalView, 'agents'>): TerminalAgent[] {
  return terminal.agents.filter((agent) => agent.status === 'running');
}

/**
 * Há quanto tempo um agente corre, compacto: "40 s" · "3 min" · "1 h 5 min" (sem minutos: "2 h"). Trunca, nunca arredonda
 * para cima; um `startedAt` no futuro (relógios desalinhados) ou ilegível conta como "0 s".
 */
export function formatElapsed(startedAt: string, now: number): string {
  const started = Date.parse(startedAt);
  const seconds = Number.isNaN(started) ? 0 : Math.max(0, Math.floor((now - started) / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest === 0 ? `${Math.floor(minutes / 60)} h` : `${Math.floor(minutes / 60)} h ${rest} min`;
}

/**
 * O nome do modelo, curto: tira o prefixo `claude-` e o sufixo de data (`-20251001`) e deixa o resto tal como vem —
 * "claude-sonnet-5-5" → "sonnet-5-5", "claude-haiku-4-5-20251001" → "haiku-4-5", "haiku" → "haiku". Sem tabela de
 * modelos para manter: um modelo novo aparece legível sem tocar aqui.
 */
export function shortModel(model: string): string {
  return model.replace(/^claude-/, '').replace(/-\d{8}$/, '');
}

/** O texto principal de um agente: a descrição, ou o tipo quando não há descrição, ou "Agente" quando não há nenhum dos dois. */
export function agentTitle(agent: Pick<TerminalAgent, 'description' | 'type'>): string {
  return agent.description ?? agent.type ?? 'Agente';
}

/** "Explore · sonnet-5-5" — o tipo e o modelo que existirem (tooltip da sublinha da lateral). */
export function agentKind(agent: Pick<TerminalAgent, 'type' | 'model'>): string {
  return [agent.type, agent.model ? shortModel(agent.model) : null].filter(Boolean).join(' · ');
}
