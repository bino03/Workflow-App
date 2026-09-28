import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseWith } from '../common/validation.js';
import { resolveAllowedPath } from '../folders/cwdPolicy.js';
import type { StateStore } from '../state/stateStore.js';
import type { TerminalsService } from '../terminals/terminalsService.js';
import type { ClaudeSessions, SessionInfo } from './claudeSessions.js';

export type SavedSession = SessionInfo & {
  /** The terminal that used this session and was closed in the app — its label and summary. */
  closed: { label: string | null; summary: string | null; closedAt: string } | null;
  /** The saved terminal (running, exited or stopped) that uses it — resuming is refused (TERMINAL_003). */
  openIn: string | null;
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
    const closedBySession = new Map<string, SavedSession['closed']>();
    for (const closed of [...options.stateStore.read().closedTerminals].sort((a, b) => a.closedAt.localeCompare(b.closedAt))) {
      closedBySession.set(closed.claudeSessionId, { label: closed.label, summary: closed.summary, closedAt: closed.closedAt });
    }
    return (await options.sessions.listSessions(real)).map((session) => ({
      ...session,
      closed: closedBySession.get(session.id) ?? null,
      openIn: inUse.get(session.id) ?? null,
    }));
  });
}
