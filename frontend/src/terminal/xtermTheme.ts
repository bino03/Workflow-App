import type { ITheme } from '@xterm/xterm';

// O xterm.js não aceita var(...): único sítio com o hex do terminal em JS — tokens-and-colors.md §8.
// O fundo é o --wfa-color-bg: o terminal funde-se com a página.
export const xtermTheme: ITheme = {
  background: '#090911',
  foreground: '#DDDDE3',
  cursor: '#A88FFF',
  cursorAccent: '#090911',
  selectionBackground: '#3E365C',
  black: '#82849A',
  red: '#F66D67',
  green: '#5FD37F',
  yellow: '#F1CA47',
  blue: '#6AA7F4',
  magenta: '#DF7FD7',
  cyan: '#44D4E2',
  white: '#CFD0DC',
  brightBlack: '#9DA0B6',
  brightRed: '#FF958D',
  brightGreen: '#82EC9C',
  brightYellow: '#FFE47C',
  brightBlue: '#91C1FF',
  brightMagenta: '#F0A1E9',
  brightCyan: '#80EBF7',
  brightWhite: '#F5F6FC',
};

export const xtermFont = {
  fontFamily: "'Geist Mono', monospace",
  fontSize: 13,
  lineHeight: 1.46,
} as const;
