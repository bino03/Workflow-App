import { isAxiosError } from 'axios';
import { ErrorHandler } from './errorHandler';

/**
 * A mensagem de um erro numa cerimónia de passkey. Os da API vão pelo ErrorHandler; os do browser
 * (navigator.credentials) não têm código do backend e mapeiam-se aqui pelo nome do DOMException.
 */
export function getPasskeyErrorMessage(error: unknown): string {
  if (isAxiosError(error)) return ErrorHandler.getMessage(error);
  const name = error instanceof Error ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'AbortError':
      return 'A passkey foi cancelada, ou não há nenhuma para esta app neste dispositivo.';
    case 'InvalidStateError':
      return 'Este dispositivo já tem uma passkey registada nesta app.';
    case 'SecurityError':
      // O caso mais provável em local: a página aberta em 127.0.0.1 em vez de localhost (ADR 0015).
      return 'Este endereço não pode usar passkeys. Abre a app em localhost (ou no domínio configurado).';
    default:
      return 'Este browser não conseguiu usar a passkey.';
  }
}
