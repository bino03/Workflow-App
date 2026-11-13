---
tags: [adr]
status: aceite
data: 2026-11-13
---

# 0031 — Estado das sessões e agentes de cada terminal por hooks não bloqueantes

**Data**: 2026-11-13 · **Estado**: `aceite` · **Decidido com**: o dono, no `/refine-idea` de 2026-11-12 e no
`/implement-todo` de 2026-11-13 (plano `2026-11-13-terminais-estados-grelha-stop`). **Altera**
[[0012-argumentos-do-claude-e-status-line]] (o `claude-settings.json` deixa de ter só `statusLine`).

## Contexto

Um terminal normal só tem `running | exited | stopped`: não se sabe que sessão está a trabalhar, qual está parada
num pedido de permissão e qual acabou o turno sem a abrir. O mesmo para os agentes que cada sessão lança.

Restrições que vêm de trás:
- Nada de API nem de ler o ecrã do PTY ([[0002-motor-via-pty-sobre-subscricao]]); os hooks do Claude Code são a
  única fonte, como nas importações ([[0019-importar-pelas-skills-do-workflow]]) e nas sessões guiadas
  ([[0020-sessoes-guiadas]]).
- O script de hook corre dentro de cada `claude`: tem de ser escrito pelo backend, com caminhos absolutos, e
  nunca falhar, demorar ou imprimir ([[0004-exposicao-e-modelo-de-ameaca]], ponto 4).
- Sem canal de eventos: o estado vai no que o `useTerminals` já sonda (`GET /api/terminals`, 10 s).

**Spike** (`backend/scripts/session-state-spike.ts`, claude 2.1.323, 2026-11-13), num terminal real em
`--permission-mode default`:
- Uma variável posta no ambiente do PTY (`WFA_TERMINAL_ID`) chega a **todos** os hooks, e continua depois de um
  `/clear` (que dispara `SessionEnd` `reason: clear` + `SessionStart` `source: clear` com um `session_id` novo).
- Pedido de permissão: dispara `PermissionRequest` (um hook que não imprime nada não decide — a TUI pergunta como
  sempre); aprovado na TUI, dispara `PostToolUse`. Nenhuma `Notification` chegou nos 1,5 s até à aprovação.
- Parado à espera ~60 s depois do `Stop`: `Notification` com **`notification_type: "idle_prompt"`** — distingue-se
  sem a heurística das guiadas.
- Ferramenta **`Agent`**: nesta versão **todos os agentes são assíncronos** (`tool_response.status:
  "async_launched"`; não há `run_in_background`). `PostToolUse(Agent)` traz `tool_input.description`,
  `tool_input.subagent_type`, `tool_response.agentId` e `tool_response.resolvedModel`; `SubagentStart` traz
  `agent_id` + `agent_type`; `SubagentStop` traz o mesmo `agent_id` e `agent_transcript_path`
  (`…/<session>/subagents/agent-<id>.jsonl`). O fim chega de forma fiável, também depois do `Stop` da sessão.
- O fim de um agente acorda a sessão principal com um **`UserPromptSubmit` cujo `prompt` começa por
  `<task-notification>`** — não é uma mensagem do dono.

## Opções

| Opção | Prós | Contras |
|---|---|---|
| **A. Hook não bloqueante no `claude-settings.json` comum, ligado ao terminal por `WFA_TERMINAL_ID` (escolhida)** | Um ficheiro por terminal, aguenta `/clear` e `/resume`; só os terminais que levam a variável gravam alguma coisa | Corre um `node` por ferramenta (`PostToolUse`); muda o ADR 0012 |
| B. Ligar pelo `session_id` (como as importações) | Sem variável nova | Perde o terminal ao primeiro `/clear` ou `/resume` dentro da TUI |
| C. Juntar ao `guided-hook.cjs`/`import-hook.cjs` com um "modo" | Um só gerador | Os outros dois têm settings próprios e comportamento bloqueante; mistura três contratos |
| D. Ler o `.jsonl` da sessão | Nenhum hook | Lento, frágil, e o dono pediu para não ler transcripts |

## Decisão

