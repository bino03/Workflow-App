import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseWith } from '../common/validation.js';
import { resolveAllowedPath } from '../folders/cwdPolicy.js';
import type { AccountId } from '../state/state.schema.js';
import type { StateStore } from '../state/stateStore.js';
import type { TerminalsService } from '../terminals/terminalsService.js';
import type { ClaudeSessions, SessionInfo } from './claudeSessions.js';

export type SavedSession = SessionInfo & {
  /** The terminal that used this session and was closed in the app — its label and summary. */
  closed: { label: string | null; summary: string | null; closedAt: string } | null;
  /** The saved terminal (running, exited or stopped) that uses it — resuming is refused (TERMINAL_003). */
  openIn: string | null;
  /**
   * The Claude account it last ran in (ADR 0027): the open terminal's, else the closed one's; null when the app
   * never ran it. Resuming in another account shows the context size first.
   */
  accountId: AccountId | null;
};

const querySchema = z.object({ cwd: z.string().min(1).max(1024) });

export type SessionsRoutesOptions = {
  sessions: ClaudeSessions;
  stateStore: StateStore;
  terminalsService: TerminalsService;
  allowedRoots: readonly string[];
};

/** Saved Claude Code sessions of one folder, most recent first — the "Retomar" list. Session required. */
export async function sessionsRoutes(app: FastifyInstance, options: SessionsRoutesOptions): Promise<void> {
  app.get('/api/sessions', async (request): Promise<SavedSession[]> => {
    const { cwd } = parseWith(querySchema, request.query);
    const real = resolveAllowedPath(cwd, options.allowedRoots);
    const inUse = options.terminalsService.sessionsInUse();
    // closedTerminals is newest first once limits apply; keep the newest per session regardless.
    const state = options.stateStore.read();
    const closedBySession = new Map<string, SavedSession['closed'] & { accountId: AccountId }>();
    for (const closed of [...state.closedTerminals].sort((a, b) => a.closedAt.localeCompare(b.closedAt))) {
      closedBySession.set(closed.claudeSessionId, { label: closed.label, summary: closed.summary, closedAt: closed.closedAt, accountId: closed.accountId });
    }
    const openAccount = new Map(state.terminals.map((terminal) => [terminal.claudeSessionId, terminal.accountId]));
    return (await options.sessions.listSessions(real)).map((session) => {
      const closed = closedBySession.get(session.id);
      const accountId = openAccount.get(session.id) ?? closed?.accountId ?? null;
      return {
        ...session,
        closed: closed ? { label: closed.label, summary: closed.summary, closedAt: closed.closedAt } : null,
        openIn: inUse.get(session.id) ?? null,
        accountId: accountId === null ? null : options.terminalsService.accountOf(accountId),
      };
    });
  });
}
