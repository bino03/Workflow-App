import { useState, type ReactNode } from 'react';
import {
  CheckSquareOutlined,
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
import type { SavedSession } from '@/types/session';
import type { TerminalStatus, TerminalView } from '@/types/terminal';
import type { Project } from './projects';
import { BranchesGroup } from './BranchesGroup';
import { SavedSessionsGroup } from './SavedSessionsGroup';
import { SIDEBAR_ROW, SidebarGroup } from './SidebarGroup';
import { TerminalContextMenu } from './TerminalContextMenu';
import { AgentSublines } from './AgentSublines';
import { StateIcon } from './StateIcon';
import { STATUS_META, runningAgents, statusDetail, summarizeActivity, terminalStateMeta, wantsAttention } from './terminalDisplay';

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
  /** Clicar uma sessão gravada da lateral: retoma-a já (`--resume`, na conta em que foi feita). */
  onResumeSession: (path: string, session: SavedSession) => void;
  now: number;
  /** Escondida/visível — estado do `TerminalsPage` (também alternado por `AltGr+.`). */
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** As tarefas do projeto ativo (ADR 0037): o botão "☑ por fazer/total" abre e fecha o painel à direita. */
  tasks: { open: number; total: number };
  tasksOpen: boolean;
  onToggleTasks: () => void;
  /** A combinação do `toggleTasks` ("Alt+K"), ou `null` sem bind. */
  tasksHint: string | null;
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
  const projectActivity = summarizeActivity(terminals);
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
            <IconButton label="Esconder lateral (AltGr+.)" onClick={onToggleCollapsed}>
              <MenuFoldOutlined style={{ fontSize: 12 }} />
            </IconButton>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={props.switcherOpen}
            data-project-switcher
            title={`Mudar de projeto${props.switcherHint ? ` (${props.switcherHint})` : ''}`}
            onClick={props.onOpenSwitcher}
            className={`-ml-2 flex-1 min-w-0 h-8 flex items-center gap-1.5 px-2 rounded-md border cursor-pointer text-left ${
              props.switcherOpen ? 'bg-surface-3 border-border-strong' : 'bg-transparent border-transparent hover:bg-surface-2'
            }`}
          >
            <span className={`flex-1 min-w-0 truncate font-semibold text-[14px] ${project ? 'text-text-1' : 'text-text-3'}`}>
              {project?.name ?? 'Escolher projeto…'}
            </span>
            {projectActivity && <StateIcon icon={projectActivity.icon} title={projectActivity.text} />}
            <DownOutlined className="text-text-3 text-[10px]" />
          </button>
          {project && (
            <button
              type="button"
              aria-pressed={props.tasksOpen}
              data-tasks-toggle
              aria-label={`Tarefas do projeto: ${props.tasks.open} por fazer de ${props.tasks.total}`}
              title={`Tarefas do projeto${props.tasksHint ? ` (${props.tasksHint})` : ''}`}
              onClick={props.onToggleTasks}
              className={`h-[22px] flex-none flex items-center gap-1.5 px-1.5 rounded-md border font-mono text-[11px] cursor-pointer ${
                props.tasksOpen ? 'bg-accent-subtle border-accent-border text-text-1' : 'bg-transparent border-border-strong text-text-2 hover:text-text-1'
              }`}
            >
              <CheckSquareOutlined style={{ fontSize: 12 }} />
              {props.tasks.open}/{props.tasks.total}
            </button>
          )}
        </div>
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

      <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col pt-1" aria-label="Terminais do projeto">
        {!project && (
          <p className="m-0 px-3 py-2 text-[12.5px] text-text-3">
            Nenhum projeto aberto. Escolhe um no seletor{props.switcherHint ? ` (${props.switcherHint})` : ''}.
          </p>
        )}
        {project && (
          <SidebarGroup id="terminals" title="TERMINAIS" count={terminals.length}>
            {terminals.length === 0 && <p className="m-0 pl-[22px] pr-2 py-1 text-[12.5px] text-text-3">Ainda sem terminais neste projeto.</p>}
            {shown.map((terminal) => {
              const meta = terminalStateMeta(terminal);
              const isShown = visibleIds.includes(terminal.id);
              const index = shortcutIndex.get(terminal.id) ?? 99;
              const running = terminal.status === 'running';
              // Fora da grelha e a pedir o dono: a linha acende-se (o que está à vista já se vê no painel).
              const calling = !isShown && wantsAttention(terminal);
              const agents = runningAgents(terminal);
              return (
                <div key={terminal.id} className="flex flex-col">
                <TerminalContextMenu menu={props.menuFor(terminal)}>
                  <button
                    type="button"
                    data-terminal-item={terminal.id}
                    aria-current={isShown ? 'true' : undefined}
                    data-attention={calling || undefined}
                    title={`${meta.label} · ${statusDetail(terminal)}${index < 9 ? ` · Alt+${index + 1}` : ''}`}
                    onClick={() => props.onSelectTerminal(terminal.id)}
                    className={`${SIDEBAR_ROW} !pl-2 cursor-pointer ${
                      isShown
                        ? 'bg-accent-subtle shadow-[inset_2px_0_0_var(--wfa-color-accent)]'
                        : calling
                          ? 'bg-[var(--wfa-state-wait-subtle)] shadow-[inset_0_0_0_1px_var(--wfa-state-wait-border)]'
                          : 'bg-transparent hover:bg-surface-2'
                    }`}
                  >
                    <StateIcon icon={meta.icon} title={meta.label} slot />
                    <span className="terminal-name flex-1 min-w-0 truncate">{names.get(terminal.id)}</span>
                    <AccountTag accountId={terminal.accountId} className="h-[18px] px-1.5 text-[11px] max-w-[90px]" />
                    <span className={`flex-none font-mono text-[10.5px] ${running ? 'text-text-3' : 'text-[var(--wfa-state-stop)]'}`}>
                      {running ? `pane-${index + 1}` : STATUS_META[terminal.status].label}
                    </span>
                  </button>
                </TerminalContextMenu>
                {agents.length > 0 && <AgentSublines agents={agents} />}
                </div>
              );
            })}
          </SidebarGroup>
        )}
        {project && <BranchesGroup path={project.path} refreshKey={terminals.map((t) => t.branch ?? '').join(',')} />}
        {project && (
          <SavedSessionsGroup
            path={project.path}
            refreshKey={terminals.map((t) => `${t.id}:${t.status}`).join(',')}
            onResume={(session) => props.onResumeSession(project.path, session)}
            onShowAll={() => props.onResumeInProject(project.path)}
            now={props.now}
          />
        )}
      </nav>

      {project && (
        <div className="p-2 border-t border-border flex gap-1">
          <Button
            type="primary"
            className="flex-1"
            icon={<PlusOutlined />}
            data-new-terminal
            loading={props.creatingIn === project.path}
            onClick={() => props.onNewInProject(project.path)}
          >
            Novo terminal
          </Button>
          <AccountPicker title="Noutra conta" placement="topRight" onPick={(accountId) => props.onNewInProject(project.path, accountId)}>
            <Button aria-label={`Novo terminal em ${project.name} noutra conta`} title="Novo terminal noutra conta" disabled={props.creatingIn === project.path} icon={<DownOutlined style={{ fontSize: 10 }} />} />
          </AccountPicker>
        </div>
      )}
    </aside>
  );
}
