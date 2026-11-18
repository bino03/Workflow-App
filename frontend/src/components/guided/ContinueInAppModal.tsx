import { Button, Modal } from 'antd';
import type { GuidedDisplay } from '@/types/guided';

type ContinueInAppModalProps = {
  open: boolean;
  /** O nome com que a sessão aparece no Claude app — `/remote-control <nome>`, escrito pelo backend. */
  sessionName: string;
  busy: boolean;
  onCancel: () => void;
  onChoose: (display: GuidedDisplay) => void;
};

/**
 * "Continuar no Claude app" (ADR 0033): o que muda e a escolha do dono para esta página. Não há volta atrás nesta
 * versão (só um Retomar, depois de a sessão parar, a traz de volta para aqui).
 */
export function ContinueInAppModal({ open, sessionName, busy, onCancel, onChoose }: ContinueInAppModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onCancel}
      width="min(520px, 94vw)"
      title="Continuar no Claude app"
      footer={
        <div className="flex items-center gap-2">
          <Button disabled={busy} onClick={onCancel}>
            Cancelar
          </Button>
          <span className="flex-1" />
          <Button disabled={busy} onClick={() => onChoose('open')}>
            Manter aberto
          </Button>
          <Button type="primary" loading={busy} onClick={() => onChoose('hidden')}>
            Esconder aqui
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 text-[13.5px] leading-[21px] text-text-2">
        <p className="m-0">
          A sessão passa a aparecer no Claude app como <span className="font-mono text-text-1">{sessionName}</span>. As escolhas e as
          permissões passam a ser respondidas lá; o modo Automático continua a valer.
        </p>
        <p className="m-0">
          <span className="text-text-1">Esconder aqui</span> tira a conversa desta página (fica um aviso de que o terminal continua a correr em
          fundo). <span className="text-text-1">Manter aberto</span> deixa-a à vista, e o que escreveres aqui ou no app vai para a mesma
          sessão. Podes trocar depois.
        </p>
        <p className="m-0 text-text-3 text-[12.5px]">Não dá para desligar a meio. Se a sessão parar, Retomar traz as perguntas de volta para aqui.</p>
      </div>
    </Modal>
  );
}
