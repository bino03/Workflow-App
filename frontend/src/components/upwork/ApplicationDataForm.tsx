import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Input, InputNumber, Select } from 'antd';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { FieldError } from '@/components/common/FieldError';
import { APPLICATION_STATUSES, STATUS_TAG, formatDateTime } from '@/components/upwork/upworkFormat';
import { ErrorHandler } from '@/errors/errorHandler';
import { notificationService } from '@/services/general/notificationService';
import { updateApplication } from '@/services/upworkService';
import type { ApplicationChanges, ApplicationView } from '@/types/upwork';
import { applicationDataFormSchema, type ApplicationDataFormValues } from './upworkFormSchemas';

const STATUS_OPTIONS = APPLICATION_STATUSES.map((status) => ({ value: status, label: STATUS_TAG[status].label }));

function valuesOf(application: ApplicationView): ApplicationDataFormValues {
  return {
    status: application.status,
    clientName: application.clientName ?? '',
    connectsSpent: application.connectsSpent,
    url: application.url ?? '',
    notes: application.notes,
  };
}

type ApplicationDataFormProps = {
  application: ApplicationView;
  onSaved: (application: ApplicationView) => void;
};

/**
 * Separador Dados (spec upwork §4.4): o estado com o histórico, o cliente, os Connects, o link e as notas — tudo à
 * mão, porque a app não vê o que acontece na Upwork. Só os campos mudados vão no PATCH.
 */
export function ApplicationDataForm({ application, onSaved }: ApplicationDataFormProps) {
  const form = useForm<ApplicationDataFormValues>({
    resolver: zodResolver(applicationDataFormSchema),
    mode: 'onChange',
    values: valuesOf(application),
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid, isDirty, isSubmitting, dirtyFields },
  } = form;
  const status = useWatch({ control, name: 'status' });
  const readOnly = application.archived;
  const pausesSession = status === 'sent' && application.status !== 'sent' && application.guided !== null && application.guided.status !== 'stopped';

  const onSubmit = async (values: ApplicationDataFormValues) => {
    const changes: ApplicationChanges = {};
    if (dirtyFields.status) changes.status = values.status;
    if (dirtyFields.clientName) changes.clientName = values.clientName.trim() || null;
    if (dirtyFields.connectsSpent) changes.connectsSpent = values.connectsSpent;
    if (dirtyFields.url) changes.url = values.url.trim() || null;
    if (dirtyFields.notes) changes.notes = values.notes;
    try {
      const updated = await updateApplication(application.id, changes);
      notificationService.success('Candidatura atualizada');
      onSaved(updated);
    } catch (e) {
      ErrorHandler.handle(e);
    }
  };

  const label = (htmlFor: string, text: string) => (
    <label htmlFor={htmlFor} className="text-[12.5px] text-text-3 mb-1.5">
      {text}
    </label>
  );

  return (
    <form className="flex flex-col gap-5 max-w-[560px]" onSubmit={(event) => event.preventDefault()} noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col">
          {label('upwork-status', 'Estado')}
          <Controller
            name="status"
            control={control}
            render={({ field }) => <Select {...field} id="upwork-status" options={STATUS_OPTIONS} disabled={readOnly || isSubmitting} />}
          />
        </div>
        <div className="flex flex-col">
          {label('upwork-connects', 'Connects gastos')}
          <Controller
            name="connectsSpent"
            control={control}
            render={({ field }) => (
              <InputNumber
                {...field}
                id="upwork-connects"
                className="w-full"
                min={0}
                max={500}
                precision={0}
                disabled={readOnly || isSubmitting}
                status={errors.connectsSpent ? 'error' : undefined}
                aria-describedby="upwork-connects-error"
              />
            )}
          />
          <FieldError id="upwork-connects-error" name="connectsSpent" errors={errors} />
        </div>
      </div>

      {pausesSession && (
        <Alert type="info" showIcon title="Marcar Enviada pausa a sessão" description="O terminal fecha; escrever na Conversa retoma-a quando o cliente responder." />
      )}

      <div className="flex flex-col">
        {label('upwork-client', 'Cliente')}
        <Controller
          name="clientName"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              id="upwork-client"
              maxLength={200}
              disabled={readOnly || isSubmitting}
              status={errors.clientName ? 'error' : undefined}
              aria-describedby="upwork-client-error"
            />
          )}
        />
        <FieldError id="upwork-client-error" name="clientName" errors={errors} />
      </div>

      <div className="flex flex-col">
        {label('upwork-data-url', 'Link do job')}
        <div className="flex gap-2">
          <Controller
            name="url"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="upwork-data-url"
                maxLength={2000}
                placeholder="https://www.upwork.com/jobs/…"
                disabled={readOnly || isSubmitting}
                status={errors.url ? 'error' : undefined}
                aria-describedby="upwork-data-url-error"
              />
            )}
          />
          {application.url && (
            // Abre-o o dono, no browser dele — a app nunca o pede (ADR 0022).
            <Button href={application.url} target="_blank" rel="noopener noreferrer">
              Abrir
            </Button>
          )}
        </div>
        <FieldError id="upwork-data-url-error" name="url" errors={errors} />
      </div>

      <div className="flex flex-col">
        {label('upwork-notes', 'Notas')}
        <Controller
          name="notes"
          control={control}
          render={({ field }) => (
            <Input.TextArea
              {...field}
              id="upwork-notes"
              autoSize={{ minRows: 3, maxRows: 12 }}
              maxLength={8000}
              disabled={readOnly || isSubmitting}
              status={errors.notes ? 'error' : undefined}
              aria-describedby="upwork-notes-error"
            />
          )}
        />
        <FieldError id="upwork-notes-error" name="notes" errors={errors} />
      </div>

      {!readOnly && (
        <div className="flex justify-end gap-2">
          <Button disabled={!isDirty || isSubmitting} onClick={() => reset(valuesOf(application))}>
            Desfazer
          </Button>
          <Button type="primary" loading={isSubmitting} disabled={!isValid || !isDirty} onClick={() => void handleSubmit(onSubmit)()}>
            Gravar
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="kicker">Histórico</span>
        <ol className="m-0 p-0 list-none flex flex-col gap-1.5" aria-label="Histórico do estado">
          {[...application.history].reverse().map((entry) => (
            <li key={`${entry.status}-${entry.at}`} className="flex items-center gap-3">
              <span className={STATUS_TAG[entry.status].className}>{STATUS_TAG[entry.status].label}</span>
              <span className="font-mono text-[12px] text-text-3">{formatDateTime(entry.at)}</span>
            </li>
          ))}
        </ol>
      </div>
    </form>
  );
}
