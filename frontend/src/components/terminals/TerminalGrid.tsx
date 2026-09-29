import type { CSSProperties, ReactNode } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import type { TerminalStatus, TerminalView } from '@/types/terminal';
import { type GridStyle, slotCount, slotPlacement } from './gridStyle';
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
  /** O `GridStylePicker`, no lugar onde estava o antigo botão "+ Novo terminal" (removido 2026-09-29). */
  stylePicker?: ReactNode;
  /** Estilo ativo (spec docs/features/estilos-de-grelha.md). */
  style: GridStyle;
  /** Só usado fora de `classic` — um id por lugar, pela ordem dos lugares; `null` = lugar vazio. */
  slotIds: (string | null)[];
  /** Clique num lugar vazio: abre um terminal novo e ocupa esse lugar. */
  onSlotNew: (index: number) => void;
};

const COUNT_LABELS: Record<TerminalStatus, string> = { running: 'a correr', exited: 'terminados', stopped: 'parados' };

function containerClasses(style: GridStyle, enlarged: boolean): string {
  if (enlarged) return 'flex-1 min-h-0 px-5 pb-4 flex';
  switch (style.kind) {
    case 'classic':
      return 'flex-1 min-h-0 px-5 pb-4 grid grid-cols-3 gap-3 overflow-y-auto';
    case 'columns':
      return 'flex-1 min-h-0 px-5 pb-4 flex gap-3';
    case 'quad':
      return 'flex-1 min-h-0 px-5 pb-4 grid grid-cols-2 grid-rows-2 gap-3';
    case 'spotlight':
      return 'flex-1 min-h-0 px-5 pb-4 grid gap-3';
  }
}

function containerStyle(style: GridStyle, enlarged: boolean): CSSProperties | undefined {
  if (enlarged) return undefined;
  // Duas linhas à vista; a partir de 6 mosaicos a grelha clássica faz scroll.
  if (style.kind === 'classic') return { gridAutoRows: 'calc((100% - 12px) / 2)' };
  if (style.kind === 'spotlight') return { gridTemplateColumns: '2fr 1fr', gridTemplateRows: '1fr 1fr' };
  return undefined;
}

function EmptySlot({ index, style, onClick }: { index: number; style: GridStyle; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Abrir terminal aqui"
      onClick={onClick}
      style={slotPlacement(style, index)}
      className="min-h-0 min-w-0 flex items-center justify-center rounded-lg border border-dashed border-border-strong bg-transparent text-text-3 cursor-pointer hover:bg-surface-2 hover:text-text-1"
    >
      <PlusOutlined style={{ fontSize: 20 }} />
    </button>
  );
}

/**
 * Grelha (protótipo 1i, mais os estilos da spec estilos-de-grelha): `classic` continua 3 colunas, duas
 * linhas à vista, scroll depois de 6 — sem noção de "lugares", nunca tem excesso. `columns`/`quad`/
 * `spotlight` têm lugares fixos (`slotIds`); um lugar `null` mostra o "+" tracejado (`onSlotNew`); um
 * terminal do projeto que não está em nenhum lugar (excesso) continua "a correr", só não aparece aqui —
 * a página é que decide `slotIds`/quem fica visível.
 */
export function TerminalGrid({
  terminals,
  enlarged,
  onBackgroundMouseDown,
  children,
  headerExtra,
  stylePicker,
  style,
  slotIds,
  onSlotNew,
}: TerminalGridProps) {
  const counts = (Object.keys(COUNT_LABELS) as TerminalStatus[])
    .map((status) => ({ status, n: terminals.filter((t) => t.status === status).length }))
    .filter(({ n }) => n > 0);
  const showEmptySlots = !enlarged && slotCount(style) !== null;

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
        {!enlarged && stylePicker}
        {headerExtra}
      </div>
      <div
        className={containerClasses(style, enlarged)}
        style={containerStyle(style, enlarged)}
        data-terminal-grid
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onBackgroundMouseDown();
        }}
      >
        {children}
        {showEmptySlots &&
          slotIds.map((id, index) => id === null && <EmptySlot key={index} index={index} style={style} onClick={() => onSlotNew(index)} />)}
      </div>
    </div>
  );
}
