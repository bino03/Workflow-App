import { useEffect, useState } from 'react';
import { Alert, Button, Modal, Spin } from 'antd';
import { ErrorHandler } from '@/errors/errorHandler';
import { getSessions } from '@/services/sessionService';
import type { SavedSession } from '@/types/session';
import { folderName, formatSessionDate } from '../terminalDisplay';

type ResumeSessionModalProps = {
  /** `null` = fechado. O caminho já é conhecido (clicou "Retomar" nesse projeto) — nada de escolher pasta. */
  path: string | null;
  onClose: () => void;
  /** Cria o terminal a retomar essa sessão. Lança o erro para ser mostrado aqui, sem fechar o modal. */
  onResume: (sessionId: string) => Promise<void>;
};

/** O que a sessão mostra na lista: o rótulo e o resumo do terminal fechado, senão o preview do Claude Code. */
function sessionText(session: SavedSession): string {
  const detail = session.closed?.summary ?? session.preview;
  const label = session.closed?.label;
  if (label) return detail ? `${label} — ${detail}` : label;
  return detail ?? '(sem mensagens)';
}

/**
 * Modal dedicado a retomar uma sessão gravada de um projeto (pedido do dono, 2026-09-29: o
 * `NewTerminalDrawer` partilhado trazia o navegador de pastas, "Sessão nova"/"Continuar a última" e o
 * nome do terminal — bloat, já que este fluxo só tem um entry point (o ícone "Retomar" de um projeto já
 * escolhido na lateral) e nunca precisou de nada disso. Só a lista de sessões gravadas + retomar.
 */
export function ResumeSessionModal({ path, onClose, onResume }: ResumeSessionModalProps) {
  const [sessions, setSessions] = useState<SavedSession[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // A pasta muda (ou o modal fecha): o cleanup do efeito anterior repõe o estado antes do próximo pedido —
  // nunca um setState direto no corpo do efeito (o React Compiler deste projeto avisa disso).
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    getSessions(path)
      .then((list) => !cancelled && setSessions(list))
      .catch((e: unknown) => {
        ErrorHandler.handle(e, { showNotification: false });
        if (!cancelled) setSessions([]);
      });
    return () => {
      cancelled = true;
      setSessions(null);
      setSelected(null);
      setSubmitError(null);
    };
  }, [path]);

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onResume(selected);
      onClose();
    } catch (e) {
      ErrorHandler.handle(e, { showNotification: false });
      setSubmitError(ErrorHandler.getMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={path !== null}
      onCancel={onClose}
      width="min(640px, 94vw)"
      title={
        <>
          Retomar sessão — <span className="font-mono">{path ? folderName(path) : ''}</span>
        </>
      }
      footer={
        <div className="flex flex-col gap-2">
          {submitError && <Alert type="error" showIcon title={submitError} />}
          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>Cancelar</Button>
            <Button type="primary" disabled={!selected} loading={submitting} onClick={() => void submit()}>
              Retomar sessão
            </Button>
          </div>
        </div>
      }
    >
      {sessions === null && (
        <div className="py-6 flex justify-center">
          <Spin />
        </div>
      )}
      {sessions?.length === 0 && <p className="m-0 py-4 text-[13px] text-text-3">Nenhuma sessão gravada nesta pasta.</p>}
      {sessions && sessions.length > 0 && (
        <div
          className="border border-border rounded-md overflow-hidden max-h-[420px] overflow-y-auto"
          role="listbox"
          aria-label="Sessões gravadas"
        >
          {sessions.map((session) => {
            const isSelected = session.id === selected;
            const busy = session.openIn !== null;
            return (
              <button
                key={session.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={busy}
                data-session-id={session.id}
                onClick={() => setSelected(session.id)}
                className={`w-full text-left flex flex-col gap-0.5 px-3 py-2.5 border-0 border-b border-border last:border-b-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                  isSelected ? 'bg-surface-3 shadow-[inset_0_0_0_1px_var(--wfa-color-accent-border)]' : 'bg-transparent hover:bg-surface-2'
                }`}
              >
                <span className="flex justify-between text-[12px] text-text-3">
                  <span className="font-mono">{formatSessionDate(session.updatedAt)}</span>
                  <span>{busy ? 'aberta noutro terminal' : `${session.messageCount} mensagens`}</span>
                </span>
                <span className="text-[13px] text-text-1 whitespace-nowrap overflow-hidden text-ellipsis">{sessionText(session)}</span>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
