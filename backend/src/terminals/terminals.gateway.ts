import type { FastifyInstance } from 'fastify';
import type { RawData, WebSocket } from 'ws';
import type { SessionStore } from '../auth/sessionStore.js';
import { isUuid } from '../sessions/claudeSessions.js';
import { type ServerControlMessage, clientControlSchema } from './protocol.js';
import type { TerminalManager } from './terminalManager.js';

/** Close codes the client acts on (mirrored in `frontend/src/types/terminal.ts`). */
export const WS_CLOSE = {
  /** The terminal is not running in memory: stopped, closed, or reopened (a new socket is needed). */
  terminalGone: 4404,
  /** The login session ended (logout, expiry, a new login). */
  sessionEnded: 4401,
} as const;

export type TerminalsGatewayOptions = {
  terminalManager: TerminalManager;
  sessionStore: SessionStore;
};

function toBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}

/**
 * `/api/terminals/:id/ws` — protocol in docs/api.md → "Protocolo do WebSocket". The auth guard has already
 * checked the session cookie and `Origin` before the upgrade. Binary frames are terminal bytes; text frames
 * are JSON control messages, and anything that is not a valid one is ignored. The terminal's content is
 * never logged — only ids and events.
 */
export async function terminalsGateway(app: FastifyInstance, { terminalManager, sessionStore }: TerminalsGatewayOptions): Promise<void> {
  app.get<{ Params: { id: string } }>('/api/terminals/:id/ws', { websocket: true }, (socket: WebSocket, request) => {
    const { id } = request.params;
    const info = isUuid(id) ? terminalManager.get(id) : undefined;
    if (!info) {
      socket.close(WS_CLOSE.terminalGone, 'terminal not running');
      return;
    }

    const control = (message: ServerControlMessage) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
    };

    const attached = terminalManager.attach(id, {
      onData: (data) => {
        if (socket.readyState === socket.OPEN) socket.send(Buffer.from(data, 'utf8'), { binary: true });
      },
      onExit: (code) => control({ type: 'exit', code }),
      onClose: () => socket.close(WS_CLOSE.terminalGone, 'terminal closed'),
    });
    if (!attached) {
      socket.close(WS_CLOSE.terminalGone, 'terminal not running');
      return;
    }

    // attach() and these sends run in the same tick, before any new PTY output: the client always sees
    // ready → scrollback → live output, in that order.
    control({ type: 'ready', status: info.status, exitCode: info.exitCode });
    if (attached.scrollback) socket.send(Buffer.from(attached.scrollback, 'utf8'), { binary: true });

    const stopSessionWatch = request.session
      ? sessionStore.onEnd(request.session.id, () => socket.close(WS_CLOSE.sessionEnded, 'session ended'))
      : () => {};

    socket.on('message', (data: RawData, isBinary: boolean) => {
      if (isBinary) {
        terminalManager.write(id, toBuffer(data).toString('utf8'));
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(toBuffer(data).toString('utf8'));
      } catch {
        return;
      }
      const message = clientControlSchema.safeParse(parsed);
      if (message.success && message.data.type === 'resize') {
        terminalManager.resize(id, message.data.cols, message.data.rows);
      }
    });

    socket.on('close', () => {
      attached.detach();
      stopSessionWatch();
      request.log.info({ terminalId: id }, 'terminal socket closed');
    });
    request.log.info({ terminalId: id }, 'terminal socket opened');
  });
}
