import { useState, type ReactNode } from 'react';
import {
  DownOutlined,
  HistoryOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  StarFilled,
  StarOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { Button, Tooltip, type MenuProps } from 'antd';
import { AccountPicker } from '@/components/accounts/AccountPicker';
import { AccountTag } from '@/components/accounts/AccountTag';
import type { TerminalStatus, TerminalView } from '@/types/terminal';
import type { Project } from './projects';
import { TerminalContextMenu } from './TerminalContextMenu';
import { STATUS_META, statusDetail } from './terminalDisplay';

type TerminalSidebarProps = {
  /** Todos os projetos — só para o "Reabrir todos", que é global. A lista mostra só o projeto ativo. */
  projects: Project[];
  /** O projeto ativo — a lateral é dele (ADR 0036); muda-se pelo seletor. */
  activePath: string | null;
  names: Map<string, string>;
  /** Só os terminais do projeto ativo têm posição — é aí que o Alt+1…9 se aplica. */
  shortcutIndex: Map<string, number>;
  visibleIds: string[];
  /** Abre o seletor de projeto (o mesmo do atalho `projectSwitch`). */
  onOpenSwitcher: () => void;
  switcherOpen: boolean;
  /** A combinação do `projectSwitch` ("Alt+B"), ou `null` sem bind. */
  switcherHint: string | null;
  /** Clicar um terminal: seleciona-o. */
  onSelectTerminal: (id: string) => void;
  /** O menu de contexto de cada terminal. */
  menuFor: (terminal: TerminalView) => MenuProps;
  /** `accountId` omitido: a conta ativa. */
  onNewInProject: (path: string, accountId?: string) => void;
  onResumeInProject: (path: string) => void;
  onToggleFavorite: (path: string, favorite: boolean) => void;
  creatingIn: string | null;
  onReopenAll: () => void;
  reopeningAll: boolean;
  /** A quota, em baixo (passo 16 da spec Terminais). */
  footer?: ReactNode;
  /** Escondida/visível — estado do `TerminalsPage` (também alternado por `AltGr+.`). */
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

const COUNT_LABELS: Record<TerminalStatus, string> = { running: 'a correr', exited: 'terminados', stopped: 'parados' };

function IconButton({ label, onClick, children, loading }: { label: string; onClick: () => void; children: ReactNode; loading?: boolean }) {
  return (
    <Tooltip title={label} mouseEnterDelay={0.4}>
      <button
        type="button"
        aria-label={label}
        disabled={loading}
        onClick={onClick}
        className="w-6 h-6 flex items-center justify-center bg-transparent border-0 rounded-sm text-text-3 cursor-pointer hover:bg-surface-3 hover:text-text-1 disabled:opacity-40"
      >
        {children}
      </button>
    </Tooltip>
  );
}

/**
 * Lateral dos Terminais, com a largura da célula da marca (`--wfa-sidebar-width`, ADR 0036): é **do projeto
 * ativo** — o nome no topo é o seletor de projeto (substitui os separadores), por baixo as ações do projeto e
 * os terminais dele. Os outros projetos chegam-se pelo seletor ou pelo atalho `projectSwitch`.
 */
export function TerminalSidebar(props: TerminalSidebarProps) {
  const { projects, activePath, names, shortcutIndex, visibleIds, collapsed, onToggleCollapsed } = props;
  const [statusFilter, setStatusFilter] = useState<TerminalStatus | null>(null);
  const project = projects.find((p) => p.path === activePath) ?? null;
  const terminals = project?.terminals ?? [];
  const counts = (Object.keys(COUNT_LABELS) as TerminalStatus[])
    .map((status) => ({ status, n: terminals.filter((t) => t.status === status).length }))
    .filter(({ n }) => n > 0);
  const shown = statusFilter ? terminals.filter((t) => t.status === statusFilter) : terminals;
  const stoppedEverywhere = projects.flatMap((p) => p.terminals).filter((t) => t.status === 'stopped').length;

  if (collapsed) {
    return (
      <aside className="w-11 flex-none flex flex-col items-center gap-1 border-r border-border bg-surface-1 pt-3">
        <IconButton label="Mostrar lateral (AltGr+.)" onClick={onToggleCollapsed}>
          <MenuUnfoldOutlined />
        </IconButton>
        <IconButton label={`Mudar de projeto${props.switcherHint ? ` (${props.switcherHint})` : ''}`} onClick={props.onOpenSwitcher}>
          <SwapOutlined />
        </IconButton>
      </aside>
    );
  }

  return (
    <aside className="w-[var(--wfa-sidebar-width)] flex-none flex flex-col border-r border-border bg-surface-1" data-project={project?.path}>
      <div className="px-3 pt-3 pb-2 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="kicker">Projeto</span>
          <div className="flex items-center gap-1.5">
            {props.switcherHint && <kbd className="kbd">{props.switcherHint}</kbd>}
            <IconButton label="Esconder lateral (AltGr+.)" onClick={onToggleCollapsed}>
              <MenuFoldOutlined style={{ fontSize: 12 }} />
            </IconButton>
          </div>
        </div>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={props.switcherOpen}
          data-project-switcher
          title={`Mudar de projeto${props.switcherHint ? ` (${props.switcherHint})` : ''}`}
          onClick={props.onOpenSwitcher}
          className={`-mx-2 h-8 flex items-center gap-1.5 px-2 rounded-md border cursor-pointer text-left ${
            props.switcherOpen ? 'bg-surface-3 border-border-strong' : 'bg-transparent border-transparent hover:bg-surface-2'
          }`}
        >
          <span className={`flex-1 min-w-0 truncate font-semibold text-[14px] ${project ? 'text-text-1' : 'text-text-3'}`}>
            {project?.name ?? 'Escolher projeto…'}
          </span>
          <DownOutlined className="text-text-3 text-[10px]" />
        </button>
        {project && (
          <div className="flex items-center gap-0.5">
            <span className="flex-1 min-w-0 font-mono text-[10.5px] text-text-3 truncate" title={project.path}>
              {project.path}
            </span>
            <IconButton label={project.favorite ? 'Tirar das favoritas' : 'Marcar como favorita'} onClick={() => props.onToggleFavorite(project.path, !project.favorite)}>
              {project.favorite ? <StarFilled className="text-warning" /> : <StarOutlined />}
            </IconButton>
            <IconButton label="Retomar uma sessão desta pasta…" onClick={() => props.onResumeInProject(project.path)}>
              <HistoryOutlined />
            </IconButton>
            <IconButton label={`Novo terminal em ${project.name}`} onClick={() => props.onNewInProject(project.path)} loading={props.creatingIn === project.path}>
              <PlusOutlined />
            </IconButton>
            <AccountPicker title="Noutra conta" placement="bottomRight" onPick={(accountId) => props.onNewInProject(project.path, accountId)}>
              <button
                type="button"
                aria-label={`Novo terminal em ${project.name} noutra conta`}
                title="Novo terminal noutra conta"
                disabled={props.creatingIn === project.path}
                className="w-4 h-6 flex items-center justify-center bg-transparent border-0 rounded-sm text-text-3 cursor-pointer hover:bg-surface-3 hover:text-text-1 disabled:opacity-40"
              >
                <DownOutlined style={{ fontSize: 9 }} />
              </button>
            </AccountPicker>
          </div>
        )}
      </div>

      {(counts.length > 1 || stoppedEverywhere > 0) && (
        <div className="px-3 pb-2 flex flex-col gap-2">
          {counts.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por status">
              {counts.map(({ status, n }) => (
                <button
                  key={status}
                  type="button"
                  className="filter-chip"
                  aria-pressed={statusFilter === status}
                  onClick={() => setStatusFilter((current) => (current === status ? null : status))}
                >
                  <span className={`state-icon ${STATUS_META[status].icon}`} aria-hidden />
                  {n} {COUNT_LABELS[status]}
                </button>
              ))}
            </div>
          )}
          {stoppedEverywhere > 0 && (
            <Button size="small" onClick={props.onReopenAll} loading={props.reopeningAll}>
              Reabrir todos ({stoppedEverywhere})
            </Button>
          )}
        </div>
      )}

      <div className="h-6 flex items-center gap-1 px-3 text-[11px] font-semibold tracking-[.08em] text-text-3">
        <span className="flex-1">TERMINAIS</span>
        <span className="font-mono font-normal">{terminals.length}</span>
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 px-1.5 pb-2" aria-label="Terminais do projeto">
        {!project && (
          <p className="m-0 px-2 py-2 text-[12.5px] text-text-3">
            Nenhum projeto aberto. Escolhe um no seletor{props.switcherHint ? ` (${props.switcherHint})` : ''}.
          </p>
        )}
        {project && terminals.length === 0 && <p className="m-0 px-2 py-2 text-[12.5px] text-text-3">Ainda sem terminais neste projeto.</p>}
        {shown.map((terminal) => {
          const meta = STATUS_META[terminal.status];
          const isShown = visibleIds.includes(terminal.id);
          const index = shortcutIndex.get(terminal.id) ?? 99;
          return (
            <TerminalContextMenu key={terminal.id} menu={props.menuFor(terminal)}>
              <button
                type="button"
                data-terminal-item={terminal.id}
                aria-current={isShown ? 'true' : undefined}
                onClick={() => props.onSelectTerminal(terminal.id)}
                className={`text-left flex flex-col gap-0.5 px-2.5 py-1.5 rounded-md border-0 cursor-pointer text-text-1 ${
                  isShown ? 'bg-accent-subtle shadow-[inset_2px_0_0_var(--wfa-color-accent)]' : 'bg-transparent hover:bg-surface-2'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span className="w-3.5 flex justify-center flex-none">
                    <span className={`state-icon ${meta.icon}`} aria-hidden />
                  </span>
                  <span className="terminal-name flex-1 min-w-0 font-medium text-[13px] overflow-hidden text-ellipsis whitespace-nowrap">
                    {names.get(terminal.id)}
                  </span>
                  {index < 9 && <span className="font-mono text-[10.5px] text-text-3">Alt+{index + 1}</span>}
                </span>
                <span className="pl-6 text-[11.5px] leading-[16px] flex items-center gap-1.5">
                  <span className={terminal.status === 'running' ? 'text-accent' : 'text-[var(--wfa-state-stop)]'}>{meta.label}</span>
                  {terminal.status !== 'running' && <span className="text-text-3">· {statusDetail(terminal)}</span>}
                  <span className="flex-1" />
                  <AccountTag accountId={terminal.accountId} className="h-[18px] px-1.5 text-[11px] max-w-[110px]" />
                </span>
              </button>
            </TerminalContextMenu>
          );
        })}
      </nav>

      {props.footer && <div className="px-4 pt-3 pb-3.5 border-t border-border">{props.footer}</div>}
    </aside>
  );
}
