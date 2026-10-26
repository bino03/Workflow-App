---
tags: [adr]
status: aceite
data: 2026-10-26
---

# 0020 — Sessões guiadas: o Claude Code interativo com uma UI própria, por hooks bloqueantes

**Data**: 2026-10-26 · **Estado**: `aceite` (mecanismo confirmado no spike, passo 1 da spec) ·
**Decidido com**: `/plan-feature` + `/implement-todo` (spec [[../features/novo-projeto-guiado]])

Complementa o [[0002-motor-via-pty-sobre-subscricao]] (continua a ser o `claude` interativo num PTY), o
[[0012-argumentos-do-claude-e-status-line]] (argumentos novos) e o [[0019-importar-pelas-skills-do-workflow]]
(reutiliza o terminal `hidden`, o prompt inicial e o `--settings` com hooks).

## Contexto

O dono pediu (2026-10-23) o `/create` do Workflow "como uma espécie de formulário: clicava em criar uma nova
aplicação, escrevia a prompt inicial, e depois tudo o que viesse em forma de escolha múltipla vinha com uma UI
diferente. Não queria ter um terminal nisto". É a ideia "Lançar o `/create` por formulário" de
`notes/ideas.md`.

O [[0019-importar-pelas-skills-do-workflow]] já lança uma skill do Workflow num terminal escondido e segue-a
por ficheiros e hooks — mas quando a skill pergunta alguma coisa, a única saída é **Ver terminal**. Uma
entrevista de 20-40 minutos com dezenas de perguntas e pedidos de permissão precisa de mais: responder a
cada pergunta e a cada permissão sem ver o TUI, e mostrar a conversa de forma legível.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **Conversa polida sobre a skill real, por hooks bloqueantes (escolhida)** | A entrevista continua num sítio só (a skill do Workflow); as perguntas chegam estruturadas (perguntas, opções, descrições, multiSelect); a UI acompanha a skill quando ela mudar | Depende de hooks e do formato do `.jsonl`, que não são contrato público do Claude Code |
| Formulário fixo A-E na app + o `/create` em modo "respostas dadas" | UI totalmente controlada | Duplica a entrevista na app e diverge dela; as perguntas que dependem da stack escolhida (C6, D1) ficam difíceis |
| Ler o TUI do PTY à procura das perguntas e das opções | Nada de hooks | Frágil a cada versão do CLI; o ecrã é apresentação, não dados |
| Agent SDK / `claude -p` com `--output-format stream-json` | Protocolo estruturado | Proibido pelo [[0002-motor-via-pty-sobre-subscricao]] |

## Decisão

1. **Uma sessão guiada é um terminal `hidden` normal** (do [[0019-importar-pelas-skills-do-workflow]]) + uma
   pasta `DATA_DIR/guided/<id>/` + hooks + o `.jsonl` da sessão. Não é um segundo motor. O `purpose` diz para
   que serve (hoje só `create`); o motor e os componentes da UI são genéricos.
2. **Escolhas (`AskUserQuestion`) por hook `PreToolUse` bloqueante.** O `guided-hook.cjs` grava
   `pending.json`, espera (polling) pelo `answer.json` com o mesmo `requestId`, e devolve
   `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","updatedInput":{…tool_input,"answers":{…}}}}`.
   O spike provou que o Claude segue com essas respostas e o seletor **não** aparece no TUI.
3. **Permissões por hook `PermissionRequest` bloqueante**, o mesmo mecanismo, a devolver
   `{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}` ou
   `{"behavior":"deny","message":…}`. Os casos óbvios ficam na allowlist do Workflow, como no 0019.
4. **Argumentos novos à lista do [[0012-argumentos-do-claude-e-status-line]]**, todos construídos pelo backend:

   | Argumento | Valor |
   |---|---|
   | `--permission-mode default` | Fixo. **Sem ele o `PermissionRequest` nunca dispara** nesta conta, cujo modo por omissão é `auto` (aprova sozinho) — e o dono deixava de decidir cada ação, que é o que pediu |
   | `--settings <ficheiro>` | `DATA_DIR/claude-guided-settings.json` (status line + hooks) |
   | `--add-dir <pasta>` | `DATA_DIR/guided/<uuid>` (variádico: antes de outra opção) |
   | prompt posicional, **último** | Por `purpose`; para `create`: `/create --app <DATA_DIR/guided/<uuid>/brief.md>`, validado por regex **e** igual ao caminho construído |

   O texto do dono nunca entra na linha de comando: a descrição inicial vai para o `brief.md`.
