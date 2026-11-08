import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Modal } from 'antd';
import { Controller, useForm } from 'react-hook-form';
import { FieldError } from '@/components/common/FieldError';
import type { DeployInput } from '@/types/projectInfo';
import { MAX_DEPLOYS_PER_ENVIRONMENT } from './projectInfoFormat';
import { deployFormSchema, nowForInput, toDeployInput, type DeployFormValues } from './projectInfoFormSchema';

type RegisterDeployModalProps = {
  environmentName: string;
  /** Quantos deploys o ambiente já tem: no limite, o mais antigo sai. */
  deployCount: number;
  onClose: () => void;
  /** `true` se gravou (o erro, se houve, já foi notificado). */
  onRegister: (deploy: DeployInput) => Promise<boolean>;
};

/**
 * Registar um deploy à mão: a data é "agora" (editável), a versão e a nota são opcionais. Um utilitário de um
 * dado, por isso um Modal e não um Drawer (drawers-and-modals.md). Monta-se a cada abertura: o formulário nasce limpo.
 */
export function RegisterDeployModal({ environmentName, deployCount, onClose, onRegister }: RegisterDeployModalProps) {
  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
  } = useForm<DeployFormValues>({
    resolver: zodResolver(deployFormSchema),
    mode: 'onChange',
    defaultValues: { at: nowForInput(), version: '', note: '' },
  });

  const submit = async (values: DeployFormValues) => {
    if (await onRegister(toDeployInput(values))) onClose();
  };

  return (
    <Modal
      open
      onCancel={onClose}
      width="min(640px, 94vw)"
      title={
        <>
          Registar deploy — <span className="font-mono">{environmentName}</span>
        </>
      }
      footer={
        <div className="flex items-center gap-2">
          <span className="flex-1 text-left text-[12px] text-text-3">
            {deployCount >= MAX_DEPLOYS_PER_ENVIRONMENT ? `Há ${MAX_DEPLOYS_PER_ENVIRONMENT} deploys: o mais antigo sai.` : 'A data é a que indicares — a app não a lê do git nem do hosting.'}
          </span>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="primary" loading={isSubmitting} disabled={!isValid} onClick={() => void handleSubmit(submit)()}>
            Registar deploy
          </Button>
        </div>
      }
    >
      <form className="flex flex-col gap-3" onSubmit={(event) => event.preventDefault()} noValidate>
        <div className="flex flex-col">
          <label htmlFor="deploy-at" className="text-[12.5px] text-text-3 mb-1.5">
            Data e hora
          </label>
          <Controller
            name="at"
            control={control}
            render={({ field }) => <Input {...field} id="deploy-at" type="datetime-local" status={errors.at ? 'error' : undefined} aria-describedby="deploy-at-error" className="max-w-[260px]" />}
          />
          <FieldError id="deploy-at-error" name="at" errors={errors} />
        </div>
        <div className="flex flex-col">
          <label htmlFor="deploy-version" className="text-[12.5px] text-text-3 mb-1.5">
            Versão (opcional)
          </label>
          <Controller
            name="version"
            control={control}
            render={({ field }) => <Input {...field} id="deploy-version" className="font-mono text-[12.5px]" status={errors.version ? 'error' : undefined} aria-describedby="deploy-version-error" />}
          />
          <FieldError id="deploy-version-error" name="version" errors={errors} />
        </div>
        <div className="flex flex-col">
          <label htmlFor="deploy-note" className="text-[12.5px] text-text-3 mb-1.5">
            Nota (opcional)
          </label>
          <Controller
            name="note"
            control={control}
            render={({ field }) => <Input {...field} id="deploy-note" maxLength={280} status={errors.note ? 'error' : undefined} aria-describedby="deploy-note-error" />}
          />
          <FieldError id="deploy-note-error" name="note" errors={errors} />
        </div>
      </form>
    </Modal>
  );
}
