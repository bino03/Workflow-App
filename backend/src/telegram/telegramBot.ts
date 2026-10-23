import type { BotActions, BotReply } from './botActions.js';
import * as text from './botMessages.js';
import type { BotAction } from './botActions.js';
import type { MenuStore } from './menuStore.js';
import { type TelegramApi, TelegramApiError, type TelegramCallbackQuery, type TelegramMessage, type TelegramUpdate } from './telegramApi.js';

export type BotLogger = {
  info(obj: object, msg: string): void;
  warn(obj: object, msg: string): void;
  error(obj: object, msg: string): void;
};

export type TelegramBotDeps = {
  api: Pick<TelegramApi, 'getUpdates' | 'sendMessage' | 'editMessageText' | 'answerCallbackQuery' | 'setMyCommands'>;
  allowedUserId: number;
  actions: BotActions;
  menus: MenuStore<BotAction>;
  log: BotLogger;
  /** Long-poll timeout in seconds (Telegram holds the request this long when there is nothing new). */
  pollTimeoutS?: number;
  /** Backoff after an error, doubling up to the max. */
  backoffMs?: { initial: number; max: number };
};

/**
 * The Telegram bot (ADR 0017): long polling, one update at a time, answering only the allowed user in a
 * private chat. Everything else is ignored without a reply — answering would tell a stranger the bot exists.
 * Logs say what happened, never the text of a message nor the token.
 */
export class TelegramBot {
  private readonly controller = new AbortController();
  private loop: Promise<void> | undefined;

  constructor(private readonly deps: TelegramBotDeps) {}

  start(): void {
    this.loop ??= this.run();
  }

  async stop(): Promise<void> {
    this.controller.abort();
    await this.loop;
  }

  /** One update — exposed for tests; the loop calls it in order. Never throws. */
  async handle(update: TelegramUpdate): Promise<void> {
    try {
      if (update.message) await this.onMessage(update.message);
      else if (update.callback_query) await this.onCallback(update.callback_query);
    } catch (error) {
      this.deps.log.error({ err: describe(error), updateId: update.update_id }, 'telegram: update failed');
    }
  }

  private async run(): Promise<void> {
    const { api, log } = this.deps;
    const signal = this.controller.signal;
    const backoff = this.deps.backoffMs ?? { initial: 1000, max: 60_000 };
    let delay = backoff.initial;
    let offset = 0;

    try {
      await api.setMyCommands(text.COMMANDS);
    } catch (error) {
      log.warn({ err: describe(error) }, 'telegram: could not set the command list');
    }
    log.info({}, 'telegram: bot polling');

    while (!signal.aborted) {
      try {
        const updates = await api.getUpdates(offset, this.deps.pollTimeoutS ?? 50, signal);
        delay = backoff.initial;
        for (const update of updates) {
          offset = Math.max(offset, update.update_id + 1);
          await this.handle(update);
        }
      } catch (error) {
        if (signal.aborted) break;
        let wait = delay;
        if (error instanceof TelegramApiError && error.status === 409) {
          log.warn({}, 'telegram: another process is polling with this token (409) — is a second backend running?');
        } else if (error instanceof TelegramApiError && error.retryAfter) {
          wait = error.retryAfter * 1000;
        } else {
          log.warn({ err: describe(error) }, 'telegram: polling failed, retrying');
        }
        delay = Math.min(delay * 2, backoff.max);
        await sleep(wait, signal);
      }
    }
    log.info({}, 'telegram: bot stopped');
  }

  /** An unexpected failure still gets an answer on the phone; the details stay in the log. */
  private async safely(action: () => Promise<BotReply>): Promise<BotReply> {
    try {
      return await action();
    } catch (error) {
      this.deps.log.error({ err: describe(error) }, 'telegram: action failed');
      return { text: text.UNEXPECTED };
    }
  }

  private allowed(fromId: number | undefined, chat: TelegramMessage['chat'] | undefined): boolean {
    return fromId === this.deps.allowedUserId && chat?.type === 'private' && chat.id === fromId;
  }

  private async onMessage(message: TelegramMessage): Promise<void> {
    if (!this.allowed(message.from?.id, message.chat)) {
      this.deps.log.info({}, 'telegram: ignored a message from someone else');
      return;
    }
    const command = (message.text ?? '').trim().split(/\s+/)[0]!.toLowerCase().replace(/@.*$/, '');
    let reply: BotReply;
    switch (command) {
      case '/start':
      case '/ajuda':
      case '/help':
        reply = { text: text.HELP };
        break;
      case '/estado':
        reply = this.deps.actions.status();
        break;
      case '/parar':
        reply = this.deps.actions.stopMenu();
        break;
      case '/preview':
        reply = this.deps.actions.previewMenu();
        break;
      default:
        // /projetos, and any loose text: the project list is the way in.
        reply = command.startsWith('/') && command !== '/projetos' ? { text: text.HELP } : await this.safely(() => this.deps.actions.projects());
    }
    this.deps.log.info({ command: command.startsWith('/') ? command : '(text)' }, 'telegram: command');
    await this.deps.api.sendMessage(message.chat.id, reply.text, reply.keyboard);
  }

  private async onCallback(query: TelegramCallbackQuery): Promise<void> {
    if (!this.allowed(query.from.id, query.message?.chat)) {
      this.deps.log.info({}, 'telegram: ignored a button from someone else');
      return;
    }
    const message = query.message!;
    const action = query.data === undefined ? undefined : this.deps.menus.get(query.data);
    // Stop the button's spinner first; a slow action (launching claude) should not look stuck.
    await this.deps.api.answerCallbackQuery(query.id).catch(() => undefined);
    const reply = action ? await this.safely(() => this.deps.actions.run(action)) : { text: text.MENU_EXPIRED };
    this.deps.log.info({ action: action?.kind ?? 'expired' }, 'telegram: button');
    try {
      await this.deps.api.editMessageText(message.chat.id, message.message_id, reply.text, reply.keyboard);
    } catch {
      // Too old to edit, or unchanged: send it as a new message instead.
      await this.deps.api.sendMessage(message.chat.id, reply.text, reply.keyboard);
    }
  }
}

function describe(error: unknown): string {
  // TelegramApiError messages are already scrubbed of the token; anything else keeps only its name and message.
  return error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 300) : String(error).slice(0, 300);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done);
  });
}
