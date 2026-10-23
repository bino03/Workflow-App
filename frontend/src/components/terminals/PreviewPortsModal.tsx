import { Button, Modal } from 'antd';
import type { DevPort } from '@/types/terminal';

type PreviewPortsModalProps = {
  /** O nome do terminal — o modal está aberto enquanto há portas para escolher. */
  name: string;
  ports: DevPort[] | null;
  /** A porta a ligar neste momento (spinner nessa linha, as outras bloqueadas). */
  starting: number | null;
  onPick: (port: number) => void;
  onClose: () => void;
};

/**
 * Seletor (drawers-and-modals → Modals): o terminal tem mais do que uma porta à escuta (um Vite e uma API, por
 * exemplo) e o dono escolhe qual vai para o link — um clique liga.
 */
export function PreviewPortsModal({ name, ports, starting, onPick, onClose }: PreviewPortsModalProps) {
  return (
    <Modal
      open={ports !== null}
      onCancel={onClose}
      width="min(520px, 94vw)"
      title={
        <>
          Pré-visualizar — <span className="font-mono">{name}</span>
        </>
      }
      footer={
        <div className="flex justify-end">
          <Button onClick={onClose}>Cancelar</Button>
        </div>
      }
    >
      <p className="m-0 mb-3 text-[13px] text-text-2">
        Há várias portas à escuta neste terminal. Qual vai para o link? Normalmente é a do frontend (a página que se abre
        no browser).
      </p>
      <div className="border border-border rounded-md overflow-hidden max-h-[360px] overflow-y-auto" role="listbox" aria-label="Portas à escuta">
        {ports?.map((port) => (
          <button
            key={port.port}
            type="button"
            role="option"
            aria-selected={starting === port.port}
            disabled={starting !== null}
            data-dev-port={port.port}
            onClick={() => onPick(port.port)}
            className="w-full text-left flex items-center gap-3 px-3 py-2.5 border-0 border-b border-border last:border-b-0 cursor-pointer bg-transparent hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="font-mono text-[14px] text-text-1">{port.port}</span>
            <span className="flex-1 min-w-0 text-[13px] text-text-3 truncate">{port.process}</span>
            {starting === port.port && <span className="text-[12px] text-text-3">a ligar…</span>}
          </button>
        ))}
      </div>
    </Modal>
  );
}
