import { useEffect, useRef } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { apiWebSocketUrl } from '@/config/apiBase';
import { shortcutFromEvent } from '@/hooks/useTerminalShortcuts';
import { TERMINAL_FONT, loadTerminalFont } from '@/terminal/terminalSize';
import { xtermTheme } from '@/terminal/xtermTheme';
import { type ServerControlMessage, WS_CLOSE } from '@/types/terminal';

type TerminalViewProps = {
  terminalId: string;
  /** Está no ecrã; escondido continua ligado (sem replay ao voltar), mas não faz fit. */
  visible: boolean;
  /** Tem o teclado: recebe o foco quando isto passa a true. */
  focused: boolean;
  compact?: boolean;
  /** Zoom só deste terminal (Alt+=/Alt+-/Alt+0), em px acima/abaixo do tamanho base — nunca a página toda. */
  fontDelta?: number;
  onFocus?: () => void;
  onExit?: (code: number) => void;
  /** O terminal deixou de estar em memória (fechado, parado, reaberto): a página recarrega a lista. */
  onGone?: () => void;
};

const RECONNECT_DELAYS_MS = [500, 1000, 2000, 5000];

/**
 * Um terminal: xterm.js + WebSocket. A instância e o socket vivem em refs deste componente — nunca em
 * Context nem em estado de React (frontend-conventions → Terminais). Para reabrir, a página remonta-o
 * (key com o lastOpenedAt).
 */
export function TerminalView({ terminalId, visible, focused, compact = false, fontDelta = 0, onFocus, onExit, onGone }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const callbacks = useRef({ onFocus, onExit, onGone });
  useEffect(() => {
    callbacks.current = { onFocus, onExit, onGone };
  });
  const font = compact ? TERMINAL_FONT.grid : TERMINAL_FONT.focus;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let attempt = 0;
    const cleanups: (() => void)[] = [];

    const send = (data: string | Uint8Array<ArrayBuffer>) => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(data);
    };
    const sendResize = (cols: number, rows: number) => send(JSON.stringify({ type: 'resize', cols, rows }));

    const connect = (term: Terminal) => {
      const ws = new WebSocket(apiWebSocketUrl(`/terminals/${terminalId}/ws`));
      ws.binaryType = 'arraybuffer';
      socket = ws;
      ws.onopen = () => (attempt = 0);
      ws.onmessage = (event) => {
        if (typeof event.data !== 'string') {
          term.write(new Uint8Array(event.data as ArrayBuffer));
          return;
        }
        const message = JSON.parse(event.data) as ServerControlMessage;
        if (message.type === 'ready') {
          // O scrollback vem a seguir: sem reset ficava duplicado a cada religação.
          term.reset();
          // Um resize ±1 obriga a TUI do claude a redesenhar-se por inteiro, por cima do scrollback cru.
          window.setTimeout(() => {
            sendResize(term.cols, Math.max(1, term.rows - 1));
            window.setTimeout(() => sendResize(term.cols, term.rows), 60);
          }, 120);
        } else if (message.type === 'exit') {
          callbacks.current.onExit?.(message.code);
        }
      };
      ws.onclose = (event) => {
        if (disposed || socket !== ws) return;
        socket = null;
        if (event.code === WS_CLOSE.terminalGone) {
          callbacks.current.onGone?.();
          return;
        }
        if (event.code === WS_CLOSE.sessionEnded) return; // o AuthContext leva ao /login
        // Backend reiniciado ou rede em baixo: volta a tentar; o ready seguinte repõe o ecrã.
        const delay = RECONNECT_DELAYS_MS[Math.min(attempt++, RECONNECT_DELAYS_MS.length - 1)];
        reconnectTimer = window.setTimeout(() => !disposed && connect(term), delay);
      };
    };

    void loadTerminalFont().then(() => {
      if (disposed) return;
      const term = new Terminal({
        theme: xtermTheme,
        fontFamily: TERMINAL_FONT.family,
        fontSize: font.size,
        lineHeight: font.lineHeight,
        cursorBlink: true,
        scrollback: 5000,
        allowProposedApi: false,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(container);
      termRef.current = term;
      fitRef.current = fit;

      // Os atalhos da app nunca chegam ao PTY; quem os executa é o listener da janela (useTerminalShortcuts).
      term.attachCustomKeyEventHandler((event) => !(event.type === 'keydown' && shortcutFromEvent(event)));
      const encoder = new TextEncoder();
      const input = term.onData((data) => send(encoder.encode(data)));
      const binary = term.onBinary((data) => send(Uint8Array.from(data, (c) => c.charCodeAt(0))));
      const resize = term.onResize(({ cols, rows }) => sendResize(cols, rows));
      const textarea = term.textarea;
      const handleFocus = () => callbacks.current.onFocus?.();
      textarea?.addEventListener('focus', handleFocus);
      cleanups.push(() => {
        input.dispose();
        binary.dispose();
        resize.dispose();
        textarea?.removeEventListener('focus', handleFocus);
      });

      const observer = new ResizeObserver(() => {
        // Escondido (display:none) o contentor mede 0: um fit aí encolhia o PTY para 2×1.
        if (container.clientWidth > 0 && container.clientHeight > 0) fit.fit();
      });
      observer.observe(container);
      cleanups.push(() => observer.disconnect());

      if (container.clientWidth > 0) fit.fit();
      connect(term);
    });

    return () => {
      disposed = true;
      window.clearTimeout(reconnectTimer);
      cleanups.forEach((cleanup) => cleanup());
      socket?.close(1000);
      termRef.current?.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [terminalId, compact, font]);

  // Zoom só deste terminal: muda o fontSize ao vivo (sem recriar o xterm.js nem reconectar o WebSocket).
  useEffect(() => {
    const term = termRef.current;
    const fit = fitRef.current;
    if (!term || !fit) return;
    term.options.fontSize = font.size + fontDelta;
    if (containerRef.current && containerRef.current.clientWidth > 0) fit.fit();
  }, [fontDelta, font]);

  useEffect(() => {
    if (visible && fitRef.current && containerRef.current && containerRef.current.clientWidth > 0) fitRef.current.fit();
  }, [visible]);

  useEffect(() => {
    if (focused && visible) termRef.current?.focus();
  }, [focused, visible]);

  return <div ref={containerRef} className="terminal-host h-full w-full min-h-0" data-terminal-id={terminalId} />;
}
