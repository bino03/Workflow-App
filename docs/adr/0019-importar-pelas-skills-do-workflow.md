---
tags: [adr]
status: aceite
data: 2026-10-25
---

# 0019 — Importar para a biblioteca pelas skills do Workflow, num terminal escondido

**Data**: 2026-10-25 · **Estado**: `aceite` (mecanismo de arranque confirmado no spike, passo 1 da spec) ·
**Decidido com**: `/plan-feature` + `/implement-todo` (spec [[../features/importar-para-a-biblioteca]])

**Substitui** o [[0014-escrita-controlada-biblioteca]]: a app deixa de escrever ficheiros na biblioteca do
Workflow. Acrescenta argumentos à lista do [[0012-argumentos-do-claude-e-status-line]] e abre a regra 4 do
[[0004-exposicao-e-modelo-de-ameaca]] ("só o `CLAUDE_BIN`") a um binário novo, `GIT_BIN`, como o
[[0018-pre-visualizacao-por-tailscale-serve]] fez com o `TAILSCALE_BIN`.

## Contexto

O dono pediu (2026-10-23) "importar skills, front-ends, back-ends e stacks **da mesma maneira que está
implementado no Workflow, no vault, não na aplicação**", a partir da app. O que existia:

- O [[0005-biblioteca-lida-do-disco]] fechou a biblioteca à escrita: escrever faz-se pelas skills do Workflow,
  nos terminais.
- O [[0014-escrita-controlada-biblioteca]] abriu uma porta estreita: a app escreve **ela própria** um
  `skill-*.md` dentro de uma stack existente, com validação de frontmatter. Serviu, mas salta tudo o que as
  skills do Workflow fazem — triagem (vale a pena entrar?), forma fixa dos módulos, texto genérico com
  placeholders, contraste WCAG, registo, proveniência, `node tools/audit-library.mjs`. Alargá-la a designs e
  stacks era escrever na app três validadores que duplicam as skills.
- A ideia de 2026-09-28 (`notes/ideas.md`) já tinha visto isto: quem escreve devem ser as skills; faltava
  correr a skill sem terminal visível, responder às perguntas dela, e rever antes de aceitar.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **Formulário na app + a skill do Workflow num terminal escondido + revisão do diff (escolhida)** | A lógica fica num sítio (o vault do Workflow); a app não sabe o que é um `STACK.md`; o dono não vê um terminal numa importação normal; nada entra na biblioteca sem ele ver o diff | Depende de hooks e de argumentos do CLI do Claude Code; um terminal que ninguém vê tem de saber pedir ajuda |
| Terminal **visível** já com o comando lançado | O mais simples: zero mecanismo novo de estado | O dono rejeitou: quer importar sem ver um terminal |
| Alargar o upload direto do 0014 a designs e stacks | Sem processos novos | Duplica as skills na app e diverge delas; salta a triagem |
| Manter o 0014 como está | Nada a fazer | Não resolve designs, stacks nem skills fora de uma stack |

## Decisão

1. **A importação é uma skill do Workflow** (`/import`, no repo do Workflow — ADR 0010 de lá), que segue a
   skill de destino (`/add-stack`, `/add-new-design`, `/create-new-skill`) em "modo importação": sem perguntar
   o que o pedido já responde, **sem commit**, e termina a escrever um `result.json`.
