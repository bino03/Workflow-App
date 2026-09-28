# 📚 Workflow App — Índice

**Ponto de partida do vault.** Usa os links abaixo ou **Ctrl+Shift+F** para procurar em tudo.

> Uma UI própria para o Claude Code — gerir várias sessões ao mesmo tempo e navegar a biblioteca do Workflow sem abrir o Obsidian.

> 🌱 Gerado pelo Workflow a 2026-09-27 — ver [[docs/provenance]]. Quase todos os documentos começam em
> 🚧 (intenção, sem código ainda); isso é normal e está assinalado de propósito.

> ⛔ **Modelo de dados por desenhar.** Antes de qualquer tabela de negócio: `/design-database` — parte do
> [[docs/product/domain-brief]], que já tem o contexto de dados recolhido na criação.

---

## ⭐ Skills

👉 **[[docs/skills/SKILLS-INDEX]]** — todas as skills e referências
👉 **[[docs/skills/SKILLS-QUICK-REFERENCE]]** — consulta rápida
👉 **Para uma ideia nova**: `/refine-idea` — diz o que queres adicionar; fica no [[notes/ToDo]] ou em [[notes/ideas]]
👉 **Para avançar o backlog**: `/implement-todo` — lê [[notes/ToDo]], prioriza e implementa
👉 **Para uma feature que leva várias sessões**: `/plan-feature` → spec em `docs/features/`

**Antes de escrever código, sempre**: [[code-best-practices]] · [[naming-conventions]] · [[frontend-visual-consistency]]

---

## 🧱 As peças

| Peça | O que é | Pasta | Arrancar | Porta |
|---|---|---|---|---|
| **Backend** — `node-fastify` 📋 | Node + TypeScript + Fastify + `node-pty`: gere os terminais (PTYs com o `claude`), serve-os por WebSocket, lê a biblioteca do Workflow, faz o login | `backend/` | `npm run dev` | 7400 |
| **Frontend** — `react-vite-antd` ✅ | React 19 + Vite 7 + Ant Design 6 + Tailwind 4, com xterm.js para os terminais | `frontend/` | `npm run dev` | 7401 |

> 📋 A stack de backend foi criada na hora pelo `/create` — as convenções estão em 🚧 até haver código.

---

## 📖 Documentação

### Arquitetura e operação
- **Onde está o código disto?** → [[docs/code-map]]
- **Comandos** → [[docs/commands]] — correr, testar, build, e as armadilhas
- **Variáveis de ambiente** → [[docs/environment]]
- **Arquitetura** → [[docs/architecture]]
- **Base de dados** → [[docs/database]]
- **API** → [[docs/api]]
- **Convenções do backend** → [[docs/backend-conventions]]
- **Operações** → [[docs/operations]] — produção, backup/restore, migração má
- **Convenções do frontend** → [[docs/frontend-conventions]]
- **Segurança** → [[docs/security]]
- **Hook de pre-commit** → [[docs/vault-sync-hooks]]
- **Proveniência** → [[docs/provenance]]

### Produto
- [[docs/product/overview]] — o que é, para quem, problema, fora de âmbito
- [[docs/product/use-cases]] — casos de uso e ecrãs
- [[docs/product/design-brief]] — contexto para quem desenha a interface
- [[docs/design/handoff-2026-09-27/README|docs/design/handoff-2026-09-27]] — o handoff do Claude Design (Violeta + Geist) e os protótipos de referência
- [[docs/product/project-profile]] — as respostas da entrevista que gerou este vault
- [[docs/product/domain-brief]] — o contexto de dados (entidades, relações, quem vê o quê) para o `/design-database`

### Decisões
- [[docs/adr/README]] — ADRs. **Nunca editar um ADR antigo** — criar um novo que o substitua.
- [[docs/features/README]] — specs de features multi-sessão

---

## 📝 Notas (git-ignored)

O ciclo é `ideas → ToDo → plans → whatIveDone` — ver [[notes/README]].

- **Backlog acionável** → [[notes/ToDo]] ⭐
- **Ideias em bruto** → [[notes/ideas]]
- **Estado das iniciativas** → [[notes/roadmap/backlog]]
- **Work log** → [[notes/whatIveDone]]
- **Bugs** → [[notes/bugs]] · **Refactoring** → [[notes/refactoring]] · **Lições** → [[notes/learning]]

---

## 📋 Primeira vez aqui?

1. Ler [[CLAUDE]] e este índice.
2. Variáveis de ambiente → [[docs/environment]]
3. Arrancar, testar → [[docs/commands]]
4. Ativar o hook: `git config core.hooksPath .githooks` → [[docs/vault-sync-hooks]]
5. Obsidian: *Open folder as vault* → `Workflow App/`

## 🧠 Obsidian

**Ctrl+P** abrir ficheiro · **Ctrl+Shift+F** pesquisa · **Ctrl+G** grafo · **Ctrl+Shift+I** backlinks · **Ctrl+T** template

## 📋 Onde é que isto vai?

| Tenho... | Vai para |
|---|---|
| Uma ideia solta | `notes/ideas.md` — ou `/refine-idea`, que a amadurece e decide |
| Uma tarefa concreta | `notes/ToDo.md` |
| Uma decisão de arquitetura | novo ADR em `docs/adr/` |
| Um facto sobre como o sistema funciona | `docs/` |
| Um padrão que já repeti 2-3 vezes | `/create-new-skill` |
| Algo que custou tempo e não era da app | `notes/learning.md` |
