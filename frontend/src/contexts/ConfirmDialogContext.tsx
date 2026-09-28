import { Button, Modal } from 'antd';
import { useCallback, useState, type ReactNode } from 'react';
import { ErrorHandler } from '@/errors/errorHandler';
import { ConfirmDialogContext, type ConfirmOptions } from './confirmDialogContextValue';

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [running, setRunning] = useState(false);

  const close = () => {
    if (!running) setOptions(null);
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
        footer={[
          <Button key="cancel" onClick={close} disabled={running}>
            Cancelar
          </Button>,
          <Button
            key="confirm"
            type="primary"
            danger={options?.danger ?? true}
            loading={running}
            onClick={handleConfirm}
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
