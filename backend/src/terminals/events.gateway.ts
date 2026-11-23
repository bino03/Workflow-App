import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { SessionStore } from '../auth/sessionStore.js';
import type { TerminalEvents } from './terminalEvents.js';
import { WS_CLOSE } from './terminals.gateway.js';

export type EventsGatewayOptions = {
  terminalEvents: TerminalEvents;
  sessionStore: SessionStore;
};

/**
 * `/api/terminals/events/ws` (ADR 0038) — protocol in docs/api.md. The auth guard has already checked the session
 * cookie and `Origin` before the upgrade. Server → client only: what the client sends is ignored.
 */
export async function eventsGateway(app: FastifyInstance, { terminalEvents, sessionStore }: EventsGatewayOptions): Promise<void> {
  app.get('/api/terminals/events/ws', { websocket: true }, (socket: WebSocket, request) => {
    const stopEvents = terminalEvents.subscribe((message) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
    });
    const stopSessionWatch = request.session
      ? sessionStore.onEnd(request.session.id, () => socket.close(WS_CLOSE.sessionEnded, 'session ended'))
      : () => {};
    socket.on('close', () => {
      stopEvents();
      stopSessionWatch();
    });
  });
}