1. **`DATA_DIR/session-hook.cjs`**, escrito pelo backend em cada arranque e registado no `claude-settings.json`
   comum (ao lado do `statusLine`) para `SessionStart`, `UserPromptSubmit`, `PreToolUse` (só `AskUserQuestion`),
   `PostToolUse`, `PermissionRequest`, `Notification`, `Stop`, `SubagentStart` e `SubagentStop`. Nunca imprime,
   nunca decide, tudo num `try/catch`, escrita atómica (tmp + rename).
2. **Ligação ao terminal:** `WFA_TERMINAL_ID=<id do terminal>` no ambiente do PTY, posto só nos **terminais
   normais** (`create` e `reopen` sem `importId`/`guidedId`/`appRun`, e não o login). O hook sai sem fazer nada sem
   a variável ou se não for um UUID. A variável passa a estar na lista negra do `childEnv` — uma instância do
   backend lançada de dentro de um terminal não a herda para os seus terminais.
3. **Estado (`activity`)**, o último evento que conta, em `DATA_DIR/session-state/<id>/state.json`:
   | Evento | `activity` |
   |---|---|
   | `SessionStart` · `Stop` | `waiting` (À tua espera) |
   | `UserPromptSubmit` · `PostToolUse` | `working` (A trabalhar) |
   | `PermissionRequest` · `PreToolUse(AskUserQuestion)` · `Notification` que não seja `idle_prompt` | `needs-you` (Precisa de ti) |
   | `Notification` `idle_prompt` | nada (continua `waiting`) |
   Sem ficheiro e com o PTY a correr → `waiting` (a TUI acabada de abrir). O ficheiro apaga-se antes de cada
   `create`/`reopen`. Um `Notification` sem `notification_type` (versões antigas) que chegue logo a seguir a um
   `Stop` ignora-se, como nas guiadas.
4. **Campo novo, `status` intacto:** `TerminalView.activity: 'working' | 'needs-you' | 'waiting' | null` — `null`
   quando o terminal não corre ou não é normal. "Terminada" continua a ser o `status` (`exited`/`stopped`). O bot,
   o `runningCount`, os filtros e as contagens não mudam.
5. **Agentes**, um ficheiro por evento e por agente em `DATA_DIR/session-state/<id>/agents/` (hooks em paralelo
   nunca escrevem no mesmo ficheiro): `SubagentStart` → `<agentId>.start.json` (`type`, `at`);
   `PostToolUse(Agent)` → `<agentId>.info.json` (`description` cortada a 120 caracteres, `model` = `resolvedModel`);
   `SubagentStop` → `<agentId>.stop.json` (`at`). O backend junta-os em
   `TerminalView.agents: {id, description, type, model, status: 'running'|'done', startedAt, endedAt}[]`
   (mais antigos primeiro, até 50). Nunca o prompt nem o resultado.
6. **Limpeza da lista:** um `UserPromptSubmit` do dono (o `prompt` **não** começa por `<task-notification>`)
   apaga os agentes já `done`; os que ainda correm ficam. *Desvio ao bullet do ToDo* ("o prompt seguinte limpa a
   lista"): como os agentes são todos assíncronos, limpar os que correm esconderia trabalho em curso.
7. **Poupar:** só o que vem nos hooks — sem ler transcripts, sem chamadas a modelos.

## Consequências

- Cada ferramenta de cada terminal normal corre um `node` curto (`PostToolUse`); não atrasa o turno (provado no
  spike das importações para um hook silencioso).
- Os terminais abertos **antes** do backend novo não têm a variável: ficam `waiting` até serem reabertos.
- **Limites conhecidos, por confirmar no uso:** interromper um turno com Esc pode não disparar `Stop` (fica
  `working` até à mensagem seguinte); recusar uma permissão não dispara `PostToolUse` (fica `needs-you` até ao
  `Stop`). A latência é a da sondagem (até 10 s).
- Os ícones (outro item do ToDo, design por escolher) e as notificações (ideia à parte) leem este campo; nenhum
  deles é decidido aqui.
- O ADR 0012 continua válido para os argumentos e a status line; só o "só tem `statusLine`" deixa de ser verdade.

## Relacionado

[[0012-argumentos-do-claude-e-status-line]] · [[0019-importar-pelas-skills-do-workflow]] · [[0020-sessoes-guiadas]] ·
[[0027-varias-contas-do-claude]] · [[../features/terminais|Terminais]] · [[../api]]
