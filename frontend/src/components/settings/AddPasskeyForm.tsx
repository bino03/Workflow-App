import { zodResolver } from '@hookform/resolvers/zod';
import { startRegistration } from '@simplewebauthn/browser';
import { Button, Input } from 'antd';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FieldError } from '@/components/common/FieldError';
import { ErrorHandler, getApiErrorResponse } from '@/errors/errorHandler';
import { getPasskeyErrorMessage } from '@/errors/passkeyErrors';
import { notificationService } from '@/services/general/notificationService';
import * as passkeyService from '@/services/passkeyService';
import type { PasskeySummary } from '@/types/auth';
import { addPasskeyFormSchema, type AddPasskeyFormValues } from './addPasskeyFormSchema';

type AddPasskeyFormProps = {
  onAdded: (passkey: PasskeySummary) => void;
  onCancel: () => void;
};

/**
 * Registar uma passkey neste dispositivo: a password outra vez (uma sessão roubada não chega, ADR
 * 0015), depois o Face ID / Windows Hello do browser. Os erros ficam no formulário, nunca em toast.
 */
export function AddPasskeyForm({ onAdded, onCancel }: AddPasskeyFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<AddPasskeyFormValues>({
    resolver: zodResolver(addPasskeyFormSchema),
    mode: 'onChange',
    defaultValues: { name: '', password: '' },
  });
  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
  } = form;

  const onSubmit = async ({ name, password }: AddPasskeyFormValues) => {
    setSubmitError(null);
    try {
      const optionsJSON = await passkeyService.getRegistrationOptions(password);
      const passkey = await passkeyService.registerPasskey(name, await startRegistration({ optionsJSON }));
      notificationService.success('Passkey registada', `"${passkey.name}" já pode ser usada para entrar.`);
      onAdded(passkey);
    } catch (error) {
      ErrorHandler.handle(error, { showNotification: false });
      if (getApiErrorResponse(error)?.errorCode === 'AUTH_006') {
        form.resetField('password');
        form.setError('password', { message: ErrorHandler.getMessage(error) });
        form.setFocus('password');
        return;
      }
      setSubmitError(getPasskeyErrorMessage(error));
    }
  };

  return (
    <form className="flex flex-col card p-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <label htmlFor="passkey-name" className="text-[13px] text-text-2 mb-1.5">
        Nome
      </label>
      <Controller
        name="name"
        control={control}
        render={({ field }) => (
          <Input
            {...field}
            id="passkey-name"
            autoFocus
            placeholder="iPhone"
            maxLength={64}
            status={errors.name ? 'error' : undefined}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'passkey-name-error' : undefined}
          />
        )}
      />
      <FieldError id="passkey-name-error" name="name" errors={errors} />

      <label htmlFor="passkey-password" className="text-[13px] text-text-2 mb-1.5">
        Password atual
      </label>
      <Controller
        name="password"
        control={control}
        render={({ field }) => (
          <Input.Password
            {...field}
            id="passkey-password"
            autoComplete="current-password"
            status={errors.password ? 'error' : undefined}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? 'passkey-password-error' : undefined}
          />
        )}
      />
      <FieldError id="passkey-password-error" name="password" errors={errors} />
      <FieldError id="passkey-submit-error" message={submitError} />

      <div className="flex items-center gap-2">
        <span className="text-[12px] text-text-3">O browser pede o Face ID, Touch ID ou Windows Hello.</span>
        <span className="flex-1" />
        <Button onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="primary" htmlType="submit" loading={isSubmitting} disabled={!isValid}>
          Registar
        </Button>
      </div>
    </form>
  );
}
