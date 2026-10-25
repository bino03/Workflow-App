import type { ReactNode } from 'react';
import { Button } from 'antd';
import type { ImportKind, ImportStatus, ImportView } from '@/types/imports';

type ImportBannerProps = {
  view: ImportView;
  /** Uma ação a decorrer (revelar, cancelar…): os botões ficam desativados. */
  busy: boolean;
  onReveal: () => void;
  onReview: () => void;
  /** Cancelar (a correr) ou descartar (acabada) — no backend é a mesma operação; confirma quem chama. */
  onDiscard: () => void;
};

const KIND_NAME: Record<ImportKind, string> = { skill: 'skill', design: 'design', stack: 'stack', auto: 'importação' };

/** Cor e forma do estado (tokens-and-colors §3): o mesmo vocabulário dos terminais. */
const LOOK: Record<ImportStatus, string> = {
  running: 'is-work',
  'needs-you': 'is-wait',
  review: 'is-run',
  rejected: 'is-stop',
  failed: 'is-err',
};

function firstLine(markdown: string | undefined) {
  return (markdown ?? '').split(/\r?\n/).find((line) => line.trim())?.replace(/[*_`#]/g, '').trim() ?? '';
}

/**
 * A faixa da importação aberta no topo da Biblioteca (ADR 0019, spec §4.4): o estado e a ação que cabe a
 * cada um. Só existe enquanto há uma importação aberta (há no máximo uma).
 */
export function ImportBanner({ view, busy, onReveal, onReview, onDiscard }: ImportBannerProps) {
  const what = KIND_NAME[view.kind];
  const source = <span className="font-mono text-[12.5px] text-text-2 break-all">{view.sourceLabel}</span>;

  const content: Record<ImportStatus, { text: ReactNode; actions: ReactNode }> = {
    running: {
      text: (
        <>
          A importar {what} de {source}… a skill do Workflow está a trabalhar.
        </>
      ),
      actions: (
        <>
          <Button size="small" disabled={busy} onClick={onReveal}>
            Ver terminal
          </Button>
          <Button size="small" type="text" danger disabled={busy} onClick={onDiscard}>
            Cancelar
          </Button>
        </>
      ),
    },
    'needs-you': {
      text: <>A skill parou à tua espera — tem uma pergunta ou precisa de uma permissão.</>,
      actions: (
        <>
          <Button size="small" type="primary" disabled={busy} onClick={onReveal}>
            Ver terminal
          </Button>
          <Button size="small" type="text" danger disabled={busy} onClick={onDiscard}>
            Cancelar
          </Button>
        </>
      ),
    },
    review: {
      text: (
        <>
          Pronto a rever — {view.changedFiles} {view.changedFiles === 1 ? 'ficheiro mudou' : 'ficheiros mudaram'} no Workflow.
        </>
      ),
      actions: (
        <>
          <Button size="small" type="primary" disabled={busy} onClick={onReview}>
            Rever
          </Button>
          <Button size="small" type="text" danger disabled={busy} onClick={onDiscard}>
            Descartar
          </Button>
        </>
      ),
    },
    rejected: {
      text: <>A triagem não aceitou: {firstLine(view.result?.summary) || 'sem motivo escrito'}</>,
      actions: (
        <>
          <Button size="small" disabled={busy} onClick={onReview}>
            Ver porquê
          </Button>
          <Button size="small" type="text" disabled={busy} onClick={onDiscard}>
            Fechar
          </Button>
        </>
      ),
    },
    failed: {
      text: <>Falhou: {view.error ?? view.result?.error ?? 'sem detalhe'}</>,
      actions: (
        <>
          <Button size="small" disabled={busy} onClick={onReveal}>
            Ver terminal
          </Button>
          <Button size="small" type="text" danger disabled={busy} onClick={onDiscard}>
            Descartar
          </Button>
        </>
      ),
    },
  };

  const { text, actions } = content[view.status];
  return (
    <div className={`status-banner ${LOOK[view.status]} flex items-center gap-3 px-4 py-2.5`} role="status" aria-live="polite">
      <span className={`state-icon ${LOOK[view.status]}`} aria-hidden />
      <span className="flex-1 text-[13.5px] leading-[20px]">{text}</span>
      <span className="flex items-center gap-1.5">{actions}</span>
    </div>
  );
}
