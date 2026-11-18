import { DeleteOutlined, ExclamationCircleOutlined, PlusOutlined, SyncOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import type { Deploy, Environment, GitWarningReason } from '@/types/projectInfo';
import { formatDeployDate, relativeDeploy } from './projectInfoFormat';

type DeployListProps = {
  environment: Environment;
  onRegister: (environment: Environment) => void;
  onRemove: (environment: Environment, deploy: Deploy) => void;
  /** Porque é que o último sync do git não deu topo a este ambiente, ou null. */
  gitWarning: GitWarningReason | null;
  syncing: boolean;
  onSyncGit: () => void;
};

const GIT_WARNING: Record<GitWarningReason, (branch: string) => string> = {
  'no-git': () => 'O git não foi encontrado nesta máquina (GIT_BIN).',
  'no-repo': () => 'A pasta do projeto não está num repositório git.',
  'outside-roots': () => 'A raiz do repositório fica fora das pastas permitidas.',
  'no-remote': () => 'O repositório não tem o remote origin.',
  'no-branch': (branch) => `A branch ${branch} não existe no origin.`,
  'fetch-failed': () => 'Não deu para ir ao origin — credenciais, rede ou outro git a correr.',
  timeout: () => 'O git demorou demasiado a responder.',
};

/**
 * Os deploys de um ambiente, mais recente primeiro, com **Registar deploy** (spec informacao-dos-projetos §4.4) e, com
 * branch de deploy, **Atualizar do git** e o aviso discreto do último sync (ADR 0034).
 */
export function DeployList({ environment, onRegister, onRemove, gitWarning, syncing, onSyncGit }: DeployListProps) {
  return (
    <div className="flex flex-col gap-2 pt-3 border-t border-border">
      <div className="flex items-center gap-2">
        <h5 className="m-0 flex-1 text-[12.5px] font-medium text-text-3">Deploys</h5>
        {environment.deployBranch && (
          <Button size="small" icon={<SyncOutlined />} loading={syncing} onClick={onSyncGit}>
            Atualizar do git
          </Button>
        )}
        <Button size="small" icon={<PlusOutlined />} onClick={() => onRegister(environment)}>
          Registar deploy
        </Button>
      </div>
      {environment.deployBranch && gitWarning && (
        <p className="m-0 flex items-center gap-1.5 text-[12px] text-text-3" role="status">
          <ExclamationCircleOutlined aria-hidden />
          {GIT_WARNING[gitWarning](environment.deployBranch)}
        </p>
      )}
      {environment.deploys.length === 0 ? (
        <p className="m-0 text-[13px] text-text-3">Nenhum deploy registado.</p>
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col" aria-label={`Deploys de ${environment.name}`}>
          {environment.deploys.map((deploy) => (
            <li key={deploy.id} className="flex items-start gap-3 py-1.5 border-b border-border last:border-b-0 text-[13px]">
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <time dateTime={deploy.at} className="text-text-1">
                    {formatDeployDate(deploy.at)}
                  </time>
                  <span className="text-[12px] text-text-3">{relativeDeploy(deploy.at)}</span>
                  {deploy.version && (
                    <span className="tag h-5 px-[7px] text-[11.5px] font-mono" title={deploy.commit ?? undefined}>
                      {deploy.version}
                    </span>
                  )}
                  {deploy.source === 'git' && <span className="tag h-5 px-[7px] text-[11.5px]">git</span>}
                </div>
                {deploy.note && <span className="text-text-2 break-words">{deploy.note}</span>}
              </div>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label={`Apagar o deploy de ${formatDeployDate(deploy.at)}`}
                onClick={() => onRemove(environment, deploy)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
