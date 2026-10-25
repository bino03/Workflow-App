import { describe, expect, it } from 'vitest';
import type { DevPort } from '../src/preview/listeningPorts.js';
import { type PreviewNotifier, PreviewService } from '../src/preview/previewService.js';
import { TailscaleError } from '../src/preview/tailscale.js';
import { type BotAction, BotActions } from '../src/telegram/botActions.js';
import { MenuStore } from '../src/telegram/menuStore.js';
import { type InlineKeyboard, TelegramApiError, type TelegramUpdate } from '../src/telegram/telegramApi.js';
import { TelegramBot } from '../src/telegram/telegramBot.js';
import type { TerminalInfo, TerminalListener } from '../src/terminals/terminalManager.js';
import type { TerminalView } from '../src/terminals/terminalsService.js';

const OWNER = 555_000_111;
const HOST = 'bino.tailb8eca6.ts.net';
const ID = '11111111-1111-4111-8111-111111111111';

/** The bot over a real PreviewService, with fake terminals, Tailscale and Telegram — no PTYs. */
function setup({
  ports = [{ port: 5173, pid: 9, process: 'node.exe' }] as DevPort[],
  withPreviews = true,
  serveError = undefined as Error | undefined,
} = {}) {
  const info: TerminalInfo = { id: ID, cwd: 'C:\\root\\loja', pid: 100, status: 'running', exitCode: null, startedAt: '' };
  const listeners = new Set<TerminalListener>();
  const served = new Map<number, number>();
  const notices: string[] = [];
  const notifier: PreviewNotifier = {
    started: (id, p) => void notices.push(`started ${id} ${p.url}`),
    stopped: (id, _p, reason) => void notices.push(`stopped ${id} ${reason}`),
  };
  const previews = new PreviewService({
    terminals: {
      get: (id) => (id === ID ? info : undefined),
      attach: (_id, listener) => (listeners.add(listener), { detach: () => listeners.delete(listener) }),
    },
    tailscale: {
      hostName: async () => HOST,
      servedPorts: async () => new Map([...served].map(([h, d]) => [h, `http://127.0.0.1:${d}`])),
      serve: async (h, d) => {
        if (serveError) throw serveError;
        served.set(h, d);
      },
      off: async (h) => void served.delete(h),
    },
    devPorts: async () => ports,
    httpsPorts: [8443],
    notifier,
  });
  const view = (): TerminalView => ({
    id: ID,
    label: null,
    cwd: info.cwd,
    claudeSessionId: ID,
    status: info.status,
    exitCode: null,
    createdAt: '',
    lastOpenedAt: '',
    remoteControl: false,
    preview: previews.get(ID) ?? null,
    importId: null,
    hidden: false,
  });
  const menus = new MenuStore<BotAction>();
  const actions = new BotActions({
    projects: { list: async () => [] },
    sessions: { listSessions: async () => [], latestSessionId: async () => null },
    terminals: {
      list: () => [view()],
      get: (id) => (id === ID ? view() : undefined),
      sessionsInUse: () => new Map(),
      create: async () => view(),
      reopen: async () => view(),
      stop: async () => view(),
    },
    readUsage: () => ({ fiveHour: null, weekly: null, fetchedAt: null }),
    previews: withPreviews ? previews : undefined,
    menus,
  });

  const sent: { text: string; keyboard?: InlineKeyboard }[] = [];
  const batches: TelegramUpdate[][] = [];
  let update = 1;
  const api = {
    async getUpdates(_o: number, _t: number, signal?: AbortSignal): Promise<TelegramUpdate[]> {
      const next = batches.shift();
      if (next) return next;
      await new Promise((r) => setTimeout(r, 5));
      if (signal?.aborted) throw new TelegramApiError('getUpdates', null, 'aborted', undefined, true);
      return [];
    },
    async sendMessage(_c: number, text: string, keyboard?: InlineKeyboard) {
      sent.push({ text, keyboard });
      return { message_id: sent.length, chat: { id: OWNER, type: 'private' as const } };
    },
    async editMessageText(_c: number, _m: number, text: string, keyboard?: InlineKeyboard) {
      sent.push({ text, keyboard });
      return true as const;
    },
    answerCallbackQuery: async () => true as const,
    setMyCommands: async () => true as const,
  };
  const quiet = { info: () => undefined, warn: () => undefined, error: () => undefined };
  const bot = new TelegramBot({ api, allowedUserId: OWNER, menus, actions, log: quiet, backoffMs: { initial: 5, max: 20 } });
  const chat = { id: OWNER, type: 'private' as const };
  const say = async (text: string) => {
    const before = sent.length;
    batches.push([{ update_id: update++, message: { message_id: update, chat, from: { id: OWNER }, text } }]);
    await expect.poll(() => sent.length).toBeGreaterThan(before);
    return sent.at(-1)!;
  };
  const press = async (keyboard: InlineKeyboard | undefined, label: RegExp) => {
    const button = keyboard?.flat().find((b) => label.test(b.text));
    if (!button) throw new Error(`no button ${label} in ${JSON.stringify(keyboard)}`);
    const before = sent.length;
    batches.push([{ update_id: update++, callback_query: { id: `cb${update}`, from: { id: OWNER }, data: button.callback_data, message: { message_id: 1, chat } } }]);
    await expect.poll(() => sent.length).toBeGreaterThan(before);
    return sent.at(-1)!;
  };
  return { bot, previews, served, notices, listeners, info, say, press, actions };
}

