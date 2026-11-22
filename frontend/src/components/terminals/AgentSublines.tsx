import { useNow } from '@/hooks/useNow';
import type { TerminalAgent } from '@/types/terminal';
import { StateIcon } from './StateIcon';
import { ACTIVITY_META, agentKind, agentTitle, formatElapsed } from './terminalDisplay';

/** Quantas sublinhas se mostram antes do "+n". */
const MAX_LINES = 3;

/**
 * Os agentes a correr de um terminal, por baixo da linha dele na lateral: `└` · ícone · descrição (ou tipo) · duração.
 * Mais baixas (20 px) do que a linha do terminal (26 px). Mais de 3 → mostra 3 e uma linha "+n". O pai só a monta com agentes.
 */
export function AgentSublines({ agents }: { agents: TerminalAgent[] }) {
  const now = useNow(agents.length > 0);
  const shown = agents.slice(0, MAX_LINES);
  const more = agents.length - shown.length;
  return (
    <div className="flex flex-col" data-agent-sublines>
      {shown.map((agent) => (
        <div
          key={agent.id}
          className="h-5 pl-[22px] pr-2 flex items-center gap-1.5 text-[11.5px] text-text-2"
          data-agent-subline={agent.id}
          title={agentKind(agent) || 'Agente'}
        >
          <span className="flex-none font-mono text-text-3" aria-hidden>
            └
          </span>
          <span className="scale-[.8] inline-flex">
            <StateIcon icon={ACTIVITY_META.working.icon} title="A correr" />
          </span>
          <span className="flex-1 min-w-0 truncate">{agentTitle(agent)}</span>
          <span className="flex-none font-mono text-[10.5px] text-text-2" data-agent-elapsed>
            {formatElapsed(agent.startedAt, now)}
          </span>
        </div>
      ))}
      {more > 0 && (
        <div className="h-5 pl-[22px] pr-2 flex items-center gap-1.5 text-[11px] font-mono text-text-3" data-agent-more>
          <span aria-hidden>└</span>+{more}
        </div>
      )}
    </div>
  );
}
