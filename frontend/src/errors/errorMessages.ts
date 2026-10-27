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
  // ── TERMINAL ───────────────────────────
  TERMINAL_001: 'Este terminal já não existe.',
  TERMINAL_002: 'Já tens o máximo de terminais abertos. Fecha um para abrir outro.',
  TERMINAL_003: 'Esta sessão já está aberta noutro terminal.',
  TERMINAL_004: 'A sessão gravada já não existe (o Claude Code apaga-as ao fim de 30 dias).',
  TERMINAL_005: 'O claude não foi encontrado no servidor. Confirma o CLAUDE_BIN.',
  TERMINAL_006: 'Este terminal já está a correr.',
  TERMINAL_007: 'Esta pasta ainda não é de confiança para o Claude Code — abre-a uma vez num terminal da app.',
  // ── PREVIEW ────────────────────────────
  PREVIEW_001: 'Nenhum servidor de dev à escuta neste terminal.',
  PREVIEW_002: 'O terminal não está a correr.',
  PREVIEW_003: 'Essa porta já não está à escuta neste terminal.',
  PREVIEW_004: 'Todas as portas de pré-visualização estão ocupadas — desliga uma.',
  PREVIEW_005: 'O Tailscale não respondeu (está instalado, ligado e com permissão?).',
  PREVIEW_006: 'A pré-visualização está desligada (falta TAILSCALE_BIN no backend).',
  PREVIEW_007: 'O Serve do Tailscale não está ativado na tailnet — ativa-o uma vez na consola do Tailscale.',
  // ── FOLDER ─────────────────────────────
  FOLDER_001: 'Esta pasta não existe ou está fora das pastas autorizadas.',
  // ── SESSION ────────────────────────────
  SESSION_001: 'Não há nenhuma sessão gravada nesta pasta.',
  // ── KEYBIND ────────────────────────────
  KEYBIND_001: 'Esta combinação não é permitida. Usa Alt com uma letra, um número ou pontuação (AltGr só com o ponto).',
  KEYBIND_002: 'Esta combinação já é usada por outra ação. Muda ou remove essa primeiro.',
  KEYBIND_003: 'Esta ação de atalho já não existe. Recarrega a página.',
  // ── IMPORT ─────────────────────────────
  IMPORT_001: 'Esta importação já não existe.',
  IMPORT_002: 'Já há uma importação a decorrer ou por rever. Acaba-a ou cancela-a primeiro.',
  IMPORT_003: 'O Workflow tem alterações por gravar. Faz commit ou descarta-as antes de importar.',
  IMPORT_004: 'Ficheiros a mais (máx. 200), grandes demais (máx. 10 MB no total), ou com um nome que não é permitido.',
  IMPORT_005: 'A importação ainda não está pronta para isto.',
  IMPORT_006: 'O git do Workflow recusou a operação. Vê o terminal da importação ou o repositório do Workflow.',
  // GUIDED (ADR 0020)
  GUIDED_001: 'Esta sessão já não existe.',
  GUIDED_002: 'Esta pergunta já foi respondida ou mudou — a vista foi atualizada.',
  GUIDED_003: 'A sessão não está a correr — retoma-a primeiro.',
  GUIDED_004: 'O Claude ainda está a trabalhar — espera que termine para escrever.',
  // CREATE
  CREATE_001: 'Já há um projeto a ser criado — acaba-o ou cancela-o primeiro.',
  CREATE_002: 'O projeto ainda não foi criado, ou a pasta dele não existe.',
  UPWORK_001: 'A candidatura não existe.',
  UPWORK_002: 'Preenche o teu perfil antes da primeira candidatura.',
  UPWORK_003: 'Só se cria projeto a partir de uma candidatura ganha.',
  UPWORK_004: 'A candidatura está arquivada.',
  UPWORK_005: 'A sessão desta candidatura já não existe (arquivada) — não dá para continuar a conversa.',
  UPWORK_006: 'O print não está no portfólio (ou PORTFOLIO_PATH não está definido).',

  DEFAULT: 'Ocorreu um erro. Tenta outra vez.',
};

/** Pedido sem resposta (backend parado, rede em baixo) — não é um código do backend. */
export const NETWORK_ERROR_MESSAGE = 'Sem ligação ao backend. Confirma que está a correr.';

export function getUserFriendlyMessage(errorCode?: string): string {
  return (errorCode && ERROR_MESSAGES[errorCode]) || ERROR_MESSAGES.DEFAULT!;
}
