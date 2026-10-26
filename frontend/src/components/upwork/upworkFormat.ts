import type { ApplicationStatus, PackageVerdict } from '@/types/upwork';

/** Pela ordem do percurso de uma candidatura (spec upwork §2) — também a ordem do filtro. */
export const APPLICATION_STATUSES: ApplicationStatus[] = ['draft', 'sent', 'interview', 'offer', 'won', 'lost', 'withdrawn'];

/** Classe da tag (index.css): forma + cor, nunca só cor. */
export const STATUS_TAG: Record<ApplicationStatus, { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'tag' },
  sent: { label: 'Enviada', className: 'tag-run' },
  interview: { label: 'Entrevista', className: 'tag-wait' },
  offer: { label: 'Oferta', className: 'tag-wait' },
  won: { label: 'Ganha', className: 'tag-ok' },
  lost: { label: 'Perdida', className: 'tag-err' },
  withdrawn: { label: 'Retirada', className: 'tag-stop' },
};

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "26 out · 21:40", na hora local — o histórico e o "atualizado" do pacote. */
export function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const time = date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  return `${date.getDate()} ${MONTHS[date.getMonth()]} · ${time}`;
}

export const VERDICT_TAG: Record<PackageVerdict, { label: string; className: string }> = {
  apply: { label: 'Candidatar', className: 'tag-ok' },
  maybe: { label: 'Talvez', className: 'tag-mid' },
  skip: { label: 'Não', className: 'tag-draft' },
};
