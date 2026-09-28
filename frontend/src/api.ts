import axios, { isAxiosError } from 'axios';
import { API_BASE_URL } from '@/config/apiBase';
import { ErrorHandler, getApiErrorResponse, wasErrorHandled } from '@/errors/errorHandler';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** O chamador trata o erro sozinho: o interceptor nunca notifica. */
    skipErrorNotification?: boolean;
    /** Um AUTH_002 neste pedido não leva ao /login (ex. o /auth/me do arranque). */
    skipAuthRedirect?: boolean;
  }
}

const api = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

let onSessionExpired: () => void = () => window.location.assign('/login');

/** O AuthContext regista aqui como limpar a sessão e ir para /login sem recarregar a página. */
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

api.interceptors.request.use((config) => {
  // O browser põe o Content-Type com o boundary; um valor fixo parte o multipart.
  if (config.data instanceof FormData) config.headers.delete('Content-Type');
  return config;
});

api.interceptors.response.use(undefined, (error: unknown) => {
  if (!isAxiosError(error)) return Promise.reject(error);

  // Sem refresh token (ADR 0003): sessão expirada → /login. O AUTH_001 (password errada) também é
  // 401, por isso decide-se pelo código e não pelo status.
  if (getApiErrorResponse(error)?.errorCode === 'AUTH_002' && !error.config?.skipAuthRedirect) {
    onSessionExpired();
  }

  if (!error.config?.skipErrorNotification) {
    if (!error.response) {
      ErrorHandler.handle(error);
    } else {
      // O catch do componente corre numa microtask: ao fim de um tick, se ninguém reclamou o erro,
      // a rede de segurança notifica.
      setTimeout(() => {
        if (!wasErrorHandled(error)) ErrorHandler.handle(error);
      }, 0);
    }
  }
  return Promise.reject(error);
});

export default api;
