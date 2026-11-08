import type { ProjectEntry } from '@/types/project';
import type { ProjectInfo } from '@/types/projectInfo';
import { displayUrl, lastDeployOfProject, lifecycleLabel, lifecycleTagClass, primaryEnvironment, relativeDeploy } from './projectInfoFormat';

type Props = {
  project: ProjectEntry;
  info: ProjectInfo | undefined;
};

/** Um projeto do registo com a sua ficha: ciclo de vida, URL de produção, hosting e último deploy. */
export function ProjectCard({ project, info }: Props) {
  const environment = primaryEnvironment(info);
  const deploy = lastDeployOfProject(info);
  const hasInfo = info !== undefined && (info.lifecycle !== null || info.environments.length > 0);

  return (
    <article className="bg-surface-1 border border-border rounded-lg p-4 flex flex-col gap-3 min-w-0" aria-label={project.name}>
      <header className="flex items-start gap-2 min-w-0">
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <h2 className="m-0 text-[16px] leading-6 font-semibold text-text-1 truncate">{project.name}</h2>
          <span className="font-mono text-[11.5px] text-text-3 truncate" title={project.path}>
            {project.path}
          </span>
        </div>
        {info?.lifecycle && <span className={lifecycleTagClass(info.lifecycle)}>{lifecycleLabel(info.lifecycle)}</span>}
      </header>

      {hasInfo ? (
        <dl className="m-0 grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
          <dt className="text-text-3">URL</dt>
          <dd className="m-0 min-w-0">
            {environment?.url ? (
              <a href={environment.url} target="_blank" rel="noopener noreferrer" className="font-mono text-[12.5px] text-accent hover:text-accent-hover truncate block">
                {displayUrl(environment.url)}
              </a>
            ) : (
              <span className="text-text-3">—</span>
            )}
          </dd>
          <dt className="text-text-3">Hosting</dt>
          <dd className="m-0 text-text-1 truncate">{environment?.hosting ?? <span className="text-text-3">—</span>}</dd>
          <dt className="text-text-3">Último deploy</dt>
          <dd className="m-0 text-text-1">
            {deploy ? <time dateTime={deploy.at} title={new Date(deploy.at).toLocaleString('pt-PT')}>{relativeDeploy(deploy.at)}</time> : <span className="text-text-3">—</span>}
          </dd>
        </dl>
      ) : (
        <p className="m-0 text-[13px] text-text-3">Sem informação</p>
      )}
    </article>
  );
}
