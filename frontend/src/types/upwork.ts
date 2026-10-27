import type { GuidedView } from '@/types/guided';

/**
 * Secção Upwork (ADR 0022, spec docs/features/upwork.md §4) — espelho de `backend/src/upwork/upwork.schemas.ts`.
 * Mudam juntos.
 */

export type ApplicationStatus = 'draft' | 'sent' | 'interview' | 'offer' | 'won' | 'lost' | 'withdrawn';

export type PackageVerdict = 'apply' | 'maybe' | 'skip';

/** O pacote que o `/upwork-proposal` escreveu; cada parte é o Markdown cru, ou null se o ficheiro falta. */
export type PackageView = {
  title: string;
  language: string;
  verdict: PackageVerdict;
  updatedAt: string;
  analysis: string | null;
  coverLetter: string | null;
  screening: string | null;
  plan: string | null;
  clientQuestions: string | null;
};

export type ApplicationView = {
  id: string;
  title: string;
  /** Só um link para o dono abrir — a app nunca o abre. */
  url: string | null;
  clientName: string | null;
  status: ApplicationStatus;
  history: { status: ApplicationStatus; at: string }[];
  connectsSpent: number | null;
  notes: string;
  guidedId: string | null;
  agreement: string | null;
  creationGuidedId: string | null;
  projectPath: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  guided: GuidedView | null;
  package: PackageView | null;
  /** Porque é que o pacote não se leu (um `package.json` inválido). */
  packageError: string | null;
  attachments: AttachmentsView | null;
  /** Porque é que o `attachments.json` não se leu. */
  attachmentsError: string | null;
};

/** Os prints que o `/upwork-proposal` escolheu do portfólio (`attachments.json`, ADR 0024). */
export type AttachmentsView = {
  updatedAt: string;
  /** false = sem `PORTFOLIO_PATH` no backend: a lista aparece, as imagens não. */
  portfolioConfigured: boolean;
  items: { project: string; slug: string; file: string; uploadName: string; caption: string; available: boolean }[];
  /** Projetos citados na carta sem prints no catálogo do portfólio. */
  missing: string[];
};

/** `updatedAt: null` = ainda não há perfil; o `markdown` é então o modelo inicial. */
export type ProfileView = { markdown: string; updatedAt: string | null };

export type NewApplication = { job: string; screeningQuestions: string[]; url?: string | null };

export type ApplicationChanges = Partial<{
  status: ApplicationStatus;
  clientName: string | null;
  connectsSpent: number | null;
  notes: string;
  url: string | null;
}>;
