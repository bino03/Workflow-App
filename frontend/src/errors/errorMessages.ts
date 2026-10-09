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
  AUTH_001: 'Nome de utilizador ou password incorretos. Tenta outra vez.',
  AUTH_002: 'A sessão terminou. Entra outra vez.',
  AUTH_003: 'Pedido recusado: esta origem não está autorizada.',
  AUTH_004: 'Demasiadas tentativas. Espera um minuto e tenta outra vez.',
  AUTH_005: 'A passkey não foi aceite. Tenta outra vez, ou entra com a password.',
  AUTH_006: 'Password incorreta.',
  AUTH_007: 'Já tens 20 passkeys registadas. Revoga uma para acrescentar outra.',
  AUTH_008: 'Não foi possível registar a passkey. Tenta outra vez.',
  AUTH_009: 'Esta passkey já não existe.',
  // ── LIBRARY ────────────────────────────
  LIBRARY_001: 'A biblioteca do Workflow não foi encontrada. Confirma o WORKFLOW_PATH do backend.',
  LIBRARY_002: 'O ficheiro não é uma skill válida. Confirma o frontmatter no topo (kind, name, category, status).',
  LIBRARY_003: 'Já existe uma skill com este nome nesta stack. Apaga ou renomeia a antiga primeiro.',
  LIBRARY_004: 'Esta stack não existe na biblioteca.',
  LIBRARY_005: 'O ficheiro está em falta, vazio, ou é maior do que 256 KB.',
  // ── TERMINAL ───────────────────────────
  TERMINAL_001: 'Este terminal já não existe.',
  TERMINAL_002: 'Já tens o máximo de terminais abertos. Fecha um para abrir outro.',
  TERMINAL_003: 'Esta sessão já está aberta noutro terminal.',
  TERMINAL_004: 'A sessão gravada já não existe (o Claude Code apaga-as ao fim de 30 dias).',
  TERMINAL_005: 'O claude não foi encontrado no servidor. Confirma o CLAUDE_BIN.',
  TERMINAL_006: 'Este terminal já está a correr.',
  // ── FOLDER ─────────────────────────────
  FOLDER_001: 'Esta pasta não existe ou está fora das pastas autorizadas.',
  // ── SESSION ────────────────────────────
  SESSION_001: 'Não há nenhuma sessão gravada nesta pasta.',

  DEFAULT: 'Ocorreu um erro. Tenta outra vez.',
};

/** Pedido sem resposta (backend parado, rede em baixo) — não é um código do backend. */
export const NETWORK_ERROR_MESSAGE = 'Sem ligação ao backend. Confirma que está a correr.';

export function getUserFriendlyMessage(errorCode?: string): string {
  return (errorCode && ERROR_MESSAGES[errorCode]) || ERROR_MESSAGES.DEFAULT!;
}
