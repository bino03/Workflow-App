# 🧬 Proveniência

Este vault foi **gerado pelo Workflow** (`C:\Users\jlalv\Desktop\Workflow\Workflow`) a 2026-09-27, a partir
da biblioteca na versão `6d8aaff`. Depois de gerado, o projeto é **autónomo**: evolui por
conta própria e não depende do Workflow.

## O que o compôs

| | |
|---|---|
| **Stacks** | `node-fastify` (📋 criado na hora — Node + TypeScript + Fastify + node-pty) + `react-vite-antd` (✅) + xterm.js |
| **Flags** | `has-backend` · `has-frontend` · `auth` · `feature-specs` · `design-pending` · `prospective` |
| **Tema** | pending |
| **Padrões de arquitetura** | `auth-jwt-httponly-cookies` (adaptado a um só utilizador, sem provedor externo) · `backend-single-source-of-truth` · `packages-by-domain` (adaptado a módulos Node) |
| **Skills** | process: create-new-skill, design-database, git-commits, implement-todo, refine-idea, run, choose-design, plan-feature · frontend: frontend-design-system, frontend-error-handling, frontend-integration-guide, frontend-structure-brief |

As respostas da entrevista estão em [[product/project-profile]].

## Estado do que veio da biblioteca

- Documentos marcados 🚧 descrevem **intenção**, não código — normal num projeto acabado de criar.
- As referências de design do frontend nasceram **prospetivas** (secção "Drift encontrado" vazia). Passam
  a descrever código à medida que as páginas nascem.

## Devolver lições ao Workflow

Quando este projeto amadurecer uma prática melhor do que a da biblioteca (uma skill, uma convenção, uma
armadilha), corre-se `/harvest-project` **no Workflow** apontado a este projeto.

## Atualizações do Workflow

Cada passagem do `/upgrade-project` (feito **no Workflow**) regista-se aqui. O último commit desta tabela é o
ponto de partida do relatório seguinte; o que ficou de fora escreve-se na linha, com a razão — deixa de aparecer
no relatório seguinte (`--from <commit>` para o rever).

| Data | Workflow | O que se aplicou · o que ficou de fora e porquê |
|---|---|---|
| 2026-09-27 | `6d8aaff` | Geração inicial |
| 2026-10-09 | `eff6838` | **Aplicado (13)**: regra do Zod/RHF só com validação no cliente (skill `frontend-design-system` e `forms-and-validation`, com a exceção «escolha + ficheiro»); tirado o i18n que este projeto não tem (skill, `drawers-and-modals`, checklist); `refine-idea` (Step 0 em texto, rondas extra só para contradições, destino «módulo inteiro», «reabrir a decisão X»); `implement-todo` Fase 2 (hipótese, não dado); links do `ai-workflow` e do `security-baseline`. **Fora**: `skill-design-database` ×2 (este projeto não tem BD — `state.json`); `docs/commands.md` e `docs/operations.md` (só redação do molde); os ⚠️ (`CLAUDE.md` regra 3, `database.md`, `operations.md`, `tables-and-lists` — editados de propósito por este projeto). |
| 2026-11-12 | `15c58e8` | **Aplicado (26)**: tier de modelo por item do ToDo — `ai-workflow` (secção "Tiers de modelo"), `implement-todo` (contagem e âmbito por tier, aviso 1.3, tier na investigação, plano agrupado por tier), `refine-idea`, `plan-feature` + template da spec (linha **Sessões**), `design-database`, `choose-design`; legenda no `notes/ToDo.md` · nada de fora |
| 2026-11-13 | `b55f327` | **Aplicado (37)**: `plan-feature` (spec sem estado, fases que entram em uso sozinhas, "não sei" → perguntas em aberto, um bullet por fase no ToDo) + `docs/features/_TEMPLATE.md` e `README.md`; `implement-todo` ("Fases de uma spec" no lugar do "Modo spec"); `skill-run` → Parar (o `node` órfão no Windows, matar pelo PID da porta); `ai-workflow`; `testing-and-verification` (código de saída escondido, testes instáveis com a CPU carregada); `ux-patterns` §8.1 (portátil → telemóvel); `app-shell-and-auth` (cache vazia num tab novo → esperar o `/auth/me`); `services-and-error-handling` (`normalizePage`); `tables-and-lists` e `frontend-design-system` sem a variante de roles; `frontend-structure-brief`; `code-best-practices`. **Skill nova**: `add-backend-feature` (stack `node-fastify`, tirada deste projeto). **Fora**: `docs/operations.md` → "Atualizar a app" (app local, sem deploy nem BD); skill `data-operation` (sem BD); os ⚠️ de `app-shell-and-auth` (o texto daqui, de um só papel, é o certo) e o link de `ux-patterns`. As specs já escritas mantêm a secção "Estado atual" — só as novas seguem o molde |

## Relacionado

[[product/project-profile]] · [[adr/README]]
