import { isAxiosError } from 'axios';
import { notificationService } from '@/services/general/notificationService';
import type { ApiErrorResponse, ErrorConfig } from './error.types';
import { getUserFriendlyMessage, NETWORK_ERROR_MESSAGE } from './errorMessages';

const HANDLED = Symbol.for('workflow-app.errorHandled');

type Claimable = { [HANDLED]?: true };

/** O interceptor de api.ts usa isto para não notificar um erro que um componente já tratou. */
export function wasErrorHandled(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as Claimable)[HANDLED] === true;
}

function claim(error: unknown) {
  if (typeof error === 'object' && error !== null) (error as Claimable)[HANDLED] = true;
}

export function getApiErrorResponse(error: unknown): ApiErrorResponse | undefined {
  if (!isAxiosError<ApiErrorResponse>(error)) return undefined;
  const data = error.response?.data;
  return data && typeof data === 'object' && typeof data.errorCode === 'string' ? data : undefined;
}

export class ErrorHandler {
  /** Reclama o erro (mesmo com showNotification: false) e mostra a mensagem PT mapeada. */
  static handle(error: unknown, config: ErrorConfig = {}): ApiErrorResponse | undefined {
    const { showNotification = true, notificationType = 'error', customMessage } = config;
    claim(error);
    const data = getApiErrorResponse(error);

    if (showNotification) {
      if (data?.fieldErrors?.length && !customMessage) {
        notificationService.validationError(data.fieldErrors);
      } else {
        notificationService[notificationType]('Erro', customMessage ?? ErrorHandler.getMessage(error));
      }
    }
    return data;
  }

  /** A mensagem que o handle() mostraria, sem notificar — para erros mostrados inline. */
  static getMessage(error: unknown): string {
    if (isAxiosError(error) && !error.response) return NETWORK_ERROR_MESSAGE;
    return getUserFriendlyMessage(getApiErrorResponse(error)?.errorCode);
  }
}
