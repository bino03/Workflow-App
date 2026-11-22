import { Popover } from 'antd';
import { useNow } from '@/hooks/useNow';
import type { TerminalAgent } from '@/types/terminal';
import { StateIcon } from './StateIcon';
import { ACTIVITY_META, agentTitle, formatElapsed, shortModel } from './terminalDisplay';

/** A lista curta do popover: uma linha por agente a correr — ícone · descrição (ou tipo) · tipo · modelo · duração. */
function AgentsList({ agents }: { agents: TerminalAgent[] }) {
  // Só é montada com o popover aberto: o relógio só corre enquanto alguém a vê.
  const now = useNow(true);
  return (
    <ul className="m-0 p-0 list-none flex flex-col gap-1.5 min-w-[260px] max-w-[420px]" data-agents-list>
      {agents.map((agent) => {
        // Sem descrição o título já é o tipo: não o repetir ao lado.
        const kind = [agent.description ? agent.type : null, agent.model ? shortModel(agent.model) : null].filter(Boolean);
        return (
          <li key={agent.id} className="flex items-center gap-2 text-[12.5px] text-text-1" data-agent-row={agent.id}>
            <StateIcon icon={ACTIVITY_META.working.icon} title="A correr" slot />
            <span className="flex-1 min-w-0 truncate" data-agent-title>
              {agentTitle(agent)}
            </span>
                        {kind.length > 0 && (
              <span className="flex-none font-mono text-[10.5px] text-text-3" data-agent-kind>
                {kind.join(' · ')}
              </span>
            )}
            <span className="flex-none font-mono text-[10.5px] text-text-2" data-agent-elapsed>
              {formatElapsed(agent.startedAt, now)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * O selo "⑂ n" do cabeçalho do painel: quantos agentes o claude deste terminal tem a correr. Só se monta com pelo
 * menos um (o pai filtra). Passar o rato ou clicar/Enter abre a lista; é um `<button>`, por isso o teclado chega lá.
 */
export function AgentsBadge({ agents }: { agents: TerminalAgent[] }) {
  return (
    <Popover trigger={['hover', 'click']} placement="bottomLeft" mouseEnterDelay={0.2} title="Agentes a correr" content={<AgentsList agents={agents} />}>
      <button
        type="button"
        className="tag tag-sm cursor-pointer font-mono hover:text-text-1"
        data-agents-count={agents.length}
        aria-label={`${agents.length} ${agents.length === 1 ? 'agente a correr' : 'agentes a correr'}`}
        aria-haspopup="true"
        onMouseDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <span aria-hidden>⑂</span>
        {agents.length}
      </button>
    </Popover>
  );
}