2. **A app lança-a num terminal normal com `hidden: true`** (`cwd` = `WORKFLOW_PATH`, que tem de ser pasta
   de confiança do Claude Code — no diálogo de confiança a opção por omissão é "No, exit" e ninguém está lá
   para responder). Argumentos novos, todos construídos pelo backend em `terminals/claudeArgs.ts`:

   | Argumento | Valor |
   |---|---|
   | `--add-dir <pasta>` | `DATA_DIR/imports/<uuid>` e, para a origem "projeto", a pasta já resolvida pelo `cwdPolicy`. **Variádico**: vai antes de outra opção |
   | `--settings <ficheiro>` | `DATA_DIR/claude-import-settings.json` (status line + hooks), em vez do `claude-settings.json` |
   | prompt posicional, **último** | `/import <DATA_DIR/imports/<uuid>/request.json>` — validado por regex **e** igual ao caminho que o backend construiu |

   **Nenhum texto do dono entra na linha de comando**: as respostas do formulário vão para o `request.json`,
   escrito pelo backend. O spike (2026-10-25, `claude` 2.1.310) confirmou que o prompt posicional corre como
   primeira mensagem em modo interativo — **não** é `claude -p`; o [[0002-motor-via-pty-sobre-subscricao]]
   continua inteiro.
3. **O estado vem de ficheiros, nunca do ecrã**: o `result.json` da skill; e hooks `Stop`, `Notification` e
   `UserPromptSubmit` no `--settings` das importações, cujo comando fixo (`"<node>" "<DATA_DIR>/import-hook.cjs"`)
   grava só o nome do evento por `session_id`. Um `Stop` sem `result.json` = a skill parou para perguntar →
   a app mostra **Ver terminal** (o terminal deixa de estar escondido) e o dono responde lá.
4. **Permissões**: uma allowlist estreita no `.claude/settings.json` **do Workflow** (versionado lá). O que
   ficar de fora pede permissão no TUI → cai no ponto 3.
5. **Revisão e git**: só com o `git status` do Workflow limpo e sem outra importação ativa. No fim a app
   mostra o diff; **Aceitar** = `git add -- <ficheiros alterados>` + `git commit -m <mensagem validada>`;
   **Descartar**/**Cancelar** = `git checkout --` dos modificados + apagar os novos. `GIT_BIN` (omissão `git`),
   `execFile` sem shell, argumentos fixos, `cwd` = `WORKFLOW_PATH`; caminhos da lista resolvidos e verificados
   dentro do `WORKFLOW_PATH`. Sem `push`.
6. **A app só escreve em `DATA_DIR/imports/`** (pedido, ficheiros enviados). No Workflow, os únicos efeitos
   da app são os do ponto 5, sempre por ação do dono.
7. **Sai o upload direto do 0014** (rota, serviço, `frontmatterEditor`, drawer); os códigos `LIBRARY_002`–
   `LIBRARY_005` retiram-se e não se reutilizam.

## Consequências

- A Biblioteca volta a não ter escrita própria da app; o botão **Importar** serve skills, designs e stacks
  (qualquer camada) a partir de ficheiros, URL, uma pasta local ou uma descrição.
- **Fica de fora** (spec §2): `.zip`, responder às perguntas da skill numa UI própria, várias importações em
  paralelo, aceitar parte dos ficheiros, histórico na app (é o `git log` do Workflow), `push`.
- **Dependência nova do CLI do Claude Code**: os nomes `--add-dir`/`--settings`, o prompt posicional e o
  formato do stdin dos hooks (`session_id`, `hook_event_name`). Se mudarem, partem num sítio só
  (`claudeArgs.ts`, `import-hook.cjs`) e o spike (`backend/scripts/import-spike.ts`) apanha-o.
- **Um terminal escondido conta para o `MAX_TERMINALS`** e não aparece no bot de Telegram até ser revelado.
- **A app passa a correr `git` noutro repositório.** Mitigação: só com o repo limpo à partida, só sobre os
  caminhos que o `git status` lista, só por ação do dono; os hooks de pre-commit do Workflow correm (se
  recusarem, nada fica staged).
- **A allowlist do Workflow vale também para quem corre as skills à mão** nesse repo — menos pedidos de
  permissão, de propósito estreita (sem `git commit`, `git push`, `rm`).
- A mesma base (terminal escondido + prompt inicial + `--settings` com hooks) serve a spec
  [[../features/novo-projeto-guiado]], que lhe acrescenta hooks bloqueantes (ADR próprio).

## Estado

`aceite`
