import { useEffect, useState } from 'react';
import { ErrorHandler } from '@/errors/errorHandler';
import { getSessions } from '@/services/sessionService';
import type { SavedSession } from '@/types/session';
import { SIDEBAR_ROW, SidebarGroup } from './SidebarGroup';
import { shortSessionDate } from './terminalDisplay';

/** Quantas sessões a lateral mostra; as outras estão no modal "Retomar…". */
const SHOWN = 5;

type SavedSessionsGroupProps = {
  path: string;
  /** Muda quando os terminais do projeto mudam (um fechado passa a sessão gravada): relê a lista. */
  refreshKey: string;
  onResume: (session: SavedSession) => void;
  onShowAll: () => void;
  now: number;
};

/** O título de uma sessão: o rótulo do terminal fechado, senão o título do Claude Code, senão o primeiro prompt. */
function sessionTitle(session: SavedSession): string {
  return session.closed?.label ?? session.preview ?? session.closed?.summary ?? '(sem mensagens)';
}

/**
 * SESSÕES GRAVADAS na lateral (proposta C do ADR 0036): as 5 mais recentes da pasta que não estão abertas num
 * terminal, com o título e a data. Clicar retoma (`--resume`) na conta em que a conversa foi feita.
 */
export function SavedSessionsGroup({ path, refreshKey, onResume, onShowAll, now }: SavedSessionsGroupProps) {
  const [sessions, setSessions] = useState<SavedSession[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSessions(path)
      .then((list) => !cancelled && setSessions(list))
      .catch((e: unknown) => {
        ErrorHandler.handle(e, { showNotification: false });
        if (!cancelled) setSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [path, refreshKey]);

  const resumable = (sessions ?? []).filter((session) => session.openIn === null);
  if (sessions === null || resumable.length === 0) return null;

  return (
    <SidebarGroup id="sessions" title="SESSÕES GRAVADAS" count={resumable.length}>
      {resumable.slice(0, SHOWN).map((session) => (
        <button
          key={session.id}
          type="button"
          data-saved-session={session.id}
          title={`Retomar: ${sessionTitle(session)}`}
          onClick={() => onResume(session)}
          className={`${SIDEBAR_ROW} bg-transparent cursor-pointer hover:bg-surface-2`}
        >
          <span className="flex-1 min-w-0 truncate">{sessionTitle(session)}</span>
          <span className="flex-none font-mono text-[10.5px] text-text-3">{shortSessionDate(session.updatedAt, now)}</span>
        </button>
      ))}
      {resumable.length > SHOWN && (
        <button type="button" onClick={onShowAll} className={`${SIDEBAR_ROW} bg-transparent cursor-pointer text-text-3 hover:text-text-1`}>
          Ver todas ({resumable.length})…
        </button>
      )}
    </SidebarGroup>
  );
}
