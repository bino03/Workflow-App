import { useMemo, useState } from 'react';
import { SearchOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Input, Spin } from 'antd';
import { useLocation } from 'react-router';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { ProjectInfoDrawer } from '@/components/projects/ProjectInfoDrawer';
import { LIFECYCLES, lifecycleLabel } from '@/components/projects/projectInfoFormat';
import { useProjectInfos } from '@/hooks/useProjectInfos';
import { useProjects } from '@/hooks/useProjects';
import type { Lifecycle } from '@/types/projectInfo';

type LifecycleFilter = 'all' | Lifecycle;

/** A ficha de cada projeto do registo: ciclo de vida, onde corre e o último deploy (spec informacao-dos-projetos). */
export function ProjectsPage() {
  const projects = useProjects();
  const infos = useProjectInfos();
  const [filter, setFilter] = useState<LifecycleFilter>('all');
  const [search, setSearch] = useState('');

  // Um projeto pré-aberto por `location.state.projectPath` (o ícone ⓘ dos separadores, numa segunda fase).
  const requestedPath = (useLocation().state as { projectPath?: string } | null)?.projectPath ?? null;
  // `drawerPath` não se limpa ao fechar (o conteúdo fica durante a animação); `session` muda a cada abertura,
  // para o drawer recomeçar em modo de leitura (ou de edição) com o formulário limpo.
  const [drawer, setDrawer] = useState({ path: requestedPath, open: requestedPath !== null, edit: false, session: 0 });
  const openDrawer = (path: string, options?: { edit: boolean }) =>
    setDrawer((current) => ({ path, open: true, edit: options?.edit ?? false, session: current.session + 1 }));
  const drawerProject = projects.projects.find((project) => project.path === drawer.path) ?? null;

  const infoByPath = useMemo(() => new Map(infos.infos.map((info) => [info.projectPath, info])), [infos.infos]);

  const countOf = (lifecycle: Lifecycle) => projects.projects.filter((project) => infoByPath.get(project.path)?.lifecycle === lifecycle).length;

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return projects.projects.filter(
      (project) =>
        (filter === 'all' || infoByPath.get(project.path)?.lifecycle === filter) && (!needle || project.name.toLowerCase().includes(needle)),
    );
  }, [projects.projects, infoByPath, filter, search]);

  const loading = projects.loading || infos.loading;
  const error = projects.error ?? infos.error;
  const reload = () => {
    projects.refresh();
    infos.refresh();
  };

  return (
    <div className="px-10 pt-7 pb-6 flex flex-col gap-5">
      <div className="flex items-end gap-4">
        <div className="flex-1 flex flex-col gap-1">
          <span className="kicker">Projetos</span>
          <h1 className="text-display m-0">As tuas aplicações</h1>
          <span className="text-[13.5px] text-text-2">Onde cada projeto corre, em que URL e quando foi o último deploy.</span>
        </div>
        <Input
          className="max-w-[320px]"
          prefix={<SearchOutlined className="opacity-50" />}
          placeholder="Pesquisar projetos…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          allowClear
          aria-label="Pesquisar projetos"
        />
      </div>

      <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filtrar por ciclo de vida">
        <button type="button" className="filter-chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          Todos <span className="font-mono text-[11.5px] text-text-3">{projects.projects.length}</span>
        </button>
        {LIFECYCLES.map((lifecycle) => (
          <button key={lifecycle} type="button" className="filter-chip" aria-pressed={filter === lifecycle} onClick={() => setFilter(lifecycle)}>
            {lifecycleLabel(lifecycle)} <span className="font-mono text-[11.5px] text-text-3">{countOf(lifecycle)}</span>
          </button>
        ))}
      </div>

      {error ? (
        <Alert
          type="error"
          showIcon
          title={error}
          action={
            <Button size="small" onClick={reload}>
              Tentar de novo
            </Button>
          }
        />
      ) : loading ? (
        <div className="flex justify-center py-16">
          <Spin />
        </div>
      ) : projects.projects.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span className="text-text-2">
              Nenhum projeto encontrado. Confirma o <span className="font-mono">WORKFLOW_PATH</span> e as <span className="font-mono">ALLOWED_ROOTS</span> do
              backend.
            </span>
          }
        />
      ) : shown.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span className="text-text-2">Nenhum projeto com esse filtro.</span>} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
          {shown.map((project) => (
            <ProjectCard key={project.path} project={project} info={infoByPath.get(project.path)} onOpen={openDrawer} />
          ))}
        </div>
      )}

      <ProjectInfoDrawer
        key={drawer.session}
        open={drawer.open && drawerProject !== null}
        project={drawerProject}
        info={drawer.path ? infoByPath.get(drawer.path) : undefined}
        infos={infos.infos}
        startEditing={drawer.edit}
        onClose={() => setDrawer((current) => ({ ...current, open: false }))}
        onSave={infos.save}
        onRemove={infos.remove}
      />
    </div>
  );
}
