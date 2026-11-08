import type { ProjectInfo } from '@/types/projectInfo';

/** Sugestões fixas do campo Hosting (spec informacao-dos-projetos §4.4); o campo aceita qualquer texto. */
export const HOSTING_SUGGESTIONS = [
  'Vercel',
  'Netlify',
  'Railway',
  'Render',
  'Fly.io',
  'Cloudflare',
  'Supabase',
  'AWS',
  'Hetzner',
  'VPS próprio',
] as const;

/** As sugestões mais os hostings já usados em qualquer ficha, sem duplicados (sem distinguir maiúsculas). */
export function hostingOptions(infos: readonly ProjectInfo[]): string[] {
  const used = infos.flatMap((info) => info.environments.map((environment) => environment.hosting));
  const seen = new Set<string>();
  const options: string[] = [];
  for (const name of [...HOSTING_SUGGESTIONS, ...used]) {
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    options.push(name);
  }
  return options;
}
