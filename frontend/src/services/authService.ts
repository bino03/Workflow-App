import api from '@/api';
import type { LoginCredentials } from '@/types/auth';

export async function login(credentials: LoginCredentials): Promise<void> {
  // O erro (credenciais erradas, rate limit) mostra-se no próprio formulário.
  await api.post('/auth/login', credentials, { skipErrorNotification: true, skipAuthRedirect: true });
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout', undefined, { skipAuthRedirect: true });
}

/** Resolve com true se há sessão, false com AUTH_002; qualquer outro erro sobe. */
export async function hasSession(): Promise<boolean> {
  const { data } = await api.get<{ authenticated: boolean }>('/auth/me', {
    skipAuthRedirect: true,
    skipErrorNotification: true,
    validateStatus: (status) => status === 200 || status === 401,
  });
  return data.authenticated === true;
}
