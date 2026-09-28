import { z } from 'zod';

/**
 * The three chips of the Library screen. Each kind has its own vocabulary in the Workflow:
 * stacks proven/partial/planned, themes proven/adapted/draft, skills proven/adapted/prospective.
 */
export type Maturity = 'proven' | 'partial' | 'draft';

const MATURITY_OF: Record<string, Maturity> = {
  proven: 'proven',
  partial: 'partial',
  adapted: 'partial',
  planned: 'draft',
  draft: 'draft',
  prospective: 'draft',
};

const text = z.string().trim().min(1);
const list = z.array(z.string()).default([]);
// YAML's core schema keeps dates as strings; a bare number or a missing value is tolerated.
const updated = z.union([z.string(), z.number()]).transform(String).optional();

export const stackManifestSchema = z.object({
  kind: z.literal('stack-doc'),
  id: text,
  name: text,
  layer: text,
  maturity: z.enum(['proven', 'partial', 'planned']),
  versions: z.record(z.string(), z.unknown()).default({}),
  'pairs-with': list,
  'provides-skills': list,
  updated,
});

export const themeManifestSchema = z.object({
  kind: z.literal('theme'),
  id: text,
  name: text,
  mode: z.string().optional(),
  density: z.string().optional(),
  status: z.enum(['proven', 'adapted', 'draft']),
  suits: list,
  'frontend-stacks': list,
  fonts: list,
  updated,
});

export const skillManifestSchema = z.object({
  kind: z.literal('skill'),
  name: text,
  category: text,
  status: z.enum(['proven', 'adapted', 'prospective']),
  'applies-when': z.string().optional(),
  description: z.string().default(''),
  updated,
});

type Common = {
  maturity: Maturity;
  /** The value written in the manifest, shown in the tag. */
  maturityRaw: string;
  updated: string | null;
  /** Absolute path of the manifest (the drawer's "Copiar caminho"). */
  path: string;
};

export type StackEntry = Common & {
  id: string;
  name: string;
  layer: string;
  technologies: string[];
  pairsWith: string[];
  providesSkills: string[];
};

export type ThemeEntry = Common & {
  id: string;
  name: string;
  mode: string | null;
  density: string | null;
  suits: string[];
  frontendStacks: string[];
  fonts: string[];
};

export type SkillEntry = Common & {
  name: string;
  category: string;
  appliesWhen: string | null;
  description: string;
  /** Set for skills that live inside a stack (`stacks/<id>/skills/`). */
  stack: string | null;
};

/** A manifest that could not be read — listed, never fatal (ADR 0005). */
export type InvalidEntry = { path: string; message: string };

export type LibraryList<T> = { entries: T[]; invalid: InvalidEntry[] };

export function maturityOf(raw: string): Maturity {
  return MATURITY_OF[raw] ?? 'draft';
}
