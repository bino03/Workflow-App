import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Drawer, Space } from 'antd';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { DRAWER_WIDTH } from '@/config/drawer';
import { useConfirm } from '@/hooks/useConfirm';
import type { ProjectEntry } from '@/types/project';
import type { Deploy, DeployInput, Environment, ProjectInfo, ProjectInfoInput } from '@/types/projectInfo';
import { hostingOptions } from './hosting';
import { formatDeployDate } from './projectInfoFormat';
import { RegisterDeployModal } from './RegisterDeployModal';
import { ProjectInfoDetails } from './ProjectInfoDetails';
import { ProjectInfoForm } from './ProjectInfoForm';
import { projectInfoFormSchema, toFormValues, toProjectInfoInput, type ProjectInfoFormValues } from './projectInfoFormSchema';

type ProjectInfoDrawerProps = {
  open: boolean;
  project: ProjectEntry | null;
  /** A ficha gravada deste projeto, se já tem. */
  info: ProjectInfo | undefined;
  /** Todas as fichas — dão ao campo Hosting os fornecedores já usados. */
  infos: readonly ProjectInfo[];
  /** Abre já em edição (o botão "Adicionar informação" do cartão). */
  startEditing: boolean;
  onClose: () => void;
  /** A ficha nova, ou `null` se falhou (o erro já foi notificado). */
  onSave: (projectPath: string, input: ProjectInfoInput) => Promise<ProjectInfo | null>;
  onRemove: (projectPath: string) => Promise<boolean>;
  /** A ficha nova, ou `null` se falhou (o erro já foi notificado). */
  onRegisterDeploy: (projectPath: string, environmentId: string, deploy: DeployInput) => Promise<ProjectInfo | null>;
  onRemoveDeploy: (projectPath: string, environmentId: string, deployId: string) => Promise<ProjectInfo | null>;
};

/**
 * A ficha de um projeto: leitura, e **Editar** troca-a pelo formulário no mesmo drawer. O `useForm` vive aqui
 * (segue a ficha por `values`, sem efeitos) para o rodapé poder gravar; o que não se gravou perde-se ao fechar.
 */
export function ProjectInfoDrawer({ open, project, info, infos, startEditing, onClose, onSave, onRemove, onRegisterDeploy, onRemoveDeploy }: ProjectInfoDrawerProps) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState(startEditing);
  // O ambiente a que se está a registar um deploy (o modal monta-se a cada abertura).
  const [deployTarget, setDeployTarget] = useState<Environment | null>(null);
  const saved = useMemo(() => toFormValues(info), [info]);
  const hostings = useMemo(() => hostingOptions(infos), [infos]);
  const form = useForm<ProjectInfoFormValues>({ resolver: zodResolver(projectInfoFormSchema), mode: 'onChange', values: saved });
  const {
    handleSubmit,
    reset,
    formState: { isValid, isDirty, isSubmitting },
  } = form;

  // Todo o fecho passa por aqui (Fechar, ✕, Esc, máscara) — forms-and-validation §4.1.
  const close = () => {
    reset(saved);
    setEditing(false);
    onClose();
  };

  const cancelEditing = () => {
    reset(saved);
    setEditing(false);
  };

  const submit = async (values: ProjectInfoFormValues) => {
    if (!project) return;
    const updated = await onSave(project.path, toProjectInfoInput(values));
    if (updated) setEditing(false);
  };

  const removeSheet = () => {
    if (!project) return;
    confirm({
      title: 'Apagar a ficha?',
      actionLabel: 'Apagar ficha',
      message: 'Apaga o ciclo de vida, os ambientes, os deploys e as notas deste projeto. O projeto em si não é tocado.',
      onConfirm: async () => {
        if (await onRemove(project.path)) close();
      },
    });
  };

  const removeDeploy = (environment: Environment, deploy: Deploy) => {
    if (!project) return;
    confirm({
      title: 'Apagar o deploy?',
      actionLabel: 'Apagar deploy',
      message: `O deploy de ${formatDeployDate(deploy.at)}${deploy.version ? ` (${deploy.version})` : ''} sai do histórico de ${environment.name}.`,
      onConfirm: async () => {
        await onRemoveDeploy(project.path, environment.id, deploy.id);
      },
    });
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      size={DRAWER_WIDTH.large}
      extra={<span className="kbd">Esc</span>}
      title={
        <div className="flex flex-col gap-1 min-w-0">
          <h6 className="kicker m-0">Projeto</h6>
          <h2 className="m-0 text-[20px] leading-[26px] font-semibold text-text-1 truncate">{project?.name}</h2>
          <span className="font-mono text-[11.5px] font-normal text-text-3 truncate">{project?.path}</span>
        </div>
      }
      footer={
        editing ? (
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-text-3">Fica só nesta máquina — a app nunca chama estes endereços</span>
            <span className="flex-1" />
            <Space>
              <Button onClick={cancelEditing} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="primary" loading={isSubmitting} disabled={!isValid || !isDirty} onClick={() => void handleSubmit(submit)()}>
                Guardar
              </Button>
            </Space>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {info && (
              <Button type="text" danger onClick={removeSheet}>
                Apagar ficha
              </Button>
            )}
            <span className="flex-1" />
            <Space>
              <Button onClick={close}>Fechar</Button>
              <Button type="primary" onClick={() => setEditing(true)}>
                Editar
              </Button>
            </Space>
          </div>
        )
      }
    >
      {editing ? (
        <ProjectInfoForm form={form} hostingSuggestions={hostings} disabled={isSubmitting} />
      ) : (
        <ProjectInfoDetails info={info} onRegisterDeploy={setDeployTarget} onRemoveDeploy={removeDeploy} />
      )}
      {deployTarget && project && (
        // O modal faz portal para o <body>; vive aqui para desaparecer com o drawer.
        <RegisterDeployModal
          environmentName={deployTarget.name}
          deployCount={info?.environments.find((environment) => environment.id === deployTarget.id)?.deploys.length ?? 0}
          onClose={() => setDeployTarget(null)}
          onRegister={async (deploy) => (await onRegisterDeploy(project.path, deployTarget.id, deploy)) !== null}
        />
      )}
    </Drawer>
  );
}
