import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input } from 'antd';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { FieldError } from '@/components/common/FieldError';
import { Wordmark } from '@/components/common/Wordmark';
import { ErrorHandler } from '@/errors/errorHandler';
import { useAuth } from '@/hooks/useAuth';
import { loginFormSchema, type LoginFormValues } from './loginFormSchema';

const DEFAULT_ROUTE = '/terminals';

function redirectTarget(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === 'string' && from.startsWith('/') && from !== '/login' ? from : DEFAULT_ROUTE;
}

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    mode: 'onChange',
    defaultValues: { password: '' },
  });
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  if (status === 'authenticated') return <Navigate to={redirectTarget(location.state)} replace />;

  const onSubmit = async ({ password }: LoginFormValues) => {
    setSubmitError(null);
    try {
      await login(password);
      navigate(redirectTarget(location.state), { replace: true });
    } catch (error) {
      // Todos os erros do login mostram-se aqui, por baixo do campo — nunca em toast.
      ErrorHandler.handle(error, { showNotification: false });
      setSubmitError(ErrorHandler.getMessage(error));
      form.resetField('password');
      form.setFocus('password');
    }
  };

  const errorText = submitError ?? errors.password?.message;

  return (
    <div className="h-full flex items-center justify-center bg-bg">
      <form className="w-[360px] flex flex-col" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Wordmark size="login" />
        <div className="kicker mt-10">Acesso restrito</div>
        <h1 className="text-display m-0 mt-1 mb-6">Entrar</h1>

        <label htmlFor="password" className="text-[13px] text-text-2 mb-1.5">
          Password
        </label>
        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <Input.Password
              {...field}
              id="password"
              autoFocus
              autoComplete="current-password"
              status={errorText ? 'error' : undefined}
              aria-invalid={errorText ? true : undefined}
              aria-describedby={errorText ? 'password-error' : undefined}
              className="h-10"
              onChange={(event) => {
                setSubmitError(null);
                field.onChange(event);
              }}
            />
          )}
        />
        <FieldError id="password-error" message={errorText} />

        <Button type="primary" htmlType="submit" block loading={isSubmitting} className="mt-2 h-10">
          Entrar
        </Button>
      </form>
    </div>
  );
}
