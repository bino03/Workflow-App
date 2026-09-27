# 🎯 Skills Index

**Referência principal de todas as skills e referências do Workflow App.**

> ⚠️ **Regra de manutenção** — cada skill nova:
> 1. Entrada aqui, na secção certa
> 2. Linha em [[SKILLS-QUICK-REFERENCE]]
> 3. Ponteiro em `.claude/skills/<nome>/SKILL.md`
> 4. "Last Updated" atualizado nos dois índices
>
> Ver [[skill-create-new-skill]]. Uma **skill** é invocável (`/nome`) — uma checklist que se corre. Uma
> **referência** é um documento de convenções que uma skill lê; nunca se invoca e não tem ponteiro.

---

## 📐 Referências (não invocáveis)

Lidas pelas skills antes de produzirem código ou um `.md`. Vivem em `docs/skills/references/`.

### Código e processo
- **[[code-best-practices]]** — as regras transversais + as regras de cada stack. **Ler antes de escrever código.**
- **[[naming-conventions]]** — nomes: código em inglês, docs em português, casos por linguagem
- **[[error-model]]** — `ErrorCode` + formato de erro único, espelhado no frontend
- **[[api-design]]** — rotas, verbos, respostas
- **[[data-modeling]]** — como se desenha uma tabela (se vier a haver BD)
- **[[security-baseline]]** — o mínimo de segurança que nenhum projeto dispensa
- **[[testing-and-verification]]** — quando uma tarefa está feita
- **[[ai-workflow]]** — como trabalhar com o Claude neste projeto
- **[[documentation-rules]]** — uma cópia de cada facto; o que vai para onde

### Frontend
- **[[project-vocabulary]]** — termos de UI + vocabulário do domínio (PT → EN)
- **[[ux-patterns]]** — padrões de UX validados
- **[[frontend-visual-consistency]]** — router das referências de design (🚧 prospetivas):
  [[tokens-and-colors]] (⛔ design por escolher) · [[app-shell-and-auth]] · [[buttons-and-icons]] ·
  [[cards]] · [[drawers-and-modals]] · [[forms-and-validation]] · [[services-and-error-handling]] ·
  [[tables-and-lists]]

---

## ⚙️ Processo (`docs/skills/process/`)

| Skill | Para quê |
|---|---|
| [[skill-implement-todo]] (`/implement-todo`) | Avançar o backlog de `notes/ToDo.md`, do plano à implementação e ao registo |
| [[skill-refine-idea]] (`/refine-idea`) | Transformar uma ideia numa entrada do ToDo (ou de ideas) |
| [[skill-plan-feature]] (`/plan-feature`) | Spec de uma feature de várias sessões em `docs/features/` |
| [[skill-design-database]] (`/design-database`) | Decidir o modelo de dados (ou que não há BD) a partir do domain brief |
| [[skill-choose-design]] (`/choose-design`) | ⛔ Escolher o design antes de qualquer ecrã |
| [[skill-run]] (`/run`) | Arrancar a app (backend + frontend) e confirmar que responde |
| [[skill-git-commits]] (`/git-commits`) | Estilo dos commits |
| [[skill-create-new-skill]] (`/create-new-skill`) | Criar e registar uma skill ou referência nova |

## 🎨 Frontend (`docs/skills/frontend/`)

| Skill | Para quê |
|---|---|
| [[skill-frontend-design-system]] (`/frontend-design-system`) | Construir ou alterar componentes, páginas, formulários, listas |
| [[skill-frontend-error-handling]] (`/frontend-error-handling`) | Erros da API no frontend, espelho dos `ErrorCode` |
| [[skill-frontend-integration-guide]] (`/frontend-integration-guide`) | Handoff de uma feature de backend para a UI |
| [[skill-frontend-structure-brief]] (`/frontend-structure-brief`) | Retrato de uma página existente para uma conversa de redesign |

## 🖥️ Backend

_Sem skills ainda_ — a stack `node-fastify` é 📋 (criada na hora, sem código provado). Quando um padrão
se repetir 2-3 vezes (ex.: "acrescentar um endpoint", "acrescentar uma mensagem ao protocolo do
WebSocket"), `/create-new-skill`.

---

## Last Updated

- **Data**: 2026-09-27
- **Origem**: gerado pelo Workflow ([[../provenance]])
