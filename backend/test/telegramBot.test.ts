import { mkdirSync, mkdtempSync, realpathSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ProjectEntry } from '../src/projects/project.schemas.js';
import { ClaudeSessions } from '../src/sessions/claudeSessions.js';
import { StateStore } from '../src/state/stateStore.js';
import { type BotAction, BotActions } from '../src/telegram/botActions.js';
import { MenuStore } from '../src/telegram/menuStore.js';
import { type InlineKeyboard, TelegramApiError, type TelegramChat, type TelegramUpdate } from '../src/telegram/telegramApi.js';
import { TelegramBot } from '../src/telegram/telegramBot.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { TerminalsService } from '../src/terminals/terminalsService.js';
import { fakeClaude, waitFor } from './fakeClaude.js';
import { removeDir } from './helpers.js';

const OWNER = 555_000_111;
const STRANGER = 999_000_222;
const OLD = '4c11a40a-9c91-4a62-9d86-00197ae5a535';
const LATEST = '9089b683-e79e-4bd7-9d4b-69f6fd40cc0a';

const base = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfa-bot-')));
const root = join(base, 'root');
const project = join(root, 'api-faturas');
const emptyProject = join(root, 'sandbox');
const untrusted = join(root, 'nunca-aberto');
for (const dir of [project, emptyProject, untrusted]) mkdirSync(dir, { recursive: true });
const sessions = new ClaudeSessions(join(base, 'claude'));

function writeSession(cwd: string, id: string, title: string, mtime: Date) {
  const folder = sessions.folderOf(cwd);
  mkdirSync(folder, { recursive: true });
  const file = join(folder, `${id}.jsonl`);
  writeFileSync(file, `${JSON.stringify({ type: 'ai-title', aiTitle: title })}\n`);
  utimesSync(file, mtime, mtime);
}
writeSession(project, OLD, 'Sessão antiga', new Date('2026-09-20T10:00:00Z'));
writeSession(project, LATEST, 'Migração para prisma', new Date('2026-10-20T18:42:00Z'));

afterAll(() => removeDir(base));

const PROJECTS: ProjectEntry[] = [
  { name: 'API Faturas', path: project, type: null, stack: null, status: null },
  { name: 'Sandbox', path: emptyProject, type: null, stack: null, status: null },
  { name: 'Nunca aberto', path: untrusted, type: null, stack: null, status: null },
];

type Sent = { method: string; chatId?: number; text?: string; keyboard?: InlineKeyboard };

/** A Telegram that records what the bot sends; getUpdates serves queued batches, then waits for the abort. */
function fakeApi() {
  const sent: Sent[] = [];
  const batches: (TelegramUpdate[] | Error)[] = [];
  let polls = 0;
  const api = {
    async getUpdates(_offset: number, _timeout: number, signal?: AbortSignal): Promise<TelegramUpdate[]> {
      polls++;
      const next = batches.shift();
      if (next instanceof Error) throw next;
      if (next) return next;
      return new Promise((_resolve, reject) =>
        signal?.addEventListener('abort', () => reject(new TelegramApiError('getUpdates', null, 'aborted', undefined, true))),
      );
    },
    async sendMessage(chatId: number, text: string, keyboard?: InlineKeyboard) {
      sent.push({ method: 'sendMessage', chatId, text, keyboard });
      return { message_id: sent.length, chat: { id: chatId, type: 'private' as const } };
    },
    async editMessageText(chatId: number, _messageId: number, text: string, keyboard?: InlineKeyboard) {
      sent.push({ method: 'editMessageText', chatId, text, keyboard });
      return true as const;
    },
    async answerCallbackQuery() {
      sent.push({ method: 'answerCallbackQuery' });
      return true as const;
    },
    async setMyCommands() {
      sent.push({ method: 'setMyCommands' });
      return true as const;
    },
  };
  return { api, sent, batches, polls: () => polls };
}

function captureLog() {
  const lines: string[] = [];
  const write = (level: string) => (obj: object, msg: string) => void lines.push(`${level} ${msg} ${JSON.stringify(obj)}`);
  return { log: { info: write('info'), warn: write('warn'), error: write('error') }, lines };
}

let nextUpdate = 1;
const privateChat = (id: number): TelegramChat => ({ id, type: 'private' });
const messageFrom = (from: number, text: string, chat = privateChat(from)): TelegramUpdate => ({
  update_id: nextUpdate++,
  message: { message_id: nextUpdate, chat, from: { id: from }, text },
});
const pressFrom = (from: number, data: string, chat = privateChat(from)): TelegramUpdate => ({
  update_id: nextUpdate++,
  callback_query: { id: `cb${nextUpdate}`, from: { id: from }, data, message: { message_id: 1, chat } },
});

