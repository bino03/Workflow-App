import type { TerminalView } from '@/types/terminal';
import { folderName } from './terminalDisplay';

/**
 * Um projeto é uma pasta (spec §3, 2026-09-28): nada novo a gravar. A lateral mostra os projetos com
 * terminais, pela ordem do primeiro terminal de cada um, e depois as favoritas ainda sem terminais.
 */
export type Project = { path: string; name: string; favorite: boolean; terminals: TerminalView[] };

export function groupByProject(terminals: TerminalView[], favorites: string[]): Project[] {
  const byPath = new Map<string, Project>();
  const favoriteSet = new Set(favorites);
  // A lista do backend já vem por createdAt.
  for (const terminal of terminals) {
    let project = byPath.get(terminal.cwd);
    if (!project) {
      project = { path: terminal.cwd, name: folderName(terminal.cwd), favorite: favoriteSet.has(terminal.cwd), terminals: [] };
      byPath.set(terminal.cwd, project);
    }
    project.terminals.push(terminal);
  }
  const idle = favorites
    .filter((path) => !byPath.has(path))
    .map((path) => ({ path, name: folderName(path), favorite: true, terminals: [] }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return [...byPath.values(), ...idle];
}

/** A ordem da lateral — é a que o Alt+1…9 segue. */
export function orderedTerminals(projects: Project[]): TerminalView[] {
  return projects.flatMap((project) => project.terminals);
}

/** O rótulo, senão o nome da pasta — numerado quando o projeto tem mais do que um terminal. */
export function displayNames(projects: Project[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const project of projects) {
    project.terminals.forEach((terminal, index) => {
      const fallback = project.terminals.length > 1 ? `${project.name} ${index + 1}` : project.name;
      names.set(terminal.id, terminal.label ?? fallback);
    });
  }
  return names;
}
