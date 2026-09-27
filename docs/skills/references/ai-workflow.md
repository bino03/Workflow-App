# Trabalhar com o Claude neste ecossistema

**When to use**: ao criar ou manter skills, ao decidir se algo é skill ou referência, ao planear
trabalho que atravessa sessões.

---

## Skill vs. referência

| | **Skill** | **Referência** |
|---|---|---|
| Invocada? | Sim — `/nome` | Nunca sozinha |
| Ponteiro em `.claude/skills/`? | Sim | Não |
| Pasta | `docs/skills/<categoria>/skill-<nome>.md` | `docs/skills/references/<nome>.md` |
| É | Uma checklist que se **corre** para fazer algo | Convenções que uma skill **lê** e aplica ao que produz |
| Exemplo | "Adicionar uma feature de backend" | "Boas práticas de código" |

**Cria-se skill** para um padrão que já se repetiu 2-3 vezes. **Não** para: tarefa única,
roadmap (→ `notes/roadmap/`), decisão de arquitetura (→ ADR), bug (→ `notes/bugs.md`).

## Ponteiros finos

O conteúdo de uma skill vive **no vault** (`docs/skills/…`). O `SKILL.md` em `.claude/skills/`
é só um ponteiro de 3-5 linhas:

```markdown
---
name: add-backend-feature
description: <em pt-PT: o que cobre E quando usar ("Usar quando…"), com palavras-gatilho concretas — é isto que decide a invocação e o que aparece no menu `/`>
---

Before writing code, read `${CLAUDE_PROJECT_DIR}/docs/skills/references/code-best-practices.md`.
Then read `${CLAUDE_PROJECT_DIR}/docs/skills/backend/skill-add-backend-feature.md` in full and follow it step by step.

If asked to update this checklist, edit the vault file above, not this pointer.
```

**Um ponteiro por repositório, na raiz.** O Claude Code procura `.claude/skills/` subindo até à
raiz do repo — um ponteiro na raiz serve backend e frontend. Cópias em subpastas são uma
segunda coisa a manter.

Criar uma skill atualiza **quatro** sítios: o ficheiro do vault, `SKILLS-INDEX.md`,
`SKILLS-QUICK-REFERENCE.md` e o ponteiro. Esquecer o quick-reference esconde a skill; esquecer
o ponteiro torna-a não invocável.

## Routers de referências

Quando uma área tem muitas convenções (design de frontend), a referência principal é um
**router**: uma tabela "vais construir X → lê o sub-ficheiro Y". Lê-se **só** o sub-ficheiro
relevante — ler os oito de cada vez é o mesmo que não ler nenhum.

## Trabalho que atravessa sessões

O contexto morre entre sessões. O que sobrevive é o que está escrito:

- **Planos** (`notes/roadmap/plans/`) com checkpoint antes e depois de cada tarefa, e um
  "Próximo passo" exato — permite retomar mesmo que a sessão morra sem aviso.
- **Specs de feature** (`docs/features/`, com a flag `feature-specs`) escritas para uma sessão
  que **nunca viu a conversa**, com secção "Estado atual" atualizada no fim de cada sessão — as
  checkboxes mentem quando uma sessão morre a meio de um passo.
- **Work log** com o texto verbatim do item do ToDo — preserva o que foi realmente decidido.

## Agentes e tiers de modelo (flag `agents`)

| Agente | Modelo | Para quê |
|---|---|---|
| `investigator` | sonnet, só-leitura | Explorar uma área e devolver conclusões; vários em paralelo |
| `architect` | opus | Contrato partilhado, schema, segurança — onde errar é caro |
| `implementer` | sonnet | Um passo com desenho decidido mas que exige julgamento |
| `mechanical` | haiku | Um passo **totalmente especificado** (ficheiro e conteúdo exatos) |

- **O tier de um passo é o modelo mínimo, não o sítio onde corre.** Se a sessão principal já é
  Opus, um passo de desenho corre nela (tem o contexto); se não é, vai para o `architect`.
- **Paralelismo só para investigação só-leitura.** Passos de implementação são sequenciais —
  tocam nos mesmos ficheiros.
- Na dúvida sobre se um passo é mecânico, sobe-se um tier. Um passo mal especificado entregue ao
  Haiku custa mais a corrigir do que o que poupou.
- **A verificação no browser corre inline, nunca num subagente** — a extensão pertence à sessão
  principal.

## Perguntar ao utilizador

- **Perguntar em bloco**, agrupado, não uma pergunta de cada vez.
- **Propor um default** quando há um óbvio ("assumo X, confirmas?").
- **Não perguntar o que já está decidido** em ADRs, skills ou no vault.
- **Nunca inventar requisitos de negócio** — perguntar. Se o utilizador não sabe responder, o item
  volta para `ideas.md` com o contexto já investigado, em vez de ficar preso no ToDo.
- No `AskUserQuestion`, a opção "Outro" é automática — não se gasta uma das 4 vagas com ela.

## Lições de ferramenta

O que custou tempo e **não era da app** (extensão do Chrome, Claude Code, git, Obsidian) vai
para `notes/learning.md`, datado. Se a lição muda um procedimento, muda-se a skill e o
`learning.md` fica com o link.

## Relacionado

[[documentation-rules]] · [[../skills/README]] · [[../skills/agents/README]]
