/** Forma da resposta de erro do backend — docs/api.md, backend/src/common/errors.ts. */
export type ApiFieldError = { field: string; message: string };

export type ApiErrorResponse = {
  errorCode: string;
  /** Contexto para logs, em inglês. Nunca se mostra ao utilizador. */
  message: string;
  fieldErrors?: ApiFieldError[];
};

export type NotificationType = 'error' | 'warning' | 'info';

export type ErrorConfig = {
  showNotification?: boolean;
  notificationType?: NotificationType;
  customMessage?: string;
};
