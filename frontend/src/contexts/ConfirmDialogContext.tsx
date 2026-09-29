import { Button, Modal } from 'antd';
import { useCallback, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ErrorHandler } from '@/errors/errorHandler';
import { ConfirmDialogContext, type ConfirmOptions } from './confirmDialogContextValue';

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [running, setRunning] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    if (!running) setOptions(null);
  };

  /** ← → trocam o botão em foco; Enter já ativa o botão focado (comportamento nativo). */
  const handleArrowKeys = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      cancelRef.current?.focus();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      confirmRef.current?.focus();
    }
  };

  const handleConfirm = async () => {
    if (!options) return;
    setRunning(true);
    try {
      await options.onConfirm();
      setOptions(null);
    } catch (error) {
      ErrorHandler.handle(error);
    } finally {
      setRunning(false);
    }
  };

  const confirm = useCallback((next: ConfirmOptions) => setOptions(next), []);

  return (
    <ConfirmDialogContext value={confirm}>
      {children}
      <Modal
        open={options !== null}
        width={440}
        title={options?.title ?? 'Confirmar eliminação'}
        onCancel={close}
        closable={!running}
        mask={{ closable: !running }}
        afterOpenChange={(open) => {
          if (open) cancelRef.current?.focus();
        }}
        footer={[
          <Button key="cancel" ref={cancelRef} onClick={close} disabled={running} onKeyDown={handleArrowKeys}>
            Cancelar
          </Button>,
          <Button
            key="confirm"
            ref={confirmRef}
            type="primary"
            danger={options?.danger ?? true}
            loading={running}
            onClick={handleConfirm}
            onKeyDown={handleArrowKeys}
          >
            {options?.actionLabel ?? 'Eliminar'}
          </Button>,
        ]}
      >
        <div className="text-text-2">{options?.message}</div>
      </Modal>
    </ConfirmDialogContext>
  );
}
