import { Button } from 'antd';

type PermissionCardProps = {
  tool: string;
  /** O comando, ou o caminho — nunca o conteúdo a escrever (o hook não o guarda). */
  summary: string;
  busy: boolean;
  onDecide: (decision: 'allow' | 'deny') => void;
};

/**
 * Um pedido de permissão do Claude (spec §4.4): a ferramenta e o que vai correr ou escrever, com **Permitir**
 * (primário) e **Recusar**. Tem o aspeto "à tua espera" (losango, âmbar): é o dono que falta.
 */
export function PermissionCard({ tool, summary, busy, onDecide }: PermissionCardProps) {
  return (
    <section className="status-banner is-wait p-4 flex flex-col gap-3" aria-label="Pedido de permissão">
      <div className="flex items-center gap-2">
        <span className="state-icon is-wait" aria-hidden />
        <span className="text-[14px] leading-[20px] font-semibold">O Claude pede permissão</span>
        <span className="tag font-mono">{tool}</span>
      </div>
      <div className="code-line">{summary}</div>
      <div className="flex justify-end gap-2">
        <Button disabled={busy} onClick={() => onDecide('deny')}>
          Recusar
        </Button>
        <Button type="primary" loading={busy} onClick={() => onDecide('allow')}>
          Permitir
        </Button>
      </div>
    </section>
  );
}
