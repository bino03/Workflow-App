import type { TerminalStatus, TerminalView } from '@/types/terminal';

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

/** "Terminado · código 1", "Parado" — o detalhe na lateral e no banner. */
export function statusDetail(terminal: TerminalView): string {
  if (terminal.status === 'exited') return terminal.exitCode === null ? 'terminou' : `código ${terminal.exitCode}`;
  if (terminal.status === 'stopped') return 'o backend reiniciou';
  return 'a correr';
}