5. **Os hooks bloqueantes têm `timeout: 86400`** (24 h). O spike provou 10 min à espera; o valor foi aceite
   sem erro. Se expirar, a sessão fica "precisa de ti" e **Ver terminal** mostra a pergunta no TUI — nada se
   perde.
6. **O hook só atua em sessões guiadas**: encontra a pasta pela `session_id` do stdin (validada como UUID)
   num índice `DATA_DIR/guided/by-session/<session_id>` escrito pelo backend; qualquer outra sessão → sai 0
   sem imprimir nada. Nunca imprime nada além do JSON de decisão. O comando é fixo
   (`"<node>" "<DATA_DIR>/guided-hook.cjs"`).
7. **Respostas de texto livre** (o Claude terminou o turno à espera — hook `Stop` sem resultado) são escritas
   no PTY por uma **rota REST** (`POST /api/guided/:id/message`), não pelo WebSocket, como **bracketed paste**
   (`ESC[200~…ESC[201~` + Enter): o spike provou que várias linhas chegam como uma mensagem. O backend tira
   do texto **todos os caracteres de controlo exceto `\n` e `\t`** — sem isso, um `ESC[201~` dentro do texto
   fechava o paste e o resto seria lido como teclas. Só aceita escrever com o Claude parado à espera
   (escrever a meio de um turno baralha o TUI).
8. **A conversa que a UI mostra vem do `.jsonl` da sessão**, reduzida no backend (`transcriptFeed.ts`) a
   entradas simples: texto do Claude, texto do dono, pergunta + respostas (`toolUseResult.answers`),
   permissão + decisão (attachment `hook_permission_decision`, por `toolUseID` — inclui as aceites), atividade
   agrupada. O conteúdo das skills (`isMeta`), os `tool_result`, o pensamento e os tipos desconhecidos não
   aparecem; uma linha que não se percebe é ignorada. Nada é guardado à parte — sobrevive a um reinício.
9. **Markdown no frontend com `react-markdown`, sem HTML cru** (`skipHtml`, sem `rehype-raw`): as mensagens
   do Claude são Markdown; HTML dentro delas aparece como texto.

## Consequências

- O dono cria um projeto (e, numa 2.ª fase, importa, adota, colhe) sem ver um terminal; **Ver terminal**
  fica sempre disponível como escape.
- **Dependências novas do CLI do Claude Code**: os eventos `PreToolUse`/`PermissionRequest` e o formato da
  sua saída, o `updatedInput` com `answers` da `AskUserQuestion`, o `--permission-mode`, e o formato do
  `.jsonl`. Tudo isolado em `guided-hook.cjs` e `transcriptFeed.ts`, com testes sobre a fixture real
  (`backend/test/fixtures/guided-transcript.jsonl`); `backend/scripts/guided-spike.ts` volta a provar o
  mecanismo numa versão nova do CLI.
- **Uma rota REST escreve num PTY.** Até aqui só o WebSocket o fazia. A rota tem a proteção das outras rotas REST
  (sessão obrigatória; o cookie `SameSite=Strict` não segue num pedido vindo de outro site — o `Origin` explícito
  é só do upgrade do WebSocket, [[../security]]), só escreve em terminais de sessões
  guiadas, só no estado "à espera", e filtra os caracteres de controlo (ponto 7).
- **Uma sessão guiada corre em `--permission-mode default` mesmo que a conta use `auto`** — mais pedidos de
  permissão do que num terminal normal, de propósito: são os cartões Permitir/Recusar.
- Um hook bloqueado é um processo `node` vivo enquanto a pergunta espera (um de cada vez por sessão).
- **Fica de fora** (spec §2): editar uma resposta já dada, o "modo polido" em terminais normais, várias
  criações em paralelo, avisos fora do ecrã, layout de telemóvel.

## Estado

`aceite`
