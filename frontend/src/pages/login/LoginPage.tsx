import { KeyOutlined } from '@ant-design/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  type AuthenticationResponseJSON,
  WebAuthnAbortService,
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  startAuthentication,
} from '@simplewebauthn/browser';
import { Button, Input } from 'antd';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { FieldError } from '@/components/common/FieldError';
import { Wordmark } from '@/components/common/Wordmark';
import { ErrorHandler } from '@/errors/errorHandler';
import { getPasskeyErrorMessage } from '@/errors/passkeyErrors';
import { useAuth } from '@/hooks/useAuth';
import * as passkeyService from '@/services/passkeyService';
import { loginFormSchema, type LoginFormValues } from './loginFormSchema';

const DEFAULT_ROUTE = '/terminals';

function redirectTarget(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === 'string' && from.startsWith('/') && from !== '/login' ? from : DEFAULT_ROUTE;
}

export function LoginPage() {
  const { status, login, loginWithPasskey } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeyPending, setPasskeyPending] = useState(false);
  // Sobe depois de uma tentativa falhada com uma passkey escolhida, para voltar a armar o autofill.
  const [autofillRound, setAutofillRound] = useState(0);
  const passkeysSupported = browserSupportsWebAuthn();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    mode: 'onChange',
    defaultValues: { username: '', password: '' },
  });
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  // Autofill (pedido condicional, ADR 0015): o browser oferece a passkey no campo do nome. Fica à
  // espera até ser escolhida; o botão "Entrar com passkey" aborta-o e começa um pedido modal.
  useEffect(() => {
    if (status !== 'anonymous') return;
    let active = true;
    (async () => {
      if (!(await browserSupportsWebAuthnAutofill())) return;
      let response: AuthenticationResponseJSON;
      try {
        const optionsJSON = await passkeyService.getLoginOptions();
        if (!active) return;
        response = await startAuthentication({ optionsJSON, useBrowserAutofill: true });
      } catch (error) {
        // Sem opções (rate limit, rede) ou o browser recusou o pedido condicional: o autofill fica
        // desligado em silêncio — o botão continua lá. Voltar a armá-lo aqui era um ciclo de pedidos
        // até ao rate limit (visto em headless, onde o pedido condicional falha logo).
        ErrorHandler.handle(error, { showNotification: false });
        return;
      }
      try {
        await loginWithPasskey(response);
        navigate(redirectTarget(location.state), { replace: true });
      } catch (error) {
        if (!active) return;
        ErrorHandler.handle(error, { showNotification: false });
        setPasskeyError(getPasskeyErrorMessage(error));
        // O utilizador escolheu mesmo uma passkey: vale a pena voltar a oferecer.
        setAutofillRound((round) => round + 1);
      }
    })();
    return () => {
      active = false;
      WebAuthnAbortService.cancelCeremony();
    };
  }, [status, autofillRound, loginWithPasskey, navigate, location.state]);

  if (status === 'authenticated') return <Navigate to={redirectTarget(location.state)} replace />;

  const onSubmit = async (credentials: LoginFormValues) => {
    setSubmitError(null);
    try {
      await login(credentials);
      navigate(redirectTarget(location.state), { replace: true });
    } catch (error) {
      // Todos os erros do login mostram-se aqui, por baixo da password — nunca em toast. O AUTH_001
      // não diz qual dos dois falhou (ADR 0011): o nome fica, a password limpa-se.
      ErrorHandler.handle(error, { showNotification: false });
      setSubmitError(ErrorHandler.getMessage(error));
      form.resetField('password');
      form.setFocus('password');
    }
  };

  const onPasskeyLogin = async () => {
    setPasskeyError(null);
    setSubmitError(null);
    setPasskeyPending(true);
    try {
      const optionsJSON = await passkeyService.getLoginOptions();
      await loginWithPasskey(await startAuthentication({ optionsJSON }));
      navigate(redirectTarget(location.state), { replace: true });
    } catch (error) {
      // Como os da password: por baixo do botão, nunca em toast.
      ErrorHandler.handle(error, { showNotification: false });
      setPasskeyError(getPasskeyErrorMessage(error));
      setAutofillRound((round) => round + 1);
    } finally {
      setPasskeyPending(false);
    }
  };

  const usernameError = errors.username?.message;
  const errorText = submitError ?? errors.password?.message;

  return (
    <div className="h-full flex items-center justify-center bg-bg">
      <form className="w-[360px] flex flex-col" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Wordmark size="login" />
        <div className="kicker mt-10">Acesso restrito</div>
        <h1 className="text-display m-0 mt-1 mb-6">Entrar</h1>

        <label htmlFor="username" className="text-[13px] text-text-2 mb-1.5">
          Nome de utilizador
        </label>
        <Controller
          name="username"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              id="username"
              autoFocus
              autoComplete="username webauthn"
              autoCapitalize="none"
              spellCheck={false}
              status={usernameError ? 'error' : undefined}
              aria-invalid={usernameError ? true : undefined}
              aria-describedby={usernameError ? 'username-error' : undefined}
              className="h-10"
              onChange={(event) => {
                setSubmitError(null);
                field.onChange(event);
              }}
            />
          )}
        />
        <FieldError id="username-error" message={usernameError} />

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

        {passkeysSupported && (
          <>
            <div className="flex items-center gap-3 my-4 text-[12px] text-text-3" aria-hidden>
              <span className="flex-1 border-t border-border" />
              ou
              <span className="flex-1 border-t border-border" />
            </div>
            <Button
              block
              icon={<KeyOutlined />}
              loading={passkeyPending}
              disabled={isSubmitting}
              onClick={onPasskeyLogin}
              aria-describedby={passkeyError ? 'passkey-error' : undefined}
              className="h-10"
            >
              Entrar com passkey
            </Button>
            <FieldError id="passkey-error" message={passkeyError ?? undefined} />
          </>
        )}
      </form>
    </div>
  );
}
