import { TERMINAL_LIMITS, type TerminalSize } from '@/types/terminal';

/** Tipografia do terminal — handoff de design: mono 13 / 19 (foco) e 12 / 17 (grelha). */
export const TERMINAL_FONT = {
  family: "'Geist Mono', monospace",
  focus: { size: 13, lineHeight: 19 / 13 },
  grid: { size: 12, lineHeight: 17 / 12 },
} as const;

/** Carrega a Geist Mono antes de abrir um xterm.js: com a fonte de recurso as medidas das células saem erradas. */
export async function loadTerminalFont(): Promise<void> {
  try {
    await document.fonts.load(`${TERMINAL_FONT.focus.size}px 'Geist Mono'`);
  } catch {
    // Sem a fonte (offline), o monospace de recurso serve.
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Colunas × linhas que cabem num contentor — para o POST de criação, antes de existir um xterm.js: o
 * `claude` arranca logo com o tamanho certo em vez de 80×24 (docs/api.md → Protocolo do WebSocket).
 */
export function estimateTerminalSize(width: number, height: number, font: { size: number; lineHeight: number } = TERMINAL_FONT.focus): TerminalSize {
  const probe = document.createElement('span');
  probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font-family:${TERMINAL_FONT.family};font-size:${font.size}px`;
  probe.textContent = 'W'.repeat(50);
  document.body.appendChild(probe);
  const cellWidth = probe.getBoundingClientRect().width / 50 || font.size * 0.6;
  probe.remove();
  return {
    cols: clamp(Math.floor(width / cellWidth), TERMINAL_LIMITS.minCols, TERMINAL_LIMITS.maxCols),
    rows: clamp(Math.floor(height / (font.size * font.lineHeight)), TERMINAL_LIMITS.minRows, TERMINAL_LIMITS.maxRows),
  };
}
