import type { ErrorCode } from '../common/errors.js';
import type { UsageView, UsageWindow } from '../usage/usageFiles.js';
import type { BotCommand } from './telegramApi.js';

/** Every text the bot sends (pt-PT). Never terminal content — only names, titles, states and the quota (ADR 0017). */

export const COMMANDS: BotCommand[] = [
  { command: 'projetos', description: 'Retomar ou começar uma conversa num projeto' },
  { command: 'estado', description: 'Terminais a correr e quota' },
  { command: 'parar', description: 'Parar um terminal' },
  { command: 'ajuda', description: 'O que este bot faz' },
];

export const HELP = [
  'Abro sessões do Claude Code no PC de casa com Remote Control, para continuares no app Claude.',
  '',
  '/projetos — escolher um projeto e retomar uma conversa (ou começar uma nova)',
  '/estado — terminais a correr e quota',
  '/parar — parar um terminal (fica na app, pronto a reabrir)',
].join('\n');

export const MENU_EXPIRED = 'Este menu expirou. Usa /projetos.';
export const NO_PROJECTS = 'Nenhum projeto encontrado no registo do Workflow (WORKFLOW_PATH / ALLOWED_ROOTS).';
export const PROJECT_GONE = 'Este projeto já não está no registo. Usa /projetos.';
export const CHOOSE_PROJECT = 'Escolhe um projeto:';
export const NOTHING_RUNNING = 'Nenhum terminal a correr.';
export const CHOOSE_TO_STOP = 'Que terminal paro?';
export const CANCELLED = 'Cancelado.';
export const UNEXPECTED = 'Algo correu mal do lado do PC. Vê os logs do backend.';

export const BUTTON = {
  continueLast: '▶ Continuar a última',
  newConversation: '➕ Nova conversa',
  restart: '🔄 Reiniciar com Remote Control',
  stopYes: '⏹ Sim, parar',
  cancel: 'Cancelar',
  back: '← Projetos',
} as const;

export const projectMenu = (project: string, count: number) =>
  count === 0 ? `${project} — ainda não há conversas gravadas.` : `${project} — escolhe uma conversa:`;

export const opened = (project: string, title: string | null) =>
  `✅ Aberto com Remote Control: ${project}${title ? ` · ${title}` : ''}.\nO app Claude avisa quando estiver pronto.`;

export const openedNew = (project: string) =>
  `✅ Nova conversa em ${project}, com Remote Control.\nO app Claude avisa quando estiver pronta; escreve lá a primeira mensagem.`;

export const alreadyRemote = (name: string) => `Já está aberta com Remote Control (${name}). Abre-a no app Claude → Code.`;

export const askRestart = (name: string) =>
  `Esta conversa está aberta no PC (${name}), sem Remote Control.\nPara a abrir no telemóvel tenho de reiniciar esse terminal — o que estiver a meio perde-se.`;

export const askStop = (name: string) => `Parar ${name}? O que estiver a meio perde-se. O terminal fica na app, parado, com Reabrir.`;

export const stopped = (name: string) => `⏹ ${name} parado. Reabre-o na app ou volta a abri-lo aqui com /projetos.`;

const ERRORS: Partial<Record<ErrorCode, string>> = {
  TERMINAL_001: 'Esse terminal já não existe.',
  TERMINAL_002: 'Já está o máximo de terminais abertos. Para um com /parar.',
  TERMINAL_003: 'Essa conversa já está aberta noutro terminal.',
  TERMINAL_004: 'Essa conversa gravada já não existe.',
  TERMINAL_005: 'O claude não foi encontrado no PC (CLAUDE_BIN).',
  TERMINAL_006: 'Esse terminal já está a correr.',
  TERMINAL_007: 'Esta pasta ainda não é de confiança para o Claude Code. Abre-a uma vez num terminal da app, no PC.',
  FOLDER_001: 'Essa pasta já não existe ou está fora de ALLOWED_ROOTS.',
  SESSION_001: 'Não há conversas gravadas neste projeto.',
};

export const errorText = (code: ErrorCode) => ERRORS[code] ?? UNEXPECTED;

const percent = (window: UsageWindow) => `${Math.round(window.usedPct)}%`;

export function formatWhen(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(iso));
}

export function statusText(terminals: { name: string; remoteControl: boolean }[], usage: UsageView, timeZone?: string): string {
  const lines = [terminals.length === 0 ? NOTHING_RUNNING : `A correr (${terminals.length}):`];
  for (const terminal of terminals) lines.push(`• ${terminal.name}${terminal.remoteControl ? ' · RC' : ''}`);
  lines.push('');
  const quota = (label: string, window: UsageWindow | null) =>
    window ? `${label}: ${percent(window)} (repõe ${formatWhen(window.resetsAt, timeZone)})` : `${label}: sem dados`;
  lines.push(quota('Quota 5h', usage.fiveHour), quota('Semana', usage.weekly));
  return lines.join('\n');
}
