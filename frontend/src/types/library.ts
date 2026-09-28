/** Espelho das respostas de GET /api/library/* (backend/src/library/library.schemas.ts). */

/** Os três chips do ecrã; `maturityRaw` guarda o valor escrito no manifesto. */
export type Maturity = 'proven' | 'partial' | 'draft';

type LibraryEntryBase = {
  maturity: Maturity;
  maturityRaw: string;
  updated: string | null;
  path: string;
};

export type StackEntry = LibraryEntryBase & {
  id: string;
  name: string;
  layer: string;
  technologies: string[];
  pairsWith: string[];
  providesSkills: string[];
};

export type ThemeEntry = LibraryEntryBase & {
  id: string;
  name: string;
  mode: string | null;
  density: string | null;
  suits: string[];
  frontendStacks: string[];
  fonts: string[];
};

export type SkillEntry = LibraryEntryBase & {
  name: string;
  category: string;
  appliesWhen: string | null;
  description: string;
  stack: string | null;
};

export type InvalidEntry = { path: string; message: string };

export type LibraryList<T> = { entries: T[]; invalid: InvalidEntry[] };

export type LibraryKind = 'stacks' | 'themes' | 'skills';

export type LibraryEntry =
  | { kind: 'stacks'; entry: StackEntry }
  | { kind: 'themes'; entry: ThemeEntry }
  | { kind: 'skills'; entry: SkillEntry };
