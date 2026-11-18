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

// Preferência do dispositivo, no localStorage (docs/database.md): os ciclos de vida escolhidos, em JSON; [] = Todos.
const FILTER_KEY = 'workflow-app.projects-lifecycle-filter';

function readSavedFilter(): ReadonlySet<Lifecycle> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(FILTER_KEY) ?? '[]');
    // Um valor estragado ou um ciclo de vida que deixou de existir não pode esconder projetos.
    return new Set(Array.isArray(saved) ? LIFECYCLES.filter((lifecycle) => saved.includes(lifecycle)) : []);
  } catch {
    return new Set();
  }
}

function saveFilter(selected: ReadonlySet<Lifecycle>) {
  try {
    localStorage.setItem(FILTER_KEY, JSON.stringify([...selected]));
  } catch {
    // localStorage indisponível: a escolha dura só esta visita.
  }
}

/** A ficha de cada projeto do registo: ciclo de vida, onde corre e o último deploy (spec informacao-dos-projetos). */
export function ProjectsPage() {
  const projects = useProjects();
  const infos = useProjectInfos();
  // Vários ciclos de vida ao mesmo tempo (mostra-se a união); nenhum escolhido = Todos. Guardado neste browser.
  const [selected, setSelected] = useState<ReadonlySet<Lifecycle>>(readSavedFilter);
  const choose = (next: ReadonlySet<Lifecycle>) => {
    setSelected(next);
    saveFilter(next);
  };
  const toggle = (lifecycle: Lifecycle) => {
    const next = new Set(selected);
    if (next.has(lifecycle)) next.delete(lifecycle);
    else next.add(lifecycle);
    choose(next);
  };
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
        (selected.size === 0 || selected.has(infoByPath.get(project.path)?.lifecycle as Lifecycle)) &&
        (!needle || project.name.toLowerCase().includes(needle)),
    );
  }, [projects.projects, infoByPath, selected, search]);

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
        <button type="button" className="filter-chip" aria-pressed={selected.size === 0} onClick={() => choose(new Set())}>
          Todos <span className="font-mono text-[11.5px] text-text-3">{projects.projects.length}</span>
        </button>
        {LIFECYCLES.map((lifecycle) => (
          <button key={lifecycle} type="button" className="filter-chip" aria-pressed={selected.has(lifecycle)} onClick={() => toggle(lifecycle)}>
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
        onRegisterDeploy={infos.registerDeploy}
        onRemoveDeploy={infos.removeDeploy}
        gitWarnings={drawer.path ? (infos.gitWarnings[drawer.path] ?? []) : []}
        syncing={drawer.path !== null && infos.syncing === drawer.path}
        onSyncGit={infos.syncFromGit}
      />
    </div>
  );
}
