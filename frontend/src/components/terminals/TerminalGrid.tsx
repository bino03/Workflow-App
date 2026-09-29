import type { ReactNode } from 'react';
import type { TerminalStatus, TerminalView } from '@/types/terminal';
import { STATUS_META } from './terminalDisplay';

type TerminalGridProps = {
  terminals: TerminalView[];
  /** Um terminal ampliado ocupa a área toda; os outros ficam escondidos mas ligados. */
  enlarged: boolean;
  /** Clique fora de qualquer mosaico (o fundo da grelha) — larga o teclado do que estava em edição. */
  onBackgroundMouseDown: () => void;
  /** Os mosaicos, já na ordem da lateral (a página é que sabe montá-los). */
  children: ReactNode;
  /** A quota no cabeçalho (passo 16). */
  headerExtra?: ReactNode;
};

const COUNT_LABELS: Record<TerminalStatus, string> = { running: 'a correr', exited: 'terminados', stopped: 'parados' };

/**
 * Grelha (protótipo 1i): 3 colunas, duas linhas à vista e scroll depois de 6; clicar num mosaico amplia-o.
 * Sem botão "+ Novo terminal" próprio — é `Alt+N` (o botão duplicava o atalho, 2026-09-29); criar num
 * projeto sem nenhum terminal continua a ter o CTA do estado vazio (`emptyProject`, `TerminalsPage.tsx`).
 */
export function TerminalGrid({ terminals, enlarged, onBackgroundMouseDown, children, headerExtra }: TerminalGridProps) {
  const counts = (Object.keys(COUNT_LABELS) as TerminalStatus[])
    .map((status) => ({ status, n: terminals.filter((t) => t.status === status).length }))
    .filter(({ n }) => n > 0);

  return (
    <div className="h-full flex flex-col min-w-0">
      <div className="h-16 flex-none flex items-center gap-5 px-5">
        <div className="flex flex-col gap-0.5">
          <span className="kicker">Terminais</span>
          <span className="text-[20px] leading-[26px] font-semibold">{terminals.length} abertos</span>
        </div>
        <div className="flex gap-4 text-[13px] text-text-2 pt-4">
          {counts.map(({ status, n }) => (
            <span key={status} className="flex items-center gap-1.5">
              <span className={`state-icon ${STATUS_META[status].icon}`} aria-hidden />
              {n} {COUNT_LABELS[status]}
            </span>
          ))}
        </div>
        <div className="flex-1" />
        {headerExtra}
      </div>
      <div
        className={`flex-1 min-h-0 px-5 pb-4 ${enlarged ? 'flex' : 'grid grid-cols-3 gap-3 overflow-y-auto'}`}
        // Duas linhas à vista; a partir de 6 mosaicos a grelha faz scroll.
        style={enlarged ? undefined : { gridAutoRows: 'calc((100% - 12px) / 2)' }}
        data-terminal-grid
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onBackgroundMouseDown();
        }}
      >
        {children}
      </div>
    </div>
  );
}
