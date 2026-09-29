import { describe, expect, it } from 'vitest';
import { parseProjectIndex } from '../src/projects/projectIndexParser.js';

// Shaped like the real `projects/INDEX.md` (confirmed 2026-09-28) — see docs/features/separadores-de-projetos.md §4.1.
const INDEX = `# 🗂️ Os meus projetos — registo

Pasta base: \`C:\\Users\\jlalv\\Desktop\\utad\\projetos\`

## Projetos

| Projeto | Caminho (relativo à base) | Tipo | Stack (resumo) | Entrada | Vault | Estado |
|---|---|---|---|---|---|---|
| **Worksite** | \`Worksite\\Worksite\` | meu | Spring Boot + React | \`CLAUDE.md\` | ✅ na raiz | ativo |
| **PortFolio - Frontend** | \`PortFolio - Frontend\` | meu | React + Vite | \`DESIGN_PROMPT.md\` | ❌ | — |
| **worksite-expenses** | \`worksite-expenses\` | meu | Next.js | \`CLAUDE.md\` | ❌ | descartado (2026-09-06) |
| Linha sem caminho | | meu | — | — | ❌ | — |

**Tipo**: \`meu\` · \`gerado\` · \`adotado\`.
`;

describe('parseProjectIndex', () => {
  it('extracts the rows with the absolute path resolved from "Pasta base"', () => {
    const rows = parseProjectIndex(INDEX);
    expect(rows).toEqual([
      { name: 'Worksite', path: 'C:\\Users\\jlalv\\Desktop\\utad\\projetos\\Worksite\\Worksite', type: 'meu', stack: 'Spring Boot + React', status: 'ativo' },
      { name: 'PortFolio - Frontend', path: 'C:\\Users\\jlalv\\Desktop\\utad\\projetos\\PortFolio - Frontend', type: 'meu', stack: 'React + Vite', status: null },
      { name: 'worksite-expenses', path: 'C:\\Users\\jlalv\\Desktop\\utad\\projetos\\worksite-expenses', type: 'meu', stack: 'Next.js', status: 'descartado (2026-09-06)' },
    ]);
  });

  it('skips a row with no path instead of throwing', () => {
    const rows = parseProjectIndex(INDEX);
    expect(rows.some((row) => row.name === 'Linha sem caminho')).toBe(false);
  });

  it('returns [] without a "Pasta base" line', () => {
    expect(parseProjectIndex('# Registo\n\n| Projeto | Caminho | Estado |\n|---|---|---|\n| X | Y | ativo |')).toEqual([]);
  });

  it('returns [] without a recognisable table', () => {
    expect(parseProjectIndex('Pasta base: `C:\\projetos`\n\nSem tabela nenhuma aqui.')).toEqual([]);
  });

  it('returns [] for an empty file', () => {
    expect(parseProjectIndex('')).toEqual([]);
  });

  it('never throws on a header without the required columns', () => {
    const noPathColumn = 'Pasta base: `C:\\projetos`\n\n| Projeto | Estado |\n|---|---|\n| X | ativo |';
    expect(() => parseProjectIndex(noPathColumn)).not.toThrow();
    expect(parseProjectIndex(noPathColumn)).toEqual([]);
  });
});
