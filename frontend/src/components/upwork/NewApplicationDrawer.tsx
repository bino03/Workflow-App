import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Drawer, Input, Space } from 'antd';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FieldError } from '@/components/common/FieldError';
import { DRAWER_WIDTH } from '@/config/drawer';
import type { ApiFieldError } from '@/errors/error.types';
import { ErrorHandler } from '@/errors/errorHandler';
import { notificationService } from '@/services/general/notificationService';
import { createApplication } from '@/services/upworkService';
import type { ApplicationView } from '@/types/upwork';
import {
  NEW_APPLICATION_DEFAULTS,
  newApplicationFormSchema,
  screeningLines,
  type NewApplicationFormValues,
} from './upworkFormSchemas';

type NewApplicationDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** A candidatura acabada de criar, já a gerar — a página abre-a. */
  onCreated: (application: ApplicationView) => void;
  /** O backend diz que não há perfil (UPWORK_002): a página leva ao Perfil. */
  onProfileMissing: () => void;
};

/**
 * Nova candidatura (spec upwork §2): o anúncio colado, as perguntas de triagem e o link do job. O link fica só
 * guardado para o dono abrir — nem a app nem a skill o abrem (ADR 0022). Gerar arranca o `/upwork-proposal`.
 */
export function NewApplicationDrawer({ open, onClose, onCreated, onProfileMissing }: NewApplicationDrawerProps) {
  const form = useForm<NewApplicationFormValues>({
    resolver: zodResolver(newApplicationFormSchema),
    mode: 'onChange',
    defaultValues: NEW_APPLICATION_DEFAULTS,
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid, isSubmitting },
  } = form;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ApiFieldError[]>([]);

  // Todo o fecho passa por aqui (Cancelar, ✕, Esc, máscara, sucesso) — forms-and-validation §4.1.
  const close = () => {
    reset(NEW_APPLICATION_DEFAULTS);
    setSubmitError(null);
    setFieldErrors([]);
    onClose();
  };

  const onSubmit = async (values: NewApplicationFormValues) => {
    setSubmitError(null);
    setFieldErrors([]);
    try {
      const application = await createApplication({
        job: values.job,
        screeningQuestions: screeningLines(values.screening),
        url: values.url || null,
      });
      notificationService.success('Candidatura a gerar', 'A análise e a carta aparecem aqui em menos de um minuto.');
      onCreated(application);
      close();
    } catch (e) {
      const data = ErrorHandler.handle(e, { showNotification: false });
      if (data?.errorCode === 'UPWORK_002') {
        // Sem perfil não há prova para a carta: o que se colou fica, e o Perfil abre por cima.
        onProfileMissing();
        return;
      }
      setSubmitError(ErrorHandler.getMessage(e));
      setFieldErrors(data?.fieldErrors ?? []);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      size={DRAWER_WIDTH.medium}
      extra={<span className="kbd">Esc</span>}
      title={
        <div className="flex flex-col gap-1">
          <h6 className="kicker m-0">Upwork</h6>
          <h2 className="m-0 text-[20px] leading-[26px] font-semibold text-text-1">Nova candidatura</h2>
        </div>
      }
      footer={
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-text-3">Corre a skill /upwork-proposal do Workflow</span>
          <span className="flex-1" />
          <Space>
            <Button onClick={close} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="primary" loading={isSubmitting} disabled={!isValid} onClick={() => void handleSubmit(onSubmit)()}>
              Gerar
            </Button>
          </Space>
        </div>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={(event) => event.preventDefault()} noValidate>
        <p className="m-0 text-[13.5px] leading-[21px] text-text-2">
          Copia o anúncio da Upwork e cola-o aqui. Recebes a análise "vale a pena?", a carta, as respostas de triagem, o
          plano técnico e perguntas ao cliente — tu revês e envias lá.
        </p>

        <div className="flex flex-col">
          <label htmlFor="upwork-job" className="text-[12.5px] text-text-3 mb-1.5">
            Anúncio
          </label>
          <Controller
            name="job"
            control={control}
            render={({ field }) => (
              <Input.TextArea
                {...field}
                id="upwork-job"
                disabled={isSubmitting}
                autoSize={{ minRows: 10, maxRows: 22 }}
                maxLength={20_000}
                placeholder="O título, a descrição, o orçamento, o nível de experiência…"
                status={errors.job ? 'error' : undefined}
                aria-describedby="upwork-job-error"
              />
            )}
          />
          <FieldError id="upwork-job-error" name="job" errors={errors} />
        </div>

        <div className="flex flex-col">
          <label htmlFor="upwork-screening" className="text-[12.5px] text-text-3 mb-1.5">
            Perguntas de triagem · opcional, uma por linha
          </label>
          <Controller
            name="screening"
            control={control}
            render={({ field }) => (
              <Input.TextArea
                {...field}
                id="upwork-screening"
                disabled={isSubmitting}
                autoSize={{ minRows: 3, maxRows: 10 }}
                placeholder="Describe your recent experience with similar projects"
                status={errors.screening ? 'error' : undefined}
                aria-describedby="upwork-screening-error"
              />
            )}
          />
          <FieldError id="upwork-screening-error" name="screening" errors={errors} />
        </div>

        <div className="flex flex-col">
          <label htmlFor="upwork-url" className="text-[12.5px] text-text-3 mb-1.5">
            Link do job · opcional, só para ti
          </label>
          <Controller
            name="url"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="upwork-url"
                disabled={isSubmitting}
                maxLength={2000}
                placeholder="https://www.upwork.com/jobs/…"
                status={errors.url ? 'error' : undefined}
                aria-describedby="upwork-url-error"
              />
            )}
          />
          <FieldError id="upwork-url-error" name="url" errors={errors} />
        </div>

        {submitError && (
          <Alert
            type="error"
            showIcon
            title={submitError}
            description={
              fieldErrors.length > 0 && (
                <ul className="m-0 pl-4">
                  {fieldErrors.map(({ field, message }) => (
                    <li key={`${field}-${message}`}>
                      <span className="font-mono text-[12px]">{field}</span>: {message}
                    </li>
                  ))}
                </ul>
              )
            }
          />
        )}
      </form>
    </Drawer>
  );
}
