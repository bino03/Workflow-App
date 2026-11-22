import { type ReactNode, useState } from 'react';
import { CloseOutlined, CompressOutlined, DownOutlined, ExpandOutlined, LinkOutlined, SplitCellsOutlined } from '@ant-design/icons';
import { Button, Input, Tooltip, type MenuProps } from 'antd';
import { z } from 'zod';
import { AccountPicker } from '@/components/accounts/AccountPicker';
import { AccountTag } from '@/components/accounts/AccountTag';
import type { TerminalView as TerminalInfo, TerminalPreview } from '@/types/terminal';
import { TerminalContextMenu } from './TerminalContextMenu';
import { AgentsBadge } from './AgentsBadge';
import { StateIcon } from './StateIcon';
import { runningAgents, statusDetail, terminalStateMeta } from './terminalDisplay';
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

/**
 * A pré-visualização viva (ADR 0018), ao lado do RC: o link abre noutro separador, o ✕ desliga. É uma etiqueta e não
 * um botão — o cabeçalho continua sem ações; ligar é pelo atalho (Alt+L por omissão) ou pelo /preview do bot.
 */
function PreviewTag({ preview, compact, onStop }: { preview: TerminalPreview; compact: boolean; onStop: () => void }) {
  const host = new URL(preview.url).host;
  return (
    <span className="tag tag-sm max-w-[240px] min-w-0" data-preview={preview.url}>
      <Tooltip title={`Porta ${preview.devPort} do PC → só os teus dispositivos Tailscale`} mouseEnterDelay={0.4}>
        <a
          href={preview.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 min-w-0 text-accent hover:underline"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <LinkOutlined aria-hidden />
          {!compact && <span className="font-mono truncate">{host}</span>}
        </a>
      </Tooltip>
      {!compact && (
        <button
          type="button"
          aria-label="Desligar a pré-visualização"
          className="inline-flex items-center text-text-3 hover:text-text-1 cursor-pointer bg-transparent border-0 p-0"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={onStop}
        >
          <CloseOutlined aria-hidden />
        </button>
      )}
    </span>
  );
}

/** O ícone do botão de vista: ampliar, voltar (à grelha / juntar) ou pôr lado a lado. */
export type PaneViewIcon = 'expand' | 'compress' | 'split';

const VIEW_ICONS: Record<PaneViewIcon, ReactNode> = {
  expand: <ExpandOutlined aria-hidden />,
  compress: <CompressOutlined aria-hidden />,
  split: <SplitCellsOutlined aria-hidden />,
};

/** Botão de 20 px do cabeçalho de painel (proposta C do ADR 0036). Não deixa o clique chegar ao duplo clique do mosaico. */
function PaneButton(props: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode; data?: string }) {
  return (
    <Tooltip title={props.label} mouseEnterDelay={0.4}>
      <button
        type="button"
        aria-label={props.label}
        disabled={props.disabled}
        data-pane-button={props.data}
        className="flex-none w-5 h-5 flex items-center justify-center rounded-sm bg-transparent border-0 p-0 text-[12px] text-text-3 cursor-pointer hover:bg-surface-3 hover:text-text-1 disabled:opacity-40 disabled:cursor-default disabled:hover:bg-transparent"
        onDoubleClick={(event) => event.stopPropagation()}
        onClick={props.onClick}
      >
        {props.children}
      </button>
    </Tooltip>
  );
}

type TerminalPaneProps = {
  terminal: TerminalInfo;
  /** Nome mostrado (o rótulo, ou a pasta numerada — projects.ts). */
  name: string;
  /** O número do Alt+1…9 (a partir de 1), mostrado como `pane-N`. */
  paneNumber: number;
  /** Ampliar / Voltar à grelha / Dividir / Juntar — o mesmo texto do menu de contexto. */
  viewAction: { label: string; disabled?: boolean };
  viewIcon: PaneViewIcon;
  onViewAction: () => void;
  /** O ✕ do cabeçalho: pede confirmação, como o Alt+W. */
  onClose: () => void;
  /** "Fechar o terminal (Alt+W)" — com o atalho configurado, se houver. */
  closeLabel: string;
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
  /** "Continuar noutra conta": a página mostra o tamanho do contexto antes de reabrir. */
  onContinueIn: (accountId: string) => void;
  onExit: (code: number) => void;
  onGone: () => void;
  /** O ✕ da etiqueta de pré-visualização. */
  onPreviewStop: () => void;
  /** O menu de contexto, no cabeçalho. */
  menu: MenuProps;
  /** tile = mosaico da grelha (protótipo 1i): cabeçalho compacto, sem ações até ser ampliado. */
  variant?: 'pane' | 'tile';
  enlarged?: boolean;
};

