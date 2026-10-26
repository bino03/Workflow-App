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

export const VERDICT_TAG: Record<PackageVerdict, { label: string; className: string }> = {
  apply: { label: 'Candidatar', className: 'tag-ok' },
  maybe: { label: 'Talvez', className: 'tag-mid' },
  skip: { label: 'Não', className: 'tag-draft' },
};
