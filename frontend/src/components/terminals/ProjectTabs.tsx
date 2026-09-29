import { CloseOutlined } from '@ant-design/icons';
import type { Project } from './projects';

type ProjectTabsProps = {
  /** Só os abertos (spec separadores-de-projetos §3), pela ordem em que foram abertos nesta sessão. */
  projects: Project[];
  activePath: string | null;
  onSelect: (path: string) => void;
  /** Esconde o separador — nunca mata os terminais do projeto. */
  onClose: (path: string) => void;
};

/**
 * Separadores tipo browser, um por projeto aberto — sem protótipo do Claude Design (registar o padrão em
 * design/ ao fechar a spec). Fechar (×) só esconde; reabre-se clicando o projeto na lateral.
 */
export function ProjectTabs({ projects, activePath, onSelect, onClose }: ProjectTabsProps) {
  if (projects.length === 0) return null;

  return (
    <div className="h-14 flex-none flex items-end gap-1.5 px-3 pt-2.5 bg-surface-1 border-b border-border overflow-x-auto" role="tablist" aria-label="Projetos abertos">
      {projects.map((project) => {
        const active = project.path === activePath;
        const running = project.terminals.filter((t) => t.status === 'running').length;
        return (
          <div
            key={project.path}
            role="tab"
            aria-selected={active}
            data-project-tab={project.path}
            onClick={() => onSelect(project.path)}
            className={`group h-11 flex-none flex items-center gap-2.5 pl-4 pr-2.5 rounded-t-lg border-t-2 cursor-pointer max-w-[260px] transition-colors ${
              active ? 'border-t-accent bg-bg text-text-1 font-semibold' : 'border-t-transparent bg-transparent text-text-2 hover:bg-surface-2 hover:text-text-1'
            }`}
          >
            <span className="truncate text-[14.5px]" title={project.path}>
              {project.name}
            </span>
            {running > 0 && (
              <span className="flex-none font-mono text-[11px] text-text-3 bg-surface-3 rounded px-1.5 py-0.5">{running}</span>
            )}
            <button
              type="button"
              aria-label={`Esconder separador de ${project.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onClose(project.path);
              }}
              className="flex-none w-5 h-5 flex items-center justify-center rounded-sm bg-transparent border-0 text-text-3 opacity-0 group-hover:opacity-100 hover:bg-surface-3 hover:text-text-1"
            >
              <CloseOutlined style={{ fontSize: 11 }} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
