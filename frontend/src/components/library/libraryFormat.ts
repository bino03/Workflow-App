import type { LibraryKind, Maturity } from '@/types/library';

/** Classe da tag (index.css) e do glifo do chip — forma + cor, nunca só cor. */
export const MATURITY_CLASS: Record<Maturity, { tag: string; glyph: string }> = {
  proven: { tag: 'tag-ok', glyph: 'is-ok' },
  partial: { tag: 'tag-mid', glyph: 'is-mid' },
  draft: { tag: 'tag-draft', glyph: 'is-draft' },
};

/** Os três chips agrupam os vocabulários de cada tipo (ver `maturityOf` no backend). */
export const MATURITY_LABEL: Record<Maturity, { singular: string; plural: string }> = {
  proven: { singular: 'Provado', plural: 'provados' },
  partial: { singular: 'Parcial', plural: 'parciais' },
  draft: { singular: 'Rascunho', plural: 'rascunhos' },
};

export const KIND_LABEL: Record<LibraryKind, { tab: string; kicker: string; plural: string }> = {
  stacks: { tab: 'Stacks', kicker: 'Stack', plural: 'stacks' },
  themes: { tab: 'Designs', kicker: 'Design', plural: 'designs' },
  skills: { tab: 'Skills', kicker: 'Skill', plural: 'skills' },
};

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Os manifestos escrevem `updated: 2026-09-12`; outro formato mostra-se como está.
function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year: match[1], month: MONTHS[month - 1], day: match[3] };
}

/** "12 set" — coluna Atualizado. */
export function formatShortDate(value: string | null) {
  if (!value) return '—';
  const date = parseIsoDate(value);
  return date ? `${date.day} ${date.month}` : value;
}

/** "12 set 2026" — detalhe. */
export function formatLongDate(value: string | null) {
  if (!value) return '—';
  const date = parseIsoDate(value);
  return date ? `${date.day} ${date.month} ${date.year}` : value;
}
