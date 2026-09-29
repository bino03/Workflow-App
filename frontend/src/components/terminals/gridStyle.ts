import type { CSSProperties } from 'react';

/**
 * Estilos de grelha (spec docs/features/estilos-de-grelha.md): o modo Grelha deixa de ter uma única
 * forma (3×2, `classic`) e passa a poder mostrar `columns`/`quad`/`spotlight`, cada um com um número
 * fixo de "lugares". `classic` não tem lugares — mostra sempre todos os terminais, como hoje.
 */
export type GridStyle =
  | { kind: 'classic' }
  | { kind: 'columns'; count: 2 | 3 | 4 }
  | { kind: 'quad' }
  | { kind: 'spotlight' };

export const DEFAULT_GRID_STYLE: GridStyle = { kind: 'classic' };

/** null = sem lugares fixos (classic mostra sempre todos, nunca há "excesso"). */
export function slotCount(style: GridStyle): number | null {
  switch (style.kind) {
    case 'classic':
      return null;
    case 'columns':
      return style.count;
    case 'quad':
      return 4;
    case 'spotlight':
      return 3;
  }
}

/**
 * Os primeiros N terminais (ordem do `shortcutIndex`, a mesma do Alt+1…9) preenchem os lugares; os
 * lugares a mais que sobrarem (menos terminais do que lugares) ficam `null` — mostra o "+" vazio.
 * `classic` não tem lugares: devolve os terminais tal como vieram, sem preencher nem cortar.
 */
export function initialSlotIds(style: GridStyle, terminalIdsInOrder: string[]): (string | null)[] {
  const n = slotCount(style);
  if (n === null) return [...terminalIdsInOrder];
  return Array.from({ length: n }, (_, i) => terminalIdsInOrder[i] ?? null);
}

/**
 * `grid-column`/`grid-row` (ou `order`, em `columns`, onde todos os lugares são iguais) de cada lugar.
 * Sempre CSS sobre o **mesmo** contentor plano (`TerminalGrid.tsx`) — nunca aninha nem muda a posição no
 * DOM dos terminais já montados, para trocar de estilo nunca desligar um WebSocket só por reorganizar o
 * ecrã.
 */
export function slotPlacement(style: GridStyle, index: number): CSSProperties {
  switch (style.kind) {
    case 'classic':
      return {};
    case 'columns':
      return { order: index };
    case 'quad':
      return (
        [
          { gridColumn: 1, gridRow: 1 },
          { gridColumn: 2, gridRow: 1 },
          { gridColumn: 1, gridRow: 2 },
          { gridColumn: 2, gridRow: 2 },
        ] satisfies CSSProperties[]
      )[index] ?? {};
    case 'spotlight':
      // 1 grande (coluna 1, as duas linhas) + 2 pequenos empilhados (coluna 2).
      return (
        [
          { gridColumn: 1, gridRow: '1 / span 2' },
          { gridColumn: 2, gridRow: 1 },
          { gridColumn: 2, gridRow: 2 },
        ] satisfies CSSProperties[]
      )[index] ?? {};
  }
}
