# CLAUDE.md — frontend

> Ponteiro. A documentação está no vault, na raiz do repo.

- Convenções e armadilhas: [[../docs/frontend-conventions]]
- Design: [[../docs/skills/references/frontend-visual-consistency]] — Violeta + Geist ([[../docs/adr/0008-identidade-visual]])
- Comandos: [[../docs/commands]] · Variáveis: [[../docs/environment]]

**Como trabalhar aqui**
- Nenhum hex fora dos tokens; os protótipos em `docs/design/handoff-2026-09-27/` são referência, não código.
- Qualquer componente/página: `/frontend-design-system`. Type-check: `npx tsc -b` (nunca `--noEmit`).
- Dev server na 7401 com `strictPort` — não colidir com os projetos abertos nos terminais.
