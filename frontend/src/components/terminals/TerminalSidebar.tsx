import type { ReactNode } from 'react';
import { HistoryOutlined, PlusOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import type { TerminalStatus } from '@/types/terminal';
import type { Project } from './projects';
import { STATUS_META, statusDetail } from './terminalDisplay';

type TerminalSidebarProps = {
  projects: Project[];
  names: Map<string, string>;
  /** Posição de cada terminal na ordem da lateral (Alt+1…9). */
  shortcutIndex: Map<string, number>;
  visibleIds: string[];
  onSelect: (id: string) => void;
  onNew: () => void;
  onNewInProject: (path: string) => void;
  onResumeInProject: (path: string) => void;
  onToggleFavorite: (path: string, favorite: boolean) => void;
  creatingIn: string | null;
  onReopenAll: () => void;
  reopeningAll: boolean;
  /** A quota, em baixo (passo 16). */
  footer?: ReactNode;
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
 * Lateral do foco dividido, 288 px, **por projetos** (spec §3, 2026-09-28): cada pasta é um grupo com os seus
 * terminais e um + que abre logo mais um terminal nessa pasta.
 */
export function TerminalSidebar(props: TerminalSidebarProps) {
  const { projects, names, shortcutIndex, visibleIds } = props;
  const terminals = projects.flatMap((p) => p.terminals);
  const counts = (Object.keys(COUNT_LABELS) as TerminalStatus[])
    .map((status) => ({ status, n: terminals.filter((t) => t.status === status).length }))
    .filter(({ n }) => n > 0);
  const stopped = terminals.filter((t) => t.status === 'stopped').length;

  return (
    <aside className="w-[288px] flex-none flex flex-col border-r border-border bg-surface-1">
      <div className="px-3.5 pt-4 pb-3 flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="kicker">Projetos</span>
          <span className="font-mono text-[11px] text-text-3">{terminals.length} abertos</span>
        </div>
        <Button type="primary" onClick={props.onNew} className="h-8">
          + Novo terminal <span className="font-mono text-[10.5px] font-medium opacity-75">Alt+N</span>
        </Button>
        {counts.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-text-2">
            {counts.map(({ status, n }) => (
              <span key={status} className="flex items-center gap-1.5">
                <span className={`state-icon ${STATUS_META[status].icon}`} aria-hidden />
                {n} {COUNT_LABELS[status]}
              </span>
            ))}
          </div>
        )}
        {stopped > 0 && (
          <Button size="small" onClick={props.onReopenAll} loading={props.reopeningAll}>
            Reabrir todos ({stopped})
          </Button>
        )}
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 px-2 pb-2" aria-label="Projetos e terminais">
        {projects.map((project) => (
          <section key={project.path} data-project={project.path} aria-label={project.name}>
            <header className="h-8 flex items-center gap-1 pl-2 pr-1 rounded-md hover:bg-surface-2 group">
              <span className="w-3 h-[9px] border-[1.5px] border-text-3 rounded-[2px] flex-none mr-1" aria-hidden />
              <span className="flex-1 min-w-0 font-semibold text-[13px] text-text-1 overflow-hidden text-ellipsis whitespace-nowrap" title={project.path}>
                {project.name}
              </span>
              {project.terminals.length > 0 && <span className="font-mono text-[10.5px] text-text-3 mr-1">{project.terminals.length}</span>}
              <IconButton label={project.favorite ? 'Tirar das favoritas' : 'Marcar como favorita'} onClick={() => props.onToggleFavorite(project.path, !project.favorite)}>
                {project.favorite ? <StarFilled className="text-warning" /> : <StarOutlined />}
              </IconButton>
              <IconButton label="Retomar uma sessão desta pasta…" onClick={() => props.onResumeInProject(project.path)}>
                <HistoryOutlined />
              </IconButton>
              <IconButton label={`Novo terminal em ${project.name}`} onClick={() => props.onNewInProject(project.path)} loading={props.creatingIn === project.path}>
                <PlusOutlined />
              </IconButton>
            </header>

            <div className="flex flex-col gap-0.5">
              {project.terminals.map((terminal) => {
                const meta = STATUS_META[terminal.status];
                const shown = visibleIds.includes(terminal.id);
                const index = shortcutIndex.get(terminal.id) ?? 99;
                return (
                  <button
                    key={terminal.id}
                    type="button"
                    data-terminal-item={terminal.id}
                    aria-current={shown ? 'true' : undefined}
                    onClick={() => props.onSelect(terminal.id)}
                    className={`ml-3 text-left flex flex-col gap-0.5 px-2.5 py-[7px] rounded-md border cursor-pointer bg-transparent text-text-1 ${
                      shown ? 'bg-surface-3 border-border-strong' : 'border-transparent hover:bg-surface-2'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="w-3.5 flex justify-center flex-none">
                        <span className={`state-icon ${meta.icon}`} aria-hidden />
                      </span>
                      <span className="terminal-name flex-1 min-w-0 font-medium text-[13.5px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {names.get(terminal.id)}
                      </span>
                      {index < 9 && <span className="font-mono text-[10.5px] text-text-3">Alt+{index + 1}</span>}
                    </span>
                    <span className="pl-6 text-[12px] leading-[17px] flex gap-1.5">
                      <span className={terminal.status === 'running' ? 'text-accent' : 'text-[var(--wfa-state-stop)]'}>{meta.label}</span>
                      {terminal.status !== 'running' && <span className="text-text-3">· {statusDetail(terminal)}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      {props.footer && <div className="px-4 pt-3.5 pb-4 border-t border-border">{props.footer}</div>}
    </aside>
  );
}
