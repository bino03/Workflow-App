import { win32 } from 'node:path';

export type ProjectIndexRow = {
  name: string;
  /** Absolute (base folder + relative column), not yet checked against ALLOWED_ROOTS. */
  path: string;
  type: string | null;
  stack: string | null;
  status: string | null;
};

const BASE_FOLDER = /Pasta base:\s*`([^`]+)`/;
const SEPARATOR_CELL = /^:?-+:?$/;

function stripMarkdown(cell: string): string {
  return cell.replace(/\*\*/g, '').replace(/`/g, '').trim();
}

function normalize(cell: string | undefined): string | null {
  const value = cell?.trim();
  return !value || value === '—' ? null : value;
}

function splitRow(line: string): string[] {
  const inner = line.startsWith('|') && line.endsWith('|') ? line.slice(1, -1) : line.replace(/^\|/, '');
  return inner.split('|').map(stripMarkdown);
}

function columnIndex(header: string[], prefix: string): number {
  return header.findIndex((cell) => cell.toLowerCase().startsWith(prefix));
}

/**
 * Reads the Workflow's `projects/INDEX.md` — a Markdown table for humans, not a manifest (there is no
 * frontmatter alternative for projects, unlike stacks/themes/skills — ADR 0005). Tolerant: a row missing
 * the columns this needs is skipped, and a file without "Pasta base" or a recognisable table returns `[]`
 * — never throws. Filtering (hiding `descartado`, checking ALLOWED_ROOTS) is the service's job, not this
 * parser's: it only reads what is on the page.
 */
export function parseProjectIndex(text: string): ProjectIndexRow[] {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const baseMatch = BASE_FOLDER.exec(withoutBom);
  if (!baseMatch) return [];
  const base = (baseMatch[1] ?? '').trim();
  if (!base) return [];

  const lines = withoutBom.split(/\r?\n/).map((line) => line.trim());
  const headerIndex = lines.findIndex((line) => line.startsWith('|') && /\bProjeto\b/.test(line));
  if (headerIndex === -1) return [];

  const header = splitRow(lines[headerIndex] ?? '');
  const nameCol = columnIndex(header, 'projeto');
  const pathCol = columnIndex(header, 'caminho');
  const typeCol = columnIndex(header, 'tipo');
  const stackCol = columnIndex(header, 'stack');
  const statusCol = columnIndex(header, 'estado');
  if (nameCol === -1 || pathCol === -1) return [];

  const rows: ProjectIndexRow[] = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.startsWith('|')) break; // the table ended
    const cells = splitRow(line);
    if (cells.every((cell) => SEPARATOR_CELL.test(cell))) continue; // the `|---|---|` row

    const name = normalize(cells[nameCol]);
    const relativePath = normalize(cells[pathCol]);
    if (!name || !relativePath) continue; // malformed row — skip, never throw

    rows.push({
      name,
      // The registry's paths are always Windows-style (backslashes), whatever OS runs the parser.
      path: win32.join(base, relativePath),
      type: typeCol === -1 ? null : normalize(cells[typeCol]),
      stack: stackCol === -1 ? null : normalize(cells[stackCol]),
      status: statusCol === -1 ? null : normalize(cells[statusCol]),
    });
  }
  return rows;
}
