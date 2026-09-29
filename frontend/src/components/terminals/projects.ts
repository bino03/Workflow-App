import type { ProjectEntry } from '@/types/project';
import type { TerminalView } from '@/types/terminal';
import { folderName } from './terminalDisplay';

/**
 * Um projeto é uma pasta (spec [[terminais]] §3). Desde a spec separadores-de-projetos (2026-09-28), a
 * lateral já não é só "pastas com terminais": junta o **registo** do Workflow (`registry`, de
 * `GET /api/projects`) com os terminais que já existem — um projeto pode ter registo sem terminais
 * (ainda por abrir), terminais sem registo (saiu do `projects/INDEX.md`, ou nunca lá esteve), ou os dois.
 */
export type Project = {
  path: string;
  name: string;
  favorite: boolean;
  /** `null` quando o projeto não está (ou já não está) no `projects/INDEX.md` do Workflow. */
  registry: ProjectEntry | null;
  terminals: TerminalView[];
};

/**
 * Junta o registo com os terminais existentes, por caminho — os dois já vêm resolvidos
 * (`resolveAllowedPath` no backend), por isso a comparação é uma igualdade de string direta, sem
 * normalizar maiúsculas/minúsculas outra vez. Ordem: a do registo primeiro (a do `projects/INDEX.md`),
 * depois os projetos só com terminais ("órfãos" do registo), por nome.
 */
export function joinProjects(registry: ProjectEntry[], terminals: TerminalView[], favorites: string[]): Project[] {
  const favoriteSet = new Set(favorites);
  const byPath = new Map<string, Project>();
  const order: string[] = [];

  for (const entry of registry) {
    byPath.set(entry.path, { path: entry.path, name: entry.name, favorite: favoriteSet.has(entry.path), registry: entry, terminals: [] });
    order.push(entry.path);
  }

  const orphans: string[] = [];
  for (const terminal of terminals) {
    let project = byPath.get(terminal.cwd);
    if (!project) {
      project = { path: terminal.cwd, name: folderName(terminal.cwd), favorite: favoriteSet.has(terminal.cwd), registry: null, terminals: [] };
      byPath.set(terminal.cwd, project);
      orphans.push(terminal.cwd);
    }
    project.terminals.push(terminal);
  }
  orphans.sort((a, b) => (byPath.get(a)?.name ?? '').localeCompare(byPath.get(b)?.name ?? '', undefined, { sensitivity: 'base' }));

  return [...order, ...orphans].map((path) => byPath.get(path)).filter((project): project is Project => project !== undefined);
}

/** Os projetos com pelo menos um terminal — abrem logo um separador ao carregar a página (spec §3). */
export function projectsWithTerminals(projects: Project[]): Project[] {
  return projects.filter((project) => project.terminals.length > 0);
}

/** O rótulo de cada terminal — senão o nome da pasta, numerado quando o projeto tem mais do que um. */
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
