# Trabalhar com o Claude neste ecossistema

**When to use**: ao criar ou manter skills, ao decidir se algo é skill ou referência, ao planear
trabalho que atravessa sessões, ao escrever um item no ToDo (o tier de modelo).

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
  que **nunca viu a conversa**, com o desenho e o porquê — e **sem estado**: as fases vão para o ToDo e o
  progresso para o plano. Duas cópias do progresso divergem.
- **Work log** com o texto verbatim do item do ToDo — preserva o que foi realmente decidido.

## Tiers de modelo — em que modelo corre cada trabalho

Cada item de `notes/ToDo.md` e cada passo de uma spec leva um **tier**: o modelo **mínimo** que o faz
bem. O tier serve para escolher o modelo em que se abre a sessão, que é onde se gasta quase tudo
(orquestração, leitura do vault, perguntas). Com a flag `agents`, serve também para decidir para que
subagente vai cada passo (ver abaixo).

| Tier | Quando | Exemplo |
|---|---|---|
| `opus` | Há uma decisão em aberto; contrato partilhado, schema, segurança; código ou texto com efeito largo (gerador, molde, configuração central); um ⚠️ que é de desenho | Escolher entre auth própria e um provedor externo |
| `sonnet` | Sabe-se **o quê, onde e como se verifica**; os ficheiros são conhecidos; a correção está descrita ou há uma verificação automática que a fecha | Corrigir links partidos já listados, com o auditor a confirmar |
| `haiku` | **Só passos dentro de uma spec ou de um plano**, com ficheiro e conteúdo exatos. **Nunca um item do ToDo**: uma sessão sobre um item é orquestração (investigar, perguntar, encadear skills), e o Haiku a errar aí custa mais do que poupou | Renomear um campo nos três ficheiros que o passo lista |

- **Na dúvida, sobe-se um tier.** Um tier errado para baixo dá retrabalho, que custa mais do que o que
  se poupou.
- **Um item misto parte-se em dois.** Quando um item tem uma decisão e muito trabalho mecânico, fica
  assim: um `opus` que decide e grava a decisão (bloco `> Decidido` ou ADR), e por baixo um `sonnet` que
  implementa a partir dela e depende do primeiro. Sem a divisão, o item inteiro corre no modelo caro por
  causa de uma fração de desenho.
- **Marca no início do bullet**, em minúsculas e entre crases: `` - [ ] `sonnet` Corrigir … ``. Todas
  as skills que escrevem no ToDo a põem.
- **Sem marca, o tier está por decidir** — não é um erro. O [[skill-implement-todo]] propõe-no depois de
  investigar o código.
- **Nomes de tier, não versões** (`opus`, não o número da geração), para o ToDo não envelhecer quando
  sai um modelo novo.
- **Quem escreve e quem confirma**: o [[skill-refine-idea]] escreve o tier quando grava o item, que é
  quando melhor o conhece sem ter lido código. O [[skill-implement-todo]] confirma-o depois de investigar
  e avisa quando a sessão corre num modelo diferente do que o âmbito precisa.
- 🚧 **Por provar**: o tier por item é uma convenção nova (2026-11). Ainda nenhum projeto a usou o
  bastante para saber se os critérios acertam. Um tier que se revelou errado é uma lição para
  `notes/learning.md`.

### Agentes (flag `agents`)

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
- Um passo mal especificado entregue ao `mechanical` custa mais a corrigir do que o que poupou: na
  dúvida, vai para o `implementer`.
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

[[documentation-rules]] · [[SKILLS-INDEX]]
