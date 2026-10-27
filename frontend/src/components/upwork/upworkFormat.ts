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

/**
 * O passo seguinte do percurso, para o menu de contexto da lista. Só o menu se limita a isto: o separador Dados continua
 * livre (ADR 0022 — o estado é o que o dono diz, e um engano tem volta).
 */
export const NEXT_STATUS: Partial<Record<ApplicationStatus, ApplicationStatus>> = {
  draft: 'sent',
  sent: 'interview',
  interview: 'offer',
  offer: 'won',
};

/** Saídas a meio do percurso. Um rascunho nunca chegou ao cliente: pode ser retirado, não perdido. */
export const EXIT_STATUSES: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  draft: ['withdrawn'],
  sent: ['lost', 'withdrawn'],
  interview: ['lost', 'withdrawn'],
  offer: ['lost', 'withdrawn'],
};

/** O que muda ao marcar cada estado — a mensagem da confirmação. */
export const STATUS_EFFECT: Record<ApplicationStatus, string> = {
  draft: 'Volta a rascunho.',
  sent: 'A sessão do Claude entra em pausa. Quando o cliente responder, cola a mensagem na Conversa e ela retoma. Os Connects gastos registam-se em Dados.',
  interview: 'Só muda o estado: a conversa continua onde estava.',
  offer: 'Só muda o estado: a conversa continua onde estava.',
  won: 'A seguir podes criar o projeto: botão direito → Novo projeto.',
  lost: 'Fica pronta a arquivar. Se foi engano, corriges no separador Dados.',
  withdrawn: 'Fica pronta a arquivar. Se foi engano, corriges no separador Dados.',
};

/** Arquivar fecha a sessão: só quando a candidatura acabou (spec upwork §2). */
export function canArchive(application: { status: ApplicationStatus; projectPath: string | null }) {
  return ['lost', 'withdrawn'].includes(application.status) || (application.status === 'won' && application.projectPath !== null);
}

const MONTHS =['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

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
