import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Modal } from 'antd';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { FieldError } from '@/components/common/FieldError';
import { ErrorHandler } from '@/errors/errorHandler';
import { createProjectFromApplication } from '@/services/upworkService';
import { createProjectFormSchema, type CreateProjectFormValues } from './upworkFormSchemas';

type CreateProjectModalProps = {
  applicationId: string | null;
  onClose: () => void;
};

/**
 * Criar projeto a partir de uma candidatura ganha (spec upwork §2): um utilitário de um campo — o acordo colado —,
 * por isso Modal. O backend junta anúncio + carta + plano + acordo no brief e começa a criação no Novo projeto.
 */
export function CreateProjectModal({ applicationId, onClose }: CreateProjectModalProps) {
  const navigate = useNavigate();
  const form = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectFormSchema),
    mode: 'onChange',
    defaultValues: { agreement: '' },
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid, isSubmitting },
  } = form;

  const close = () => {
    reset({ agreement: '' });
    onClose();
  };

  const onSubmit = async ({ agreement }: CreateProjectFormValues) => {
    if (!applicationId) return;
    try {
      await createProjectFromApplication(applicationId, agreement);
      close();
      void navigate('/new-project');
    } catch (e) {
      ErrorHandler.handle(e);
    }
  };

  return (
    <Modal
      open={applicationId !== null}
      onCancel={close}
      width="min(640px, 94vw)"
      title="Criar projeto"
      footer={
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-text-3">Abre o Novo projeto com o /create do Workflow</span>
          <span className="flex-1" />
          <Button onClick={close} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="primary" loading={isSubmitting} disabled={!isValid} onClick={() => void handleSubmit(onSubmit)()}>
            Criar projeto
          </Button>
        </div>
      }
    >
      <form className="flex flex-col gap-3" onSubmit={(event) => event.preventDefault()} noValidate>
        <p className="m-0 text-[13.5px] leading-[21px] text-text-2">
          Cola o que ficou combinado com o cliente: a oferta, o âmbito, as milestones e as mensagens que mudaram alguma coisa.
          O anúncio, a carta e o plano já vão no brief.
        </p>
        <Controller
          name="agreement"
          control={control}
          render={({ field }) => (
            <Input.TextArea
              {...field}
              id="upwork-agreement"
              aria-label="Acordo"
              autoSize={{ minRows: 8, maxRows: 18 }}
              maxLength={20_000}
              disabled={isSubmitting}
              status={errors.agreement ? 'error' : undefined}
              aria-describedby="upwork-agreement-error"
            />
          )}
        />
        <FieldError id="upwork-agreement-error" name="agreement" errors={errors} />
      </form>
    </Modal>
  );
}
