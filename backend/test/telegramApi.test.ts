import { describe, expect, it } from 'vitest';
import { type FetchLike, TelegramApi, TelegramApiError } from '../src/telegram/telegramApi.js';

const TOKEN = '7012345678:AAFv1x2y3z4ABCDEFghijklmnopqrstuvwx';

type Call = { url: string; body: unknown };

function fakeFetch(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    const call = { url: input, body: JSON.parse(String(init?.body)) };
    calls.push(call);
    return respond(call);
  };
  return { calls, fetchImpl };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function caught(action: () => Promise<unknown>): Promise<TelegramApiError> {
  try {
    await action();
  } catch (error) {
    expect(error).toBeInstanceOf(TelegramApiError);
    return error as TelegramApiError;
  }
  throw new Error('expected a TelegramApiError');
}

describe('TelegramApi', () => {
  it('POSTs JSON to /bot<token>/<method> and returns result', async () => {
    const { calls, fetchImpl } = fakeFetch(() => json(200, { ok: true, result: [{ update_id: 7 }] }));
    const api = new TelegramApi(TOKEN, fetchImpl);
    expect(await api.getUpdates(5, 50)).toEqual([{ update_id: 7 }]);
    expect(calls).toEqual([
      { url: `https://api.telegram.org/bot${TOKEN}/getUpdates`, body: { offset: 5, timeout: 50, allowed_updates: ['message', 'callback_query'] } },
    ]);
  });

  it('sends plain text (no parse_mode) and an inline keyboard only when given', async () => {
    const { calls, fetchImpl } = fakeFetch(() => json(200, { ok: true, result: { message_id: 1 } }));
    const api = new TelegramApi(TOKEN, fetchImpl);
    await api.sendMessage(42, 'olá *não* é markdown');
    await api.sendMessage(42, 'escolhe', [[{ text: 'WorkFlow App', callback_data: 'k1' }]]);
    await api.editMessageText(42, 9, 'feito');
    await api.answerCallbackQuery('cb1');
    await api.setMyCommands([{ command: 'estado', description: 'Terminais e quota' }]);
    expect(calls.map((c) => c.body)).toEqual([
      { chat_id: 42, text: 'olá *não* é markdown' },
      { chat_id: 42, text: 'escolhe', reply_markup: { inline_keyboard: [[{ text: 'WorkFlow App', callback_data: 'k1' }]] } },
      { chat_id: 42, message_id: 9, text: 'feito' },
      { callback_query_id: 'cb1' },
      { commands: [{ command: 'estado', description: 'Terminais e quota' }] },
    ]);
  });

  it('a Telegram error carries the method, the code, its description and retry_after', async () => {
    const { fetchImpl } = fakeFetch(() =>
      json(409, { ok: false, error_code: 409, description: 'Conflict: terminated by other getUpdates request' }),
    );
    const conflict = await caught(() => new TelegramApi(TOKEN, fetchImpl).getUpdates(0, 50));
    expect(conflict).toMatchObject({ method: 'getUpdates', status: 409, aborted: false });
    expect(conflict.message).toContain('Conflict');

    const limited = await caught(() =>
      new TelegramApi(TOKEN, fakeFetch(() => json(429, { ok: false, error_code: 429, description: 'Too Many Requests', parameters: { retry_after: 7 } })).fetchImpl).sendMessage(1, 'x'),
    );
    expect(limited).toMatchObject({ status: 429, retryAfter: 7 });
  });

  it('never puts the token in an error — network errors that quote the URL are scrubbed', async () => {
    const { fetchImpl } = fakeFetch(() => {
      throw new TypeError(`fetch failed: connect ECONNREFUSED https://api.telegram.org/bot${TOKEN}/getUpdates`);
    });
    const error = await caught(() => new TelegramApi(TOKEN, fetchImpl).getUpdates(0, 50));
    expect(error.status).toBeNull();
    expect(error.message).toContain('ECONNREFUSED');
    expect(error.message).not.toContain(TOKEN);
    expect(error.message).not.toContain(TOKEN.split(':')[1]);
    expect(error.cause).toBeUndefined();
    expect(JSON.stringify(error)).not.toContain(TOKEN);

    const echoed = await caught(() =>
      new TelegramApi(TOKEN, fakeFetch(() => json(401, { ok: false, error_code: 401, description: `Unauthorized ${TOKEN}` })).fetchImpl).sendMessage(1, 'x'),
    );
    expect(echoed.message).not.toContain(TOKEN);
  });

  it('a body that is not JSON is an error, not a crash', async () => {
    const { fetchImpl } = fakeFetch(() => new Response('<html>Bad Gateway</html>', { status: 502 }));
    expect(await caught(() => new TelegramApi(TOKEN, fetchImpl).sendMessage(1, 'x'))).toMatchObject({ status: 502 });
  });

  it('aborting a pending getUpdates rejects as aborted', async () => {
    const fetchImpl: FetchLike = (_input, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('This operation was aborted', 'AbortError'))));
    const controller = new AbortController();
    const pending = new TelegramApi(TOKEN, fetchImpl).getUpdates(0, 50, controller.signal);
    controller.abort();
    expect(await caught(() => pending)).toMatchObject({ aborted: true, status: null });
  });
});