/** Um terminal no ecrã: cabeçalho denso de 26 px (proposta C do ADR 0036 — nome · `pane-N` · branch · ícone de estado (a activity do claude, senão o status) ·
 * ampliar · fechar), o xterm.js, e o banner de terminado/parado. Os dois botões voltaram a 2026-11-21 (antes o
 * cabeçalho não tinha nenhum, 2026-09-29); o resto continua nos atalhos e no menu de contexto do cabeçalho. */
export function TerminalPane(props: TerminalPaneProps) {
  const { terminal, visible, focused, renaming, reopening, variant = 'pane', enlarged = false } = props;
  const tile = variant === 'tile';
  const compactHeader = tile && !enlarged;
  const meta = terminalStateMeta(terminal);
  const agents = runningAgents(terminal);
  const { name } = props;
  const paneMeta = terminal.branch ? `pane-${props.paneNumber} · ${terminal.branch}` : `pane-${props.paneNumber}`;

  return (
    <section
      className={`flex-1 min-w-0 min-h-0 flex flex-col bg-bg ${visible ? '' : 'hidden'} ${tile ? 'shadow-[0_0_0_1px_var(--wfa-color-border)]' : ''}`}
      data-terminal-pane={terminal.id}
      data-focused={focused || undefined}
      onMouseDown={props.onActivate}
      onDoubleClick={compactHeader ? props.onEnlarge : undefined}
    >
      <TerminalContextMenu menu={props.menu} disabled={renaming}>
      <header
        className={`h-[var(--wfa-row-height)] pl-2.5 pr-1.5 flex-none flex items-center gap-2 border-b border-border min-w-0 ${
          focused ? 'bg-surface-2 shadow-[inset_0_2px_0_var(--wfa-color-accent)]' : 'bg-surface-1'
        }`}
        data-pane-header
      >
        <StateIcon icon={meta.icon} title={meta.label} slot />
        {renaming ? (
          <RenameInput initialName={name} onFinish={props.onRenameEnd} />
        ) : (
          <Tooltip title={terminal.cwd} mouseEnterDelay={0.4}>
            <span className="font-semibold text-[12px] whitespace-nowrap">{name}</span>
          </Tooltip>
        )}
        <span className="min-w-0 truncate font-mono text-[10.5px] text-text-3" data-pane-meta title={paneMeta}>
          {paneMeta}
        </span>
        <AccountTag accountId={terminal.accountId} className="tag-sm max-w-[120px]" />
        {agents.length > 0 && <AgentsBadge agents={agents} />}
        {terminal.remoteControl && (
          <Tooltip title="Remote Control — também no app Claude" mouseEnterDelay={0.4}>
            <span className="tag tag-sm" data-remote-control>
              RC
            </span>
          </Tooltip>
        )}
        {terminal.preview && (
          <PreviewTag preview={terminal.preview} compact={compactHeader} onStop={props.onPreviewStop} />
        )}
        <div className="flex-1 min-w-0" />
        <PaneButton label={props.viewAction.label} disabled={props.viewAction.disabled} onClick={props.onViewAction} data="view">
          {VIEW_ICONS[props.viewIcon]}
        </PaneButton>
        <PaneButton label={props.closeLabel} onClick={props.onClose} data="close">
          <CloseOutlined aria-hidden />
        </PaneButton>
      </header>
      </TerminalContextMenu>

      {terminal.status === 'stopped' ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
          <span className="state-icon is-stop" aria-hidden />
          <p className="m-0 text-text-1 font-semibold">Terminal parado</p>
          <p className="m-0 text-text-2 text-[13px] max-w-[420px]">
            O processo terminou (o backend reiniciou, ou foi parado pelo bot). A conversa está gravada — reabrir
            retoma-a onde ficou.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="primary" loading={reopening} onClick={props.onReopen}>
              Reabrir
            </Button>
            <AccountPicker excludeId={terminal.accountId} onPick={props.onContinueIn}>
              <Button disabled={reopening} data-continue-elsewhere>
                Continuar noutra conta <DownOutlined style={{ fontSize: 9 }} />
              </Button>
            </AccountPicker>
          </div>
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
          <AccountPicker excludeId={terminal.accountId} placement="topRight" onPick={props.onContinueIn}>
            <Button size="small" disabled={reopening} data-continue-elsewhere>
              Continuar noutra conta <DownOutlined style={{ fontSize: 9 }} />
            </Button>
          </AccountPicker>
          <Button size="small" loading={reopening} onClick={props.onReopen}>
            Reabrir
          </Button>
        </div>
      )}
    </section>
  );
}
