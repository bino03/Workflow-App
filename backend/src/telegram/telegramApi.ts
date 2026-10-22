/**
 * The few Telegram Bot API methods the bot uses (ADR 0017), over `fetch` — no library. Long polling only
 * (`getUpdates`): nothing ever comes in from outside.
 *
 * The token is part of every request URL, so it must never leak through an error: errors here are built from
 * the method name, the HTTP status and Telegram's own description, with the token scrubbed from any text that
 * comes from the network stack, and without `cause`.
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type TelegramChat = { id: number; type: 'private' | 'group' | 'supergroup' | 'channel' };
export type TelegramUser = { id: number; is_bot?: boolean; first_name?: string };
export type TelegramMessage = { message_id: number; chat: TelegramChat; from?: TelegramUser; text?: string };
export type TelegramCallbackQuery = { id: string; from: TelegramUser; message?: TelegramMessage; data?: string };
export type TelegramUpdate = { update_id: number; message?: TelegramMessage; callback_query?: TelegramCallbackQuery };

export type InlineButton = { text: string; callback_data: string };
export type InlineKeyboard = InlineButton[][];
export type BotCommand = { command: string; description: string };

export class TelegramApiError extends Error {
  override name = 'TelegramApiError';

  constructor(
    readonly method: string,
    /** HTTP status, or null when the request never got an answer (network, abort). */
    readonly status: number | null,
    description: string,
    /** Seconds Telegram asks to wait (429). */
    readonly retryAfter?: number,
    readonly aborted = false,
  ) {
    super(`telegram ${method}: ${status ?? 'no response'} ${description}`);
  }
}

type ApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
};

export class TelegramApi {
  constructor(
    private readonly token: string,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly baseUrl = 'https://api.telegram.org',
  ) {}

  /** Long poll: waits up to `timeoutS` for updates after `offset`. Abort with `signal` to stop. */
  getUpdates(offset: number, timeoutS: number, signal?: AbortSignal): Promise<TelegramUpdate[]> {
    return this.call('getUpdates', { offset, timeout: timeoutS, allowed_updates: ['message', 'callback_query'] }, signal);
  }

  /** Plain text (no parse_mode): project names and titles are never read as markup. */
  sendMessage(chatId: number, text: string, keyboard?: InlineKeyboard): Promise<TelegramMessage> {
    return this.call('sendMessage', { chat_id: chatId, text, ...replyMarkup(keyboard) });
  }

  editMessageText(chatId: number, messageId: number, text: string, keyboard?: InlineKeyboard): Promise<TelegramMessage | true> {
    return this.call('editMessageText', { chat_id: chatId, message_id: messageId, text, ...replyMarkup(keyboard) });
  }

  answerCallbackQuery(callbackQueryId: string, text?: string): Promise<true> {
    return this.call('answerCallbackQuery', { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });
  }

  setMyCommands(commands: BotCommand[]): Promise<true> {
    return this.call('setMyCommands', { commands });
  }

  private async call<T>(method: string, params: object, signal?: AbortSignal): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/bot${this.token}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(params),
        signal,
      });
    } catch (error) {
      const aborted = signal?.aborted === true;
      throw new TelegramApiError(method, null, aborted ? 'aborted' : this.scrub(error), undefined, aborted);
    }

    let body: ApiResponse<T>;
    try {
      body = (await response.json()) as ApiResponse<T>;
    } catch {
      throw new TelegramApiError(method, response.status, 'response is not JSON');
    }
    if (!response.ok || !body.ok) {
      const description = typeof body.description === 'string' ? this.scrub(body.description) : 'request failed';
      throw new TelegramApiError(method, body.error_code ?? response.status, description, body.parameters?.retry_after);
    }
    return body.result as T;
  }

  /** The text of a network error, without the token (undici may put the URL in it). */
  private scrub(error: unknown): string {
    const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return text.split(this.token).join('<token>').slice(0, 300);
  }
}

function replyMarkup(keyboard: InlineKeyboard | undefined) {
  return keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {};
}
