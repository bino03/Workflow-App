import { useState } from 'react';
import { Button, Input, Tooltip } from 'antd';
import { z } from 'zod';
import type { TerminalView as TerminalInfo } from '@/types/terminal';
import { STATUS_META, statusDetail } from './terminalDisplay';
import { TerminalView } from './TerminalView';

// Espelha o labelSchema do backend (terminal.schemas.ts): ≤ 80, letras, dígitos, espaço e . _ - ( ).
const labelSchema = z
  .string()
  .trim()
  .max(80, 'No máximo 80 caracteres.')
  .regex(/^[\p{L}\p{N} ._\-()]*$/u, 'Só letras, números, espaços e . _ - ( )');

/** Monta de novo a cada vez que entra em edição (o pai troca-a por `renaming`) — o rascunho arranca sempre
 * do nome atual, sem precisar de um efeito a repor estado. */
function RenameInput({ initialName, onFinish }: { initialName: string; onFinish: (label: string | null | undefined) => void }) {
  const [draft, setDraft] = useState(initialName);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const parsed = labelSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Nome inválido.');
      return;
    }
    // Vazio = voltar ao nome da pasta.
    onFinish(parsed.data === '' ? null : parsed.data);
  };

  return (
    <Input
      size="small"
      autoFocus
      className="max-w-[240px]"
      value={draft}
      status={error ? 'error' : undefined}
      title={error ?? undefined}
      aria-label="Nome do terminal"
      placeholder="Nome da pasta"
      onChange={(event) => {
        setDraft(event.target.value);
        setError(null);
      }}
      onFocus={(event) => event.target.select()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') submit();
        if (event.key === 'Escape') onFinish(undefined);
        event.stopPropagation();
      }}
      onBlur={() => onFinish(undefined)}
    />
  );
}

type TerminalPaneProps = {
  terminal: TerminalInfo;
  /** Nome mostrado (o rótulo, ou a pasta numerada — projects.ts). */
  name: string;
  visible: boolean;
  focused: boolean;
  renaming: boolean;
  reopening: boolean;
  /** Zoom só deste terminal (Alt+=/Alt+-/Alt+0) — nunca a página toda. */
  fontDelta: number;
  onActivate: () => void;
  /** Duplo clique num mosaico da grelha: amplia (ver docs/features/terminais.md, decisão de zoom por clique). */
  onEnlarge?: () => void;
  onRenameEnd: (label: string | null | undefined) => void;
  onReopen: () => void;
  onExit: (code: number) => void;
  onGone: () => void;
  /** tile = mosaico da grelha (protótipo 1i): cabeçalho compacto, sem ações até ser ampliado. */
  variant?: 'pane' | 'tile';
  enlarged?: boolean;
};

/** Um terminal no ecrã: cabeçalho (protótipo 1g/1h), o xterm.js, e o banner de terminado/parado. Sem
 * botões de ação no cabeçalho — Renomear/Dividir/Fechar/Voltar à grelha são só `Alt+R`/`Alt+\`/`Alt+W`/`Esc`
 * (2026-09-29: o dono já sabe os atalhos, o cabeçalho fica limpo). */
export function TerminalPane(props: TerminalPaneProps) {
  const { terminal, visible, focused, renaming, reopening, variant = 'pane', enlarged = false } = props;
  const tile = variant === 'tile';
  const compactHeader = tile && !enlarged;
  const meta = STATUS_META[terminal.status];
  const { name } = props;

  return (
    <section
      className={`flex-1 min-w-0 min-h-0 flex flex-col bg-bg ${visible ? '' : 'hidden'} ${
        tile ? `rounded-lg overflow-hidden border ${focused ? 'border-accent' : 'border-border'}` : ''
      }`}
      data-terminal-pane={terminal.id}
      onMouseDown={props.onActivate}
      onDoubleClick={compactHeader ? props.onEnlarge : undefined}
    >
      <header
        className={`${compactHeader ? 'h-10 pl-3 pr-3' : 'h-11 pl-4 pr-3'} flex-none flex items-center gap-2.5 border-b border-border min-w-0 ${
          focused && !compactHeader ? 'bg-surface-2' : 'bg-surface-1'
        }`}
      >
        <span className={`state-icon ${meta.icon}`} aria-hidden />
        {renaming ? (
          <RenameInput initialName={name} onFinish={props.onRenameEnd} />
        ) : (
          <Tooltip title={terminal.cwd} mouseEnterDelay={0.4}>
            <span className="font-semibold text-[14px] whitespace-nowrap">{name}</span>
          </Tooltip>
        )}
        {!compactHeader && <span className={meta.tag}>{meta.label}</span>}
        <div className="flex-1 min-w-0" />
        {compactHeader && <span className={meta.tag}>{meta.label}</span>}
      </header>

      {terminal.status === 'stopped' ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
          <span className="state-icon is-stop" aria-hidden />
          <p className="m-0 text-text-1 font-semibold">Terminal parado</p>
          <p className="m-0 text-text-2 text-[13px] max-w-[420px]">
            O backend reiniciou e o processo terminou. A conversa está gravada — reabrir retoma-a onde ficou.
          </p>
          <Button type="primary" loading={reopening} onClick={props.onReopen}>
            Reabrir
          </Button>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <TerminalView
            terminalId={terminal.id}
            compact={tile}
            fontDelta={props.fontDelta}
            visible={visible}
            focused={focused}
            onFocus={props.onActivate}
            onExit={props.onExit}
            onGone={props.onGone}
          />
        </div>
      )}

      {terminal.status === 'exited' && (
        <div className="flex-none h-10 flex items-center gap-2.5 px-3 border-t border-[var(--wfa-state-stop-border)] bg-[var(--wfa-state-stop-subtle)] text-[12.5px] text-text-1">
          <span>Sessão terminada · {statusDetail(terminal)} · gravada</span>
          <span className="flex-1" />
          <Button size="small" loading={reopening} onClick={props.onReopen}>
            Reabrir
          </Button>
        </div>
      )}
    </section>
  );
}
