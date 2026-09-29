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
    <div className="h-10 flex-none flex items-end gap-1 px-2 pt-1.5 bg-surface-1 border-b border-border overflow-x-auto" role="tablist" aria-label="Projetos abertos">
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
            className={`group h-[34px] flex-none flex items-center gap-2 pl-3 pr-2 rounded-t-md border border-b-0 cursor-pointer max-w-[220px] ${
              active ? 'bg-bg border-border-strong text-text-1' : 'bg-surface-2 border-transparent text-text-2 hover:bg-surface-3'
            }`}
          >
            <span className="truncate text-[13px] font-medium" title={project.path}>
              {project.name}
            </span>
            {running > 0 && <span className="flex-none font-mono text-[10.5px] text-text-3">{running}</span>}
            <button
              type="button"
              aria-label={`Esconder separador de ${project.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onClose(project.path);
              }}
              className="flex-none w-4 h-4 flex items-center justify-center rounded-sm bg-transparent border-0 text-text-3 opacity-0 group-hover:opacity-100 hover:bg-surface-3 hover:text-text-1"
            >
              <CloseOutlined style={{ fontSize: 10 }} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
