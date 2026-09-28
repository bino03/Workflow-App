/**
 * Espelho 1:1 do ErrorCode do backend (backend/src/common/errors.ts), pela mesma ordem.
 * Código novo lá → entrada aqui, no mesmo commit.
 */
export const ERROR_MESSAGES: Record<string, string> = {
  // ── COMMON ─────────────────────────────
  COMMON_001: 'Os dados enviados não são válidos.',
  COMMON_002: 'Ocorreu um erro inesperado no servidor. Tenta outra vez.',
  COMMON_003: 'Este recurso não existe.',
  // ── AUTH ───────────────────────────────
  AUTH_001: 'Password incorreta. Tenta outra vez.',
  AUTH_002: 'A sessão terminou. Entra outra vez.',
  AUTH_003: 'Pedido recusado: esta origem não está autorizada.',
  AUTH_004: 'Demasiadas tentativas. Espera um minuto e tenta outra vez.',

  DEFAULT: 'Ocorreu um erro. Tenta outra vez.',
};

/** Pedido sem resposta (backend parado, rede em baixo) — não é um código do backend. */
export const NETWORK_ERROR_MESSAGE = 'Sem ligação ao backend. Confirma que está a correr.';

export function getUserFriendlyMessage(errorCode?: string): string {
  return (errorCode && ERROR_MESSAGES[errorCode]) || ERROR_MESSAGES.DEFAULT!;
}
