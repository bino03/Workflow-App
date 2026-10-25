import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ErrorHandler } from '@/errors/errorHandler';
import { useConfirm } from '@/hooks/useConfirm';
import { notificationService } from '@/services/general/notificationService';
import { acceptImport, cancelImport, discardImport, revealImportTerminal } from '@/services/importService';
import type { ImportView } from '@/types/imports';
import { ImportBanner } from './ImportBanner';
import { ImportReviewDrawer } from './ImportReviewDrawer';

type ImportPanelProps = {
  current: ImportView | null;
  /** A importação mudou ou acabou: o estado novo (null = já não há nenhuma). */
  onChanged: (view: ImportView | null) => void;
  /** Algo entrou na biblioteca (aceite): a lista tem de ser lida outra vez. */
  onLibraryChanged: () => void;
};

/**
 * Tudo o que acontece a uma importação aberta (ADR 0019), por cima das tabs da Biblioteca: a faixa de estado,
 * "Ver terminal" (o terminal escondido passa à grelha), a revisão do diff, aceitar (commit no Workflow) e
 * descartar/cancelar (repõe o Workflow). Sem importação aberta não mostra nada.
 */
export function ImportPanel({ current, onChanged, onLibraryChanged }: ImportPanelProps) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState<'reveal' | 'accept' | 'discard' | null>(null);

  if (!current) return null;
  const running = current.status === 'running' || current.status === 'needs-you';

  const reveal = async () => {
    setBusy('reveal');
    try {
      const terminal = await revealImportTerminal(current.id);
      void navigate('/terminals', { state: { focusTerminalId: terminal.id } });
    } catch (e) {
      ErrorHandler.handle(e);
    } finally {
      setBusy(null);
    }
  };

  const accept = async () => {
    setBusy('accept');
    try {
      const { commit } = await acceptImport(current.id);
      notificationService.success('Importado', `Commit ${commit.slice(0, 7)} no Workflow.`);
      setReviewing(false);
      onChanged(null);
      onLibraryChanged();
    } catch (e) {
      // Um commit recusado (o pre-commit do Workflow) deixa a importação em revisão: o dono vê porquê.
      ErrorHandler.handle(e);
    } finally {
      setBusy(null);
    }
  };

  // Descartar e cancelar fazem o mesmo no backend; o texto da confirmação é que muda.
  const discard = () =>
    confirm({
      title: running ? 'Cancelar a importação?' : current.status === 'rejected' ? 'Fechar a importação?' : 'Descartar a importação?',
      actionLabel: running ? 'Cancelar importação' : current.status === 'rejected' ? 'Fechar' : 'Descartar',
      danger: current.status !== 'rejected',
      message: running
        ? 'O terminal da importação fecha e o que a skill já escreveu no Workflow é reposto como estava.'
        : 'O Workflow volta a ficar como antes da importação — os ficheiros novos são apagados e os alterados repostos.',
      onConfirm: async () => {
        setBusy('discard');
        try {
          await (running ? cancelImport(current.id) : discardImport(current.id));
          setReviewing(false);
          onChanged(null);
        } catch (e) {
          ErrorHandler.handle(e);
        } finally {
          setBusy(null);
        }
      },
    });

  return (
    <>
      <ImportBanner
        view={current}
        busy={busy !== null}
        onReveal={() => void reveal()}
        onReview={() => setReviewing(true)}
        onDiscard={discard}
      />
      <ImportReviewDrawer
        view={reviewing ? current : null}
        busy={busy === 'accept' || busy === 'discard' ? busy : null}
        onClose={() => setReviewing(false)}
        onAccept={() => void accept()}
        onDiscard={discard}
      />
    </>
  );
}
