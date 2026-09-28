import { Spin } from 'antd';
import type { SavedSession } from '@/types/session';
import { formatSessionDate } from '../terminalDisplay';

export type SessionMode = 'new' | 'resume' | 'continue';

type SessionPickerProps = {
  sessions: SavedSession[] | null;
  mode: SessionMode;
  sessionId: string | undefined;
  onModeChange: (mode: SessionMode) => void;
  onSessionChange: (id: string) => void;
  error?: string;
};

/** O que a sessão mostra na lista: o rótulo e o resumo do terminal fechado, senão o preview do Claude Code. */
function sessionText(session: SavedSession): string {
  const detail = session.closed?.summary ?? session.preview;
  const label = session.closed?.label;
  if (label) return detail ? `${label} — ${detail}` : label;
  return detail ?? '(sem mensagens)';
}

function Mode({ selected, disabled, title, detail, onSelect }: { selected: boolean; disabled?: boolean; title: string; detail: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`w-full text-left flex items-center gap-3 px-3 py-[9px] rounded-md border cursor-pointer bg-transparent disabled:opacity-40 disabled:cursor-not-allowed ${
        selected ? 'border-accent-border bg-accent-subtle' : 'border-border'
      }`}
    >
      <span
        className={`w-4 h-4 rounded-full flex-none flex items-center justify-center border-[1.5px] ${selected ? 'border-accent' : 'border-border-strong'}`}
        aria-hidden
      >
        <span className={`w-2 h-2 rounded-full ${selected ? 'bg-accent' : ''}`} />
      </span>
      <span className="flex flex-col gap-px min-w-0">
        <span className="text-[13.5px] font-medium text-text-1">{title}</span>
        <span className="text-[12.5px] text-text-3 whitespace-nowrap overflow-hidden text-ellipsis">{detail}</span>
      </span>
    </button>
  );
}

/** Sessão nova · Continuar a última · Retomar uma sessão gravada (protótipo 1j). */
export function SessionPicker({ sessions, mode, sessionId, onModeChange, onSessionChange, error }: SessionPickerProps) {
  const latest = sessions?.[0];
  const hasSessions = !!sessions && sessions.length > 0;
  const latestFree = !!latest && latest.openIn === null;

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[13px] font-semibold">Sessão</span>
      <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Sessão">
        <Mode selected={mode === 'new'} title="Sessão nova" detail="Conversa limpa nesta pasta" onSelect={() => onModeChange('new')} />
        <Mode
          selected={mode === 'continue'}
          disabled={!latestFree}
          title="Continuar a última"
          detail={latest ? `${formatSessionDate(latest.updatedAt)} — «${sessionText(latest)}»` : 'Nenhuma sessão gravada nesta pasta'}
          onSelect={() => onModeChange('continue')}
        />
        <Mode
          selected={mode === 'resume'}
          disabled={!hasSessions}
          title="Retomar uma sessão gravada"
          detail={hasSessions ? 'Escolhe da lista abaixo' : 'Nenhuma sessão gravada nesta pasta'}
          onSelect={() => onModeChange('resume')}
        />
      </div>

      {sessions === null && (
        <div className="py-2 flex justify-center">
          <Spin size="small" />
        </div>
      )}
      {mode === 'resume' && hasSessions && (
        <div className="border border-border rounded-md overflow-hidden max-h-[220px] overflow-y-auto" role="listbox" aria-label="Sessões gravadas">
          {sessions.map((session) => {
            const selected = session.id === sessionId;
            const busy = session.openIn !== null;
            return (
              <button
                key={session.id}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={busy}
                data-session-id={session.id}
                onClick={() => onSessionChange(session.id)}
                className={`w-full text-left flex flex-col gap-0.5 px-3 py-2 border-0 border-b border-border last:border-b-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                  selected ? 'bg-surface-3 shadow-[inset_0_0_0_1px_var(--wfa-color-accent-border)]' : 'bg-transparent hover:bg-surface-2'
                }`}
              >
                <span className="flex justify-between text-[12px] text-text-3">
                  <span className="font-mono">{formatSessionDate(session.updatedAt)}</span>
                  <span>{busy ? 'aberta noutro terminal' : `${session.messageCount} mensagens`}</span>
                </span>
                <span className="text-[13px] text-text-1 whitespace-nowrap overflow-hidden text-ellipsis">{sessionText(session)}</span>
              </button>
            );
          })}
        </div>
      )}
      {error && <span className="text-[12.5px] text-error">✕ {error}</span>}
    </div>
  );
}
