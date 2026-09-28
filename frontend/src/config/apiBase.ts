/*
 * Onde está o backend. VITE_API_URL vazia (omissão) → a origem da própria página: em dev o proxy
 * do Vite, em produção o backend que serve a SPA. Preenchida → outro backend (app desktop, remoto).
 */
const configuredOrigin = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');

export const API_BASE_URL = `${configuredOrigin}/api`;

/** URL absoluto `ws(s)://` para um caminho da API (ex. `/terminals/abc/ws`). */
export function apiWebSocketUrl(path: string): string {
  const url = new URL(`${configuredOrigin || window.location.origin}/api${path}`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}