describe('Telegram /preview (ADR 0018)', () => {
  it('lists the running terminals; one tap serves the only dev port and replies with the link and an off button', async () => {
    const ctx = setup();
    ctx.bot.start();
    try {
      const menu = await ctx.say('/preview');
      expect(menu.text).toBe('De que terminal queres o link?');
      const link = await ctx.press(menu.keyboard, /loja/);
      expect(link.text).toContain(`https://${HOST}:8443/`);
      expect(link.text).toContain('Porta 5173');
      expect(link.text).toContain('/api');
      expect(ctx.served.get(8443)).toBe(5173);
      // The reply is the link: the notifier does not send it a second time.
      expect(ctx.notices).toEqual([]);

      expect((await ctx.say('/preview')).keyboard?.[0]?.[0]?.text).toBe('🔗 loja');

      const off = await ctx.press(link.keyboard, /Desligar/);
      expect(off.text).toBe('⏹ Link de loja desligado.');
      expect(ctx.served.size).toBe(0);
      expect(ctx.notices).toEqual([]);
      expect((await ctx.press(link.keyboard, /Desligar/)).text).toBe('Esse link já estava desligado.');
    } finally {
      await ctx.bot.stop();
    }
  });

  it('several ports → one button per port; the chosen one is served', async () => {
    const ctx = setup({
      ports: [
        { port: 5173, pid: 9, process: 'node.exe' },
        { port: 8080, pid: 10, process: 'java.exe' },
      ],
    });
    ctx.bot.start();
    try {
      const choose = await ctx.press((await ctx.say('/preview')).keyboard, /loja/);
      expect(choose.text).toBe('loja tem várias portas à escuta. Qual mostro?');
      expect(choose.keyboard?.flat().map((b) => b.text)).toEqual(['5173 · node.exe', '8080 · java.exe', 'Cancelar']);
      const link = await ctx.press(choose.keyboard, /^8080/);
      expect(link.text).toContain('Porta 8080');
      expect(ctx.served.get(8443)).toBe(8080);
    } finally {
      await ctx.bot.stop();
    }
  });

  it('no dev server → a sentence telling what to do; previews off → says so', async () => {
    const none = setup({ ports: [] });
    none.bot.start();
    try {
      expect((await none.press((await none.say('/preview')).keyboard, /loja/)).text).toMatch(/^Nenhum servidor de dev/);
    } finally {
      await none.bot.stop();
    }
    const off = setup({ withPreviews: false });
    off.bot.start();
    try {
      expect((await off.say('/preview')).text).toMatch(/falta TAILSCALE_BIN/);
    } finally {
      await off.bot.stop();
    }
  });

  it('Serve not enabled → the activation link in the answer', async () => {
    const ctx = setup({ serveError: new TailscaleError('not-enabled', 'Serve is not enabled', 'https://login.tailscale.com/f/serve?node=ABC') });
    const reply = await ctx.actions.run({ kind: 'preview', terminalId: ID });
    expect(reply.text).toContain('https://login.tailscale.com/f/serve?node=ABC');
  });

  it('a link started elsewhere (the app) and its automatic end are announced by the notifier', async () => {
    const ctx = setup();
    await ctx.previews.start(ID);
    expect(ctx.notices).toEqual([`started ${ID} https://${HOST}:8443/`]);
    const reply = ctx.actions.previewStarted(ID, ctx.previews.get(ID)!);
    expect(reply.keyboard?.flat().map((b) => b.text)).toEqual(['⏹ Desligar o link']);
    for (const listener of ctx.listeners) listener.onExit(0);
    await expect.poll(() => ctx.notices.at(-1)).toBe(`stopped ${ID} terminal-ended`);
    expect(ctx.actions.previewStopped(ID, { url: '', devPort: 5173, httpsPort: 8443, startedAt: '' }, 'port-closed').text).toBe(
      '⏹ Link de loja desligado — o servidor de dev (porta 5173) parou.',
    );
  });
});
