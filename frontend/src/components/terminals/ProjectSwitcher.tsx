import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { FolderOpenOutlined, FolderOutlined, PlusOutlined, SearchOutlined, StarFilled } from '@ant-design/icons';
import { Link } from 'react-router';
import type { TerminalStatus } from '@/types/terminal';
import type { Project } from './projects';
import { StateIcon } from './StateIcon';
import { STATUS_META, summarizeActivity } from './terminalDisplay';

type ProjectSwitcherProps = {
  open: boolean;
  projects: Project[];
  activePath: string | null;
  onPick: (path: string) => void;
  onClose: () => void;
  /** "Abrir outra pasta…" (proposta C): uma pasta fora do registo. */
  onOpenFolder: () => void;
};

const STATUS_ORDER: TerminalStatus[] = ['running', 'exited', 'stopped'];

/**
 * Projetos com terminais primeiro, depois as favoritas, depois o resto — dentro de cada grupo, a ordem que já
 * traziam (a do registo). É a ordem em que se procura um projeto para onde voltar.
 */
function rank(project: Project): number {
  if (project.terminals.length > 0) return 0;
  return project.favorite ? 1 : 2;
}

/**
 * O seletor de projeto (ADR 0036): abre-se pelo nome do projeto na lateral ou pelo atalho `projectSwitch`
 * (Alt+B por omissão). Substitui os separadores de projeto — procurar, ↑↓, Enter, Esc. Escolher um projeto só o
 * ativa: um projeto vazio não ganha um terminal sozinho (escolhe-se: novo, noutra conta ou retomar).
 */
export function ProjectSwitcher({ open, ...rest }: ProjectSwitcherProps) {
  // Só montado enquanto aberto: cada abertura começa com a pesquisa vazia e o realce no projeto atual.
  return open ? <SwitcherPanel {...rest} /> : null;
}

function filterProjects(projects: Project[], query: string): Project[] {
  const q = query.trim().toLowerCase();
  return projects
    .map((project, index) => ({ project, index }))
    .filter(({ project }) => !q || project.name.toLowerCase().includes(q) || project.path.toLowerCase().includes(q))
    .sort((a, b) => rank(a.project) - rank(b.project) || a.index - b.index)
    .map(({ project }) => project);
}

function SwitcherPanel({ projects, activePath, onPick, onClose, onOpenFolder }: Omit<ProjectSwitcherProps, 'open'>) {
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(() => Math.max(0, filterProjects(projects, '').findIndex((p) => p.path === activePath)));
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => filterProjects(projects, query), [projects, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Clicar fora fecha.
  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // O botão que o abre trata do próprio clique (senão fechava aqui e reabria logo a seguir).
      if (target.closest('[data-project-switcher]')) return;
      if (panelRef.current && !panelRef.current.contains(target)) onClose();
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [onClose]);

  const pick = (path: string) => {
    onPick(path);
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const count = matches.length;
      if (count === 0) return;
      setHighlight((h) => (h + (event.key === 'ArrowDown' ? 1 : -1) + count) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = matches[highlight];
      if (target) pick(target.path);
    }
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Mudar de projeto"
      onKeyDown={onKeyDown}
      className="absolute z-30 top-2 left-2 w-[360px] max-h-[min(520px,calc(100%-16px))] flex flex-col overflow-hidden rounded-lg bg-surface-2 border border-border-strong shadow-overlay"
    >
      <div className="h-10 flex-none flex items-center gap-2 px-3 border-b border-border">
        <SearchOutlined className="text-text-3 text-[13px]" />
        <input
          ref={inputRef}
          type="text"
          aria-label="Procurar projeto"
          placeholder="Procurar projeto…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlight(0);
          }}
          className="flex-1 min-w-0 h-8 bg-transparent border-0 outline-none text-text-1 text-[13px] placeholder:text-text-3"
        />
        <kbd className="kbd">Esc</kbd>
      </div>

      <div role="listbox" aria-label="Projetos" className="flex-1 min-h-0 overflow-y-auto p-1 flex flex-col gap-px">
        {matches.length === 0 && <p className="m-0 px-3 py-3 text-[12.5px] text-text-3">Nenhum projeto com esse nome.</p>}
        {matches.map((project, index) => {
          const current = project.path === activePath;
          const activity = summarizeActivity(project.terminals);
          const statuses = STATUS_ORDER.filter((status) => project.terminals.some((t) => t.status === status));
          return (
            <button
              key={project.path}
              type="button"
              role="option"
              aria-selected={index === highlight}
              aria-current={current ? 'true' : undefined}
              data-switcher-project={project.path}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => pick(project.path)}
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md border-0 text-left cursor-pointer ${
                index === highlight ? 'bg-surface-3' : 'bg-transparent'
              } ${current ? 'shadow-[inset_2px_0_0_var(--wfa-color-accent)]' : ''}`}
            >
              <FolderOutlined className="text-accent text-[13px] flex-none" />
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="flex items-center gap-1.5 text-[13px] text-text-1">
                  <span className="truncate">{project.name}</span>
                  {project.favorite && <StarFilled className="text-warning text-[10px]" aria-label="Favorita" />}
                </span>
                <span className="font-mono text-[10.5px] text-text-3 truncate" title={project.path}>
                  {project.path}
                </span>
              </span>
              {activity ? (
                <StateIcon icon={activity.icon} title={activity.text} />
              ) : (
                statuses.map((status) => (
                  <span key={status} className={`state-icon ${STATUS_META[status].icon}`} title={STATUS_META[status].label} aria-hidden />
                ))
              )}
              {project.terminals.length > 0 && <span className="font-mono text-[10.5px] text-text-3">{project.terminals.length}</span>}
              {current && <span className="font-mono text-[10.5px] text-accent">atual</span>}
            </button>
          );
        })}
      </div>

      <div className="h-8 flex-none flex items-center gap-2 px-3 border-t border-border text-[12px] text-text-3">
        <FolderOpenOutlined className="text-[11px]" />
        <button
          type="button"
          data-switcher-open-folder
          onClick={() => {
            onClose();
            onOpenFolder();
          }}
          className="p-0 bg-transparent border-0 cursor-pointer text-accent text-[12px] hover:underline"
        >
          Abrir outra pasta…
        </button>
        <span className="text-text-3">·</span>
        <PlusOutlined className="text-[11px]" />
        <Link to="/new-project" onClick={onClose} className="no-underline">
          Novo projeto…
        </Link>
        <span className="flex-1" />
        <span className="font-mono text-[10.5px]">↑↓ · Enter</span>
      </div>
    </div>
  );
}
