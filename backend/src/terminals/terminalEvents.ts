import type { TerminalEventMessage } from './protocol.js';
import { SESSION_STATE_FILES } from './sessionState.js';
import type { SessionStateChange, SessionStateWatcher } from './sessionStateWatcher.js';
import type { TerminalView } from './terminalsService.js';

const DEBOUNCE_MS = 150;

type Listener = (message: TerminalEventMessage) => void;

export type TerminalEventsOptions = {
  watcher: Pick<SessionStateWatcher, 'subscribe'>;
  /** The terminal as `GET /api/terminals` shows it (`TerminalsService.get`). */
  view: (terminalId: string) => TerminalView | undefined;
  debounceMs?: number;
};

/**
 * ADR 0038: turns what the session hook writes into one message per change. A hook event writes several files and a
 * rename fires more than once, so each terminal waits `debounceMs` and is read again whole; a message only goes out
 * when its activity or agents differ from the last one sent. Hidden and non-normal terminals (`activity: null`) never
 * produce one.
 */
export class TerminalEvents {
  private readonly listeners = new Set<Listener>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly lastSent = new Map<string, string>();
  private readonly debounceMs: number;
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly options: TerminalEventsOptions) {
    this.debounceMs = options.debounceMs ?? DEBOUNCE_MS;
  }

  start(): void {
    this.unsubscribe ??= this.options.watcher.subscribe((change) => this.onChange(change));
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  /** Returns the unsubscribe. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private onChange({ terminalId, path }: SessionStateChange): void {
    // state.json and the agents' files; push.json and the tmp files of the atomic writes are not session state.
    const counts = path === SESSION_STATE_FILES.state || (path.startsWith('agents/') && path.endsWith('.json'));
    if (!counts) return;
    clearTimeout(this.timers.get(terminalId));
    this.timers.set(
      terminalId,
      setTimeout(() => {
        this.timers.delete(terminalId);
        this.flush(terminalId);
      }, this.debounceMs),
    );
  }

  private flush(terminalId: string): void {
    const view = this.options.view(terminalId);
    if (!view || view.hidden || view.activity === null) {
      this.lastSent.delete(terminalId);
      return;
    }
    const message: TerminalEventMessage = { type: 'terminal', id: view.id, activity: view.activity, agents: view.agents };
    const key = JSON.stringify([message.activity, message.agents]);
    if (this.lastSent.get(terminalId) === key) return;
    this.lastSent.set(terminalId, key);
    for (const listener of this.listeners) listener(message);
  }
}
