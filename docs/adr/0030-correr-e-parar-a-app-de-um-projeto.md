---
tags: [adr]
status: aceite
data: 2026-11-12
---

# 0030 — Correr e parar a app de um projeto por um terminal escondido com `/run` e `/stop`

**Data**: 2026-11-12 · **Estado**: `aceite` · **Decidido com**: o dono, na entrevista da spec
[[../features/correr-a-app|correr e parar a app]] (§3) e no `/implement-todo` de 2026-11-12.

## Contexto

Para ver a app de um projeto a correr, o dono abre um terminal desse projeto e escreve `/run`; para a parar,
pede ao mesmo Claude (o único que sabe os IDs das tarefas em background) ou fecha o terminal. O terminal fica a
ocupar um lugar da grelha só para manter a app viva, e nada diz de relance se ela está a correr e desde quando.

Restrições que vêm de trás:
- O motor é a subscrição através do PTY, nunca a API nem `claude -p` ([[0002-motor-via-pty-sobre-subscricao]]).
- Um terminal é um shell na máquina: a app só lança `CLAUDE_BIN` com argumentos fixos, nunca um comando
  arbitrário, e só em pastas de `ALLOWED_ROOTS` ([[0004-exposicao-e-modelo-de-ameaca]], ponto 4).
- A descoberta de portas por baixo de um PID já existe para a pré-visualização (`devPortsOf`,
  [[0018-pre-visualizacao-por-tailscale-serve]]), cujo "Fora" deixava de fora "arrancar o servidor de dev pela app".
- Escrever no PTY de um `claude` parado à espera já se faz nas sessões guiadas (bracketed paste + Enter,
  [[0020-sessoes-guiadas]], ponto 7).
- Já há dois tipos de terminal escondido: o do `/login` de uma conta e o das sessões guiadas/importações.

## Opções

| Opção | Prós | Contras |
|---|---|---|
| **A. O `claude` com o `/run` do projeto, num terminal escondido; parar com `/stop` na mesma conversa + rede (escolhida)** | O `/run` de cada projeto já sabe pré-requisitos, marcadores e health checks da stack; continua a ser a subscrição e só `CLAUDE_BIN`; a conversa que arrancou sabe os IDs das tarefas e o que está fora da árvore (`docker compose down`) | Depende de uma skill `/stop` em cada projeto; o arranque leva o tempo de um turno do Claude; pode ficar preso numa permissão |
| B. A app lança `npm run <script>` diretamente | Rápido, determinista | Abre o ponto 4 do ADR 0004 (comandos arbitrários); cada stack arranca de maneira diferente; é o pilar "Tarefas" das ideias, outra decisão |
| C. Só fechar o terminal para parar | Nenhuma skill nova | Não desliga o que não é descendente do PTY (contentores, serviços) |
| D. Só `/stop` para parar | Desliga tudo, pela conversa | Se o Claude falhar ou ficar preso, a app fica pendurada |
| E. Terminal do `/run` visível na grelha | Vê-se tudo | Volta ao problema de partida: ocupa um lugar só para manter a app viva |

## Decisão

1. **Terceiro tipo de terminal escondido.** "Correr" abre um terminal guardado (`state.json`,
   [[0009-estado-em-ficheiro-json]]) com `appRun: true` e `hidden: true`, no projeto, com a **conta ativa**, cuja
   **primeira mensagem é `/run`** (como o `/login` do terminal de login). Não aparece na grelha nem na lista de
   terminais; não deixa histórico nem pasta recente. Só se mostra por **Ver terminal**, a partir de um erro
   (o `reveal` que já existe). Todo o código que trata `hidden` tem de distinguir os três tipos
   (`isLoginTerminal`, `list()`, a grelha, o bot do Telegram).
2. **"A correr" = há portas em escuta abaixo desse terminal** (`devPortsOf` do PID real). O tempo conta desde a
   primeira porta vista. Não se lê o ecrã nem o `.jsonl`.
3. **Parar = `/stop` escrito no PTY** (bracketed paste + Enter, a mesma conversa que fez o `/run`) **com uma rede
   de 20 s**: se ao fim desse tempo ainda houver portas, a app fecha o terminal (o `close` já mata a árvore de
   processos). No fim fecha sempre o terminal escondido.
4. **Limite de 3 min**: em `starting` sem nenhuma porta durante 3 min, ou se o terminal termina sem portas, a
   execução falha ("Não arrancou"); portas que desaparecem com a app a correr dão "Parou sozinha". Não se
   aprovam permissões sozinho: o terminal corre no modo da conta, como um normal. Ficar preso numa permissão
   vê-se pelo limite + Ver terminal.
5. **Só com as duas skills.** O controlo só existe quando o projeto tem `.claude/skills/run/SKILL.md` **e**
   `.claude/skills/stop/SKILL.md` (lido do disco, para acompanhar mudanças no `/create`). O `/stop` passa a ser
   obrigatório no Workflow (ADR 0013 do Workflow).
6. **Nunca a própria Workflow App**: a pasta da app é recusada (correr o `/run` dela a partir dela reinicia o
   backend e mata todos os terminais — regra 8 do `CLAUDE.md`).
7. **Conta para o `MAX_TERMINALS`**: é um PTY real com um `claude` a correr; com o limite cheio, "Correr"
   devolve o erro do limite, que diz qual é.
8. **Estado em memória** (`AppRunService`): fase, `startedAt`, `runningSince`, portas, erro. Não sobrevive a um
   reinício do backend — a app morre com os PTYs; no arranque apagam-se os terminais `appRun` guardados.
   O frontend lê o estado por sondagem (o canal de eventos ainda não existe). Uma execução por projeto.

## Consequências

- O dono corre e para a app de um projeto sem gastar um lugar da grelha e vê, de relance, se está a correr,
  há quanto tempo e em que porta.
- Cada projeto precisa do `/stop`: o `/create`, o `/adopt-project` e o `/upgrade-project` do Workflow geram-no;
  os projetos sem ele simplesmente não mostram os botões.
- Arrancar custa um turno do Claude (segundos a um minuto), não um `npm run` instantâneo.
- Escrever `/stop` a meio de um turno depende de o Claude Code pôr a mensagem em fila — a confirmar num
  terminal real; a rede de 20 s cobre o caso em que não põe.
- Reabre o "Fora" da [[../features/pre-visualizacao|pré-visualização]] ("Arrancar o servidor de dev pela app")
  só para este caminho: quem arranca continua a ser o `claude`, nunca a app.
- Fica de fora (spec §2): tarefas por nome, aprovar permissões sozinho, logs na UI, reiniciar sozinho, várias
  instâncias ou contas, sobreviver a um reinício do backend.
- Relaciona-se com [[0002-motor-via-pty-sobre-subscricao]], [[0004-exposicao-e-modelo-de-ameaca]],
  [[0018-pre-visualizacao-por-tailscale-serve]], [[0020-sessoes-guiadas]] e [[0027-varias-contas-do-claude]].
