import type { AuthenticationResponseJSON } from '@simplewebauthn/browser';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setSessionExpiredHandler } from '@/api';
import { ErrorHandler } from '@/errors/errorHandler';
import * as authService from '@/services/authService';
import * as passkeyService from '@/services/passkeyService';
import type { LoginCredentials } from '@/types/auth';
import { AuthContext, type AuthStatus } from './authContextValue';

// Cache da sessão só para o arranque não piscar o /login; o /auth/me confirma logo a seguir.
const SESSION_CACHE_KEY = 'workflow-app.session';

function readCachedSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_CACHE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCachedSession(active: boolean) {
  try {
    if (active) sessionStorage.setItem(SESSION_CACHE_KEY, '1');
    else sessionStorage.removeItem(SESSION_CACHE_KEY);
  } catch {
    // sessionStorage indisponível: fica só sem cache.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(() => (readCachedSession() ? 'authenticated' : 'checking'));
  // Não vai para a cache: vem sempre do /auth/me, para nunca mostrar um nome antigo.
  const [username, setUsername] = useState<string | null>(null);

  const setAuthenticated = useCallback((active: boolean) => {
    writeCachedSession(active);
    setStatus(active ? 'authenticated' : 'anonymous');
    if (!active) setUsername(null);
  }, []);

  /** Depois de entrar (password ou passkey), o login não devolve o nome — pede-se ao /auth/me. */
  const loadUsername = useCallback(() => {
    authService
      .currentUser()
      .then((name) => setUsername(name))
      .catch(() => {
        // Só o nome falhou; a sessão está boa. O cabeçalho fica sem nome até à próxima vez.
      });
  }, []);

  useEffect(() => {
    // Limpar a cache antes do redirect: senão o arranque seguinte volta a confiar nela.
    setSessionExpiredHandler(() => setAuthenticated(false));
  }, [setAuthenticated]);

  useEffect(() => {
    let cancelled = false;
    authService
      .currentUser()
      .then((name) => {
        if (cancelled) return;
        setAuthenticated(name !== null);
        setUsername(name);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        ErrorHandler.handle(error);
        setAuthenticated(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setAuthenticated]);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      await authService.login(credentials);
      setAuthenticated(true);
      loadUsername();
    },
    [setAuthenticated, loadUsername],
  );

  const loginWithPasskey = useCallback(
    async (response: AuthenticationResponseJSON) => {
      await passkeyService.loginWithPasskey(response);
      setAuthenticated(true);
      loadUsername();
    },
    [setAuthenticated, loadUsername],
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      // Exceção documentada: a sessão local limpa-se mesmo que a chamada falhe.
      setAuthenticated(false);
    }
  }, [setAuthenticated]);

  const value = useMemo(
    () => ({ status, username, login, loginWithPasskey, logout }),
    [status, username, login, loginWithPasskey, logout],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}
