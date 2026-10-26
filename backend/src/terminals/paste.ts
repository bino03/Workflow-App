/** Start and end of a bracketed paste: the TUI takes everything between them as text, never as keys. */
const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';

/**
 * Every control character except newline and tab (ADR 0020 point 7). Without this, an `ESC[201~` inside the
 * text would end the paste early and the rest would arrive as keys.
 */
// eslint-disable-next-line no-control-regex
const CONTROLS = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g;

/** `\r\n` and a lone `\r` become `\n` first, so a pasted Windows text keeps its line breaks. */
export function cleanPastedText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(CONTROLS, '');
}

/** The text as one bracketed paste, cleaned — several lines arrive as one message (guided spike, (d)). */
export function bracketedPaste(text: string): string {
  return `${PASTE_START}${cleanPastedText(text)}${PASTE_END}`;
}