describe('TelegramBot', () => {
  let dataDir: string;
  let stateStore: StateStore;
  let manager: TerminalManager;
  let claude: ReturnType<typeof fakeClaude>;
  let terminals: TerminalsService;
  let telegram: ReturnType<typeof fakeApi>;
  let logs: ReturnType<typeof captureLog>;
  let bot: TelegramBot;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'wfa-bot-data-'));
    stateStore = await StateStore.load(dataDir);
    claude = fakeClaude();
    manager = new TerminalManager({ spawn: claude.spawn, maxTerminals: 2, scrollbackBytes: 64 * 1024 });
    terminals = new TerminalsService({
      stateStore,
      terminalManager: manager,
      sessions,
      allowedRoots: [root],
      isTrustedFolder: (cwd) => Promise.resolve(cwd !== untrusted),
    });
    telegram = fakeApi();
    logs = captureLog();
    const menus = new MenuStore<BotAction>();
    bot = new TelegramBot({
      api: telegram.api,
      allowedUserId: OWNER,
      menus,
      log: logs.log,
      backoffMs: { initial: 5, max: 20 },
      actions: new BotActions({
        projects: { list: async () => PROJECTS },
        sessions,
        terminals,
        readUsage: () => ({ fiveHour: { usedPct: 41.6, resetsAt: '2026-10-22T18:30:00Z' }, weekly: null, fetchedAt: null }),
        menus,
        timeZone: 'UTC',
      }),
    });
  });

  afterEach(async () => {
    await bot.stop();
    await manager.killAll();
    await stateStore.flush();
    removeDir(dataDir);
  });

  const last = () => telegram.sent.filter((s) => s.method !== 'answerCallbackQuery').at(-1)!;
  const buttonData = (label: RegExp) => {
    const button = last().keyboard?.flat().find((b) => label.test(b.text));
    if (!button) throw new Error(`no button ${label} in ${JSON.stringify(last().keyboard)}`);
    return button.callback_data;
  };
  const press = (label: RegExp) => bot.handle(pressFrom(OWNER, buttonData(label)));

  it('ignores anyone but the owner, and the owner outside a private chat — no reply, no action', async () => {
    await bot.handle(messageFrom(STRANGER, '/projetos'));
    await bot.handle(messageFrom(OWNER, '/projetos', { id: -100123, type: 'supergroup' }));
    await bot.handle(messageFrom(STRANGER, '/estado', privateChat(OWNER)));
    expect(telegram.sent).toEqual([]);

    await bot.handle(messageFrom(OWNER, '/projetos'));
    const key = buttonData(/API Faturas/);
    telegram.sent.length = 0;
    await bot.handle(pressFrom(STRANGER, key));
    await bot.handle(pressFrom(OWNER, key, { id: -100123, type: 'group' }));
    expect(telegram.sent).toEqual([]);
    expect(claude.launches).toEqual([]);
  });

  it('/projetos → project → "Continuar a última" opens the latest session with RC and its name', async () => {
    await bot.handle(messageFrom(OWNER, '/projetos'));
    expect(last().text).toBe('Escolhe um projeto:');
    await press(/API Faturas/);
    expect(last().method).toBe('editMessageText');
    expect(last().text).toBe('API Faturas — escolhe uma conversa:');
    expect(last().keyboard!.flat().map((b) => b.text)).toEqual([
      '▶ Continuar a última',
      'Migração para prisma · 20/10, 18:42',
      'Sessão antiga · 20/09, 10:00',
      '➕ Nova conversa',
      '← Projetos',
    ]);

    await press(/Continuar a última/);
    expect(claude.launches.at(-1)!.args).toEqual(['--resume', LATEST, '--remote-control', 'api-faturas · Migração para prisma']);
    expect(last().text).toContain('Aberto com Remote Control: API Faturas · Migração para prisma');
    expect(terminals.list()).toMatchObject([{ claudeSessionId: LATEST, remoteControl: true, status: 'running' }]);
  });

  it('a chosen session already running without RC: asks, and on confirm restarts the same terminal with RC', async () => {
    const plain = await terminals.create({ cwd: project, mode: 'resume', sessionId: OLD, cols: 80, rows: 24 });
    await bot.handle(messageFrom(OWNER, '/projetos'));
    await press(/API Faturas/);
    await press(/^● Sessão antiga/);
    expect(last().text).toContain('sem Remote Control');
    expect(claude.launches).toHaveLength(1);

    await press(/Reiniciar com Remote Control/);
    expect(claude.launches.at(-1)!.args).toEqual(['--resume', OLD, '--remote-control', 'api-faturas · Sessão antiga']);
    expect(terminals.list()).toMatchObject([{ id: plain.id, remoteControl: true, status: 'running' }]);

    // Asked again now: it already has RC.
    await bot.handle(messageFrom(OWNER, '/projetos'));
    await press(/API Faturas/);
    await press(/Sessão antiga/);
    expect(last().text).toContain('Já está aberta com Remote Control');
    expect(claude.launches).toHaveLength(2);
  });

  it('a chosen session whose terminal is stopped comes back in the same terminal, with RC', async () => {
    const saved = await terminals.create({ cwd: project, mode: 'resume', sessionId: OLD, cols: 80, rows: 24 });
    await terminals.stop(saved.id);
    await bot.handle(messageFrom(OWNER, '/projetos'));
    await press(/API Faturas/);
    await press(/Sessão antiga/);
    expect(terminals.list()).toMatchObject([{ id: saved.id, status: 'running', remoteControl: true }]);
    expect(last().text).toContain('Aberto com Remote Control');
  });

  it('"Nova conversa" opens a new session with RC and no name', async () => {
    await bot.handle(messageFrom(OWNER, 'olá'));
    await press(/Sandbox/);
    expect(last().text).toBe('Sandbox — ainda não há conversas gravadas.');
    await press(/Nova conversa/);
    const view = terminals.list()[0]!;
    expect(claude.launches.at(-1)!.args).toEqual(['--session-id', view.claudeSessionId, '--remote-control']);
    expect(last().text).toContain('Nova conversa em Sandbox');
  });

  it('service errors come back as sentences: untrusted folder, MAX_TERMINALS', async () => {
    await bot.handle(messageFrom(OWNER, '/projetos'));
    const projectsKeyboard = last();
    await press(/Nunca aberto/);
    await press(/Nova conversa/);
    expect(last().text).toContain('ainda não é de confiança');
    expect(claude.launches).toEqual([]);

    await terminals.create({ cwd: emptyProject, mode: 'new', cols: 80, rows: 24 });
    await terminals.create({ cwd: emptyProject, mode: 'new', cols: 80, rows: 24 });
    telegram.sent.push(projectsKeyboard);
    await press(/Sandbox/);
    await press(/Nova conversa/);
    expect(last().text).toContain('máximo de terminais');
  });

  it('an unknown or expired button → "menu expirou"; a stale project path is re-checked', async () => {
    await bot.handle(pressFrom(OWNER, 'nope1234'));
    expect(last().text).toBe('Este menu expirou. Usa /projetos.');
    const menus = new MenuStore<BotAction>();
    const actions = new BotActions({ projects: { list: async () => [] }, sessions, terminals, readUsage: () => ({ fiveHour: null, weekly: null, fetchedAt: null }), menus });
    expect((await actions.run({ kind: 'open', path: project, target: 'new' })).text).toContain('já não está no registo');
    expect(claude.launches).toEqual([]);
  });

  it('/estado lists running terminals and the quota — never what a terminal shows', async () => {
    const view = await terminals.create({ cwd: project, mode: 'resume', sessionId: OLD, label: 'faturas', cols: 80, rows: 24, remoteControl: true });
    manager.write(view.id, 'SEGREDO-NO-TERMINAL');
    await waitFor(() => manager.attach(view.id, { onData() {}, onExit() {} })!.scrollback.includes('SEGREDO'));
    await bot.handle(messageFrom(OWNER, '/estado'));
    expect(last().text).toBe('A correr (1):\n• faturas · RC\n\nQuota 5h: 42% (repõe 22/10, 18:30)\nSemana: sem dados');
    expect(JSON.stringify(telegram.sent)).not.toMatch(/SEGREDO|grandchild|echo:/);
  });

  it('/parar → choose → confirm: the process ends, the terminal stays (stopped)', async () => {
    const view = await terminals.create({ cwd: project, mode: 'resume', sessionId: OLD, label: 'faturas', cols: 80, rows: 24 });
    await bot.handle(messageFrom(OWNER, '/parar'));
    await press(/faturas/);
    expect(last().text).toContain('Parar faturas?');
    await press(/Cancelar/);
    expect(terminals.get(view.id)!.status).toBe('running');

    await bot.handle(messageFrom(OWNER, '/parar'));
    await press(/faturas/);
    await press(/Sim, parar/);
    expect(last().text).toContain('faturas parado');
    expect(terminals.get(view.id)!.status).toBe('stopped');

    await bot.handle(messageFrom(OWNER, '/parar'));
    expect(last().text).toBe('Nenhum terminal a correr.');
  });

  it('polling: survives a 409 and a network error, handles the next batch, stops on abort; logs carry no message text', async () => {
    telegram.batches.push(
      new TelegramApiError('getUpdates', 409, 'Conflict: terminated by other getUpdates request'),
      new TelegramApiError('getUpdates', null, 'TypeError: fetch failed'),
      [messageFrom(OWNER, 'o meu texto privado')],
    );
    bot.start();
    await waitFor(() => telegram.sent.some((s) => s.text === 'Escolhe um projeto:'));
    expect(telegram.sent[0]!.method).toBe('setMyCommands');
    await bot.stop();
    expect(telegram.polls()).toBe(4);
    const log = logs.lines.join('\n');
    expect(log).toContain('409');
    expect(log).toContain('bot stopped');
    expect(log).not.toContain('o meu texto privado');
  });
});
