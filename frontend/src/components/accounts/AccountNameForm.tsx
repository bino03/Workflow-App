import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input } from 'antd';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FieldError } from '@/components/common/FieldError';
import { ErrorHandler } from '@/errors/errorHandler';
import { accountFormSchema, type AccountFormValues } from './accountFormSchema';

type AccountNameFormProps = {
  initialLabel?: string;
  submitLabel: string;
  hint?: string;
  /** Lança o erro da API: fica no formulário, ao lado do nome que o causou. */
  onSubmit: (label: string) => Promise<void>;
  onCancel: () => void;
};

/** O nome de uma conta, ao adicionar e ao renomear. */
export function AccountNameForm({ initialLabel = '', submitLabel, hint, onSubmit, onCancel }: AccountNameFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    mode: 'onChange',
    defaultValues: { label: initialLabel },
  });

  const submit = async ({ label }: AccountFormValues) => {
    setSubmitError(null);
    try {
      await onSubmit(label);
    } catch (error) {
      ErrorHandler.handle(error, { showNotification: false });
      setSubmitError(ErrorHandler.getMessage(error));
    }
  };

  return (
    <form className="flex flex-col card p-4" onSubmit={handleSubmit(submit)} noValidate data-account-form>
      <label htmlFor="account-label" className="text-[13px] text-text-2 mb-1.5">
        Nome da conta
      </label>
      <Controller
        name="label"
        control={control}
        render={({ field }) => (
          <Input
            {...field}
            id="account-label"
            autoFocus
            placeholder="Trabalho"
            maxLength={40}
            status={errors.label ? 'error' : undefined}
            aria-invalid={errors.label ? true : undefined}
            aria-describedby={errors.label ? 'account-label-error' : undefined}
          />
        )}
      />
      <FieldError id="account-label-error" name="label" errors={errors} />
      <FieldError id="account-submit-error" message={submitError} />

      <div className="flex items-center gap-2">
        {hint && <span className="text-[12px] text-text-3">{hint}</span>}
        <span className="flex-1" />
        <Button onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="primary" htmlType="submit" loading={isSubmitting} disabled={!isValid}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
