import { useState } from 'react';
import { Button, Input } from 'antd';
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

type TerminalPaneProps = {
  terminal: TerminalInfo;
  /** Nome mostrado (o rótulo, ou a pasta numerada — projects.ts). */
  name: string;
  visible: boolean;
  focused: boolean;
  split: boolean;
  renaming: boolean;
  reopening: boolean;
  onActivate: () => void;
  onRenameStart: () => void;
  onRenameEnd: (label: string | null | undefined) => void;
  onSplit: () => void;
  onClose: () => void;
  onReopen: () => void;
  onExit: (code: number) => void;
  onGone: () => void;
  /** tile = mosaico da grelha (protótipo 1i): cabeçalho compacto, sem ações até ser ampliado. */
  variant?: 'pane' | 'tile';
  enlarged?: boolean;
  onBackToGrid?: () => void;
};

function ActionButton({ label, shortcut, onClick }: { label: string; shortcut?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="h-[26px] px-2.5 flex items-center gap-1.5 bg-transparent border border-border rounded-sm text-text-2 text-[12.5px] cursor-pointer whitespace-nowrap hover:text-text-1 hover:border-border-strong"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {label}
      {shortcut && <span className="font-mono text-[10px] text-text-3">{shortcut}</span>}
    </button>
  );
}

/** Um terminal no ecrã: cabeçalho (protótipo 1g/1h), o xterm.js, e o banner de terminado/parado. */
export function TerminalPane(props: TerminalPaneProps) {
  const { terminal, visible, focused, split, renaming, reopening, variant = 'pane', enlarged = false } = props;
  const tile = variant === 'tile';
  const compactHeader = tile && !enlarged;
  const meta = STATUS_META[terminal.status];
  const { name } = props;
  const [draft, setDraft] = useState(name);
  const [renameError, setRenameError] = useState<string | null>(null);

  const submitRename = () => {
    const parsed = labelSchema.safeParse(draft);
    if (!parsed.success) {
      setRenameError(parsed.error.issues[0]?.message ?? 'Nome inválido.');
      return;
    }
    // Vazio = voltar ao nome da pasta.
    props.onRenameEnd(parsed.data === '' ? null : parsed.data);
  };

  return (
    <section
      className={`flex-1 min-w-0 min-h-0 flex flex-col bg-bg ${visible ? '' : 'hidden'} ${
        tile ? `rounded-lg overflow-hidden border ${focused ? 'border-accent' : 'border-border'}` : ''
      }`}
      data-terminal-pane={terminal.id}
      onMouseDown={props.onActivate}
    >
      <header
        className={`${compactHeader ? 'h-10 pl-3 pr-3' : 'h-11 pl-4 pr-3'} flex-none flex items-center gap-2.5 border-b border-border min-w-0 ${
          focused && !compactHeader ? 'bg-surface-2' : 'bg-surface-1'
        }`}
      >
        <span className={`state-icon ${meta.icon}`} aria-hidden />
        {renaming ? (
          <Input
            size="small"
            autoFocus
            className="max-w-[240px]"
            value={draft}
            status={renameError ? 'error' : undefined}
            title={renameError ?? undefined}
            aria-label="Nome do terminal"
            placeholder="Nome da pasta"
            onChange={(event) => {
              setDraft(event.target.value);
              setRenameError(null);
            }}
            onFocus={(event) => event.target.select()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitRename();
              if (event.key === 'Escape') props.onRenameEnd(undefined);
              event.stopPropagation();
            }}
            onBlur={() => props.onRenameEnd(undefined)}
          />
        ) : (
          <span className="font-semibold text-[14px] whitespace-nowrap">{name}</span>
        )}
        {!compactHeader && <span className={meta.tag}>{meta.label}</span>}
        <span className={`font-mono text-text-3 overflow-hidden text-ellipsis whitespace-nowrap min-w-0 ${compactHeader ? 'flex-1 text-[11px]' : 'text-[11.5px]'}`}>
          {terminal.cwd}
        </span>
        {compactHeader ? <span className={meta.tag}>{meta.label}</span> : <div className="flex-1" />}
        {focused && !compactHeader && <span className="font-mono text-[10.5px] text-accent tracking-[0.04em] whitespace-nowrap">⌨ TECLADO AQUI</span>}
        <div className={`flex gap-1 ${compactHeader ? 'hidden' : ''}`}>
          {enlarged ? (
            <>
              <ActionButton
                label="Renomear"
                shortcut="Alt+R"
                onClick={() => {
                  setDraft(name);
                  props.onRenameStart();
                }}
              />
              <ActionButton label="Voltar à grelha" shortcut="Esc" onClick={() => props.onBackToGrid?.()} />
              <ActionButton label="Fechar" shortcut="Alt+W" onClick={props.onClose} />
            </>
          ) : split ? (
            <>
              <ActionButton label="Juntar" shortcut="Alt+\" onClick={props.onSplit} />
              <ActionButton label="Fechar" onClick={props.onClose} />
            </>
          ) : (
            <>
              <ActionButton
                label="Renomear"
                shortcut="Alt+R"
                onClick={() => {
                  setDraft(name);
                  props.onRenameStart();
                }}
              />
              <ActionButton label="Dividir" shortcut="Alt+\" onClick={props.onSplit} />
              <ActionButton label="Fechar" shortcut="Alt+W" onClick={props.onClose} />
            </>
          )}
        </div>
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
