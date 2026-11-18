---
tags: [adr]
status: aceite
data: 2026-11-18
---

# 0033 — Continuar no Claude app: Remote Control a meio de uma sessão guiada

**Data**: 2026-11-18 · **Estado**: `aceite` · **Decidido com**: o dono (conversa de 2026-11-12, `/implement-todo` de
2026-11-15 e 2026-11-18; spike na 4.ª corrida, com o dono no Claude app).

Altera o [[0020-sessoes-guiadas]] (pontos 2 e 3: os hooks bloqueantes deixam passar quando a sessão está no Claude
app) e o [[0017-bot-telegram-e-remote-control]] (a opção "escrever `/remote-control` no PTY", lá recusada, passa a
ser o caminho **só** para sessões guiadas). Usa o interruptor do [[0021-permissoes-das-sessoes-guiadas]]
(`DATA_DIR/guided-control/<id>.json`). Não muda o [[0004-exposicao-e-modelo-de-ameaca]] nem a lista de argumentos
do [[0012-argumentos-do-claude-e-status-line]]: o RC não entra pela linha de comando.

## Contexto

O Novo projeto (`/create` guiado, ADR 0020) faz as perguntas na página: o `guided-hook.cjs` segura o
`AskUserQuestion` e o `PermissionRequest` e a página mostra cartões. O dono quer, a meio, **continuar no Claude
app** (telemóvel, voz) sem perder a sessão. O ADR 0017 já liga terminais ao Claude app com `--remote-control
<nome>`, mas só **ao lançar**. Reiniciar a sessão guiada com `--resume` para ganhar o argumento era o recurso.

**Spike** (`backend/scripts/guided-rc-spike.ts`, Claude Code 2.1.327, Windows; motor de produção numa pasta
temporária, com as definições sem os dois hooks bloqueantes, como ficariam com `remote: true`):

| Pergunta | Resultado |
|---|---|
| Um paste de `/remote-control Novo projeto · create` em `waiting-text` liga o RC sem reiniciar? | ✅ "/remote-control is active" + URL da sessão; o processo continua o mesmo |
| O nome aparece no Claude app? | ✅ "Novo projeto · create" (confirmado pelo dono). O `/` não passa no nome (regex do 0017), por isso "create" sem barra |
| O texto escrito no app chega à sessão? | ✅ chega ao PTY como mensagem do utilizador; os hooks de estado seguem |
| O `AskUserQuestion` aparece no app? | ✅ **com opções clicáveis**; a escolha chega ao `tool_input` como no TUI |
| O pedido de permissão aparece no app? | ✅ `Write(answers.txt)` apareceu e foi aprovado lá |
| O fim (`result.json`) muda? | Não: `done` como sempre |

Achados: a barra do TUI fica em "· /rc connecting…" a sessão inteira, mesmo com tudo a passar (cosmético). Depois
do paste o estado fica `working` (o slash command local não dispara `Stop`) e passa a `needs-you` ao fim de ~60 s
(Notification de inatividade). O feed da página (`transcriptFeed`) **não mostrou** as mensagens dadas no app, só a
inicial. A voz não se testou: é o mesmo canal de texto, e o dono dispensou-a.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **Paste de `/remote-control <nome>` no PTY parado** | Não reinicia; a conversa e o contexto ficam; provado no spike | Escrever no PTY por conta própria (recusado no "Resumir" do 0009); `/remote-control` é um alternar |
| Parar e reabrir com `--resume … --remote-control <nome>` | Argumento já existente (0017) | Reinício: o processo morre a meio de um `/create`, hooks e estado recomeçam; mais lento |
| Deixar os hooks bloqueantes ligados | Nada muda no hook | O hook segura a pergunta e o Claude app **nunca** a vê — o botão não serviria |

## Decisão

1. **Botão "Continuar no Claude app"** no Novo projeto, **só** em `waiting-text` (com um cartão à espera ou o
   Claude a trabalhar fica desativado, com tooltip). Só o propósito `create`; a Upwork fica de fora por agora.
2. **O backend escreve no PTY uma linha fixa**: `/remote-control Novo projeto · create`, pelo mesmo bracketed
   paste do `POST /api/guided/:id/message` (0020 ponto 7). Nenhum texto do cliente entra nessa linha. Difere do
   "Resumir" recusado no 0009: é pedido pelo dono com um clique, só com o Claude parado à espera, e não fica
   nenhuma resposta a extrair do ecrã.
3. **Uma só vez por sessão.** Como `/remote-control` alterna, um segundo paste desligaria o RC. O backend marca
   `remote: true` em `DATA_DIR/guided-control/<id>.json` (só o backend escreve lá, como o `mode` do 0021) **antes**
   do paste, e recusa um segundo pedido. Desligar o RC fica ❓ por decidir (não há caminho de volta nesta versão).
4. **Com `remote: true` o `guided-hook.cjs` sai 0 sem output** no `PreToolUse(AskUserQuestion)` e no
   `PermissionRequest`: a TUI pergunta nativamente e o Claude app mostra a pergunta (altera o 0020, pontos 2 e 3).
   **O modo Automático do 0021 continua a valer**: em Automático o hook aprova a permissão como antes, e só o que
   ele perguntaria à página passa ao Claude app. Um `pending.json` à espera quando o botão é carregado não pode
   existir (ponto 1).
5. **A pasta tem de ser de confiança na conta** (`TERMINAL_007`), como no 0017; as pastas do `--add-dir` já o são
   desde o lançamento (`TERMINAL_008`).
6. **A página, depois de ligado**, mostra "A responder no Claude app" em vez dos cartões. O dono escolhe ao
   carregar: **esconder aqui** (a página esconde a conversa e a caixa de resposta e mostra um aviso de que há um
   terminal a correr em fundo) ou **manter aberto** (conversa e caixa continuam; escrever aqui e no app vai para a
   mesma sessão). O `result.json` do fim não muda: a criação acaba na página como sempre.
7. **O estado não se fia no `Stop` do paste**: depois do paste a página passa logo a "no Claude app", sem esperar
   pelo `waiting-text` (que não volta enquanto ninguém responder).

## Consequências

- Uma sessão guiada pode passar a ser respondida fora da app: o risco é o do 0017 (quem tem o login claude.ai do
  dono vê e escreve nela). Em Automático, isso inclui aprovar sem perguntar — aceite, é a mesma conta.
- **O feed da página tem de mostrar as mensagens dadas no app** (no spike não mostrou) — obrigatório, no mesmo
  trabalho do botão (decidido com o dono a 2026-11-18): investigar no `.jsonl` como ficam gravadas.
- O "/rc connecting…" do TUI não se usa como sinal de nada.
- Muda o comentário de `claudeArgs.ts` ("a guided session never runs with remote control") para dizer que continua
  verdade no lançamento, e que o RC de uma sessão guiada só entra por este paste.

## Estado

`aceite` (ponto 6 confirmado pelo dono a 2026-11-18). Spike feito (2026-11-18). Backend, frontend do botão e o
feed das mensagens do app por construir.
