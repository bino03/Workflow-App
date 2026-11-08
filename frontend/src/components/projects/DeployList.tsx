import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import type { Deploy, Environment } from '@/types/projectInfo';
import { formatDeployDate, relativeDeploy } from './projectInfoFormat';

type DeployListProps = {
  environment: Environment;
  onRegister: (environment: Environment) => void;
  onRemove: (environment: Environment, deploy: Deploy) => void;
};

/** Os deploys registados à mão de um ambiente, mais recente primeiro, com **Registar deploy** (spec informacao-dos-projetos §4.4). */
export function DeployList({ environment, onRegister, onRemove }: DeployListProps) {
  return (
    <div className="flex flex-col gap-2 pt-3 border-t border-border">
      <div className="flex items-center gap-2">
        <h5 className="m-0 flex-1 text-[12.5px] font-medium text-text-3">Deploys</h5>
        <Button size="small" icon={<PlusOutlined />} onClick={() => onRegister(environment)}>
          Registar deploy
        </Button>
      </div>
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
                  {deploy.version && <span className="tag h-5 px-[7px] text-[11.5px] font-mono">{deploy.version}</span>}
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
