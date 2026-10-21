import api from '@/api';
import type { LoginCredentials } from '@/types/auth';

export async function login(credentials: LoginCredentials): Promise<void> {
  // O erro (credenciais erradas, rate limit) mostra-se no próprio formulário.
  await api.post('/auth/login', credentials, { skipErrorNotification: true, skipAuthRedirect: true });
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout', undefined, { skipAuthRedirect: true });
}

/** O nome do utilizador se há sessão, `null` com AUTH_002; qualquer outro erro sobe. */
export async function currentUser(): Promise<string | null> {
  const { data } = await api.get<{ authenticated?: boolean; username?: string }>('/auth/me', {
    skipAuthRedirect: true,
    skipErrorNotification: true,
    validateStatus: (status) => status === 200 || status === 401,
  });
  return data.authenticated === true ? (data.username ?? '') : null;
}
