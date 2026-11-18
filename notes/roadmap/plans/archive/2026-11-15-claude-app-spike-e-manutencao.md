# Plano — 2026-11-15 claude-app-spike-e-manutencao

**Estado**: concluído
**Âmbito escolhido**: os 3 implementáveis — botão "Continuar no Claude app" (só spike + ADR nesta sessão), skill-stop → proven no Workflow, vigiar node-pty
**Orçamento da sessão**: sem limite
**Modelo**: tarefas 1-2 `opus` · 3-4 `sonnet` (sessão em Opus; o bloco sonnet é curto, não vale mudar)

## Esclarecimentos já obtidos
- Nome da sessão RC → "Novo projeto · create" (o "/" não passa o `REMOTE_NAME`; a regex não se alarga).
- Quando o botão fica ativo → só em `waiting-text` (com cartão à espera ou a trabalhar: desativado com tooltip).
- ReplyBox depois de ligado → o dono escolhe ao carregar: **esconder aqui** (a página esconde conversa + caixa e mostra um aviso de que há um terminal a correr em fundo) ou **manter aberto** (conversa + caixa continuam). Palavras do dono: "posso escolher fechar na app (esconder) ou manter aberto, se esconder deve haver qualquer tipo de aviso a dizer que há um terminal a correr de fundo". Interpretação a confirmar no ADR.
- Automático + remoto → o Automático continua a valer; só o que o hook perguntaria à página passa ao Claude app.
- A sessão que mexe em `terminalsService.ts`/`claudeArgs.ts` **ainda não acabou** → nesta sessão não se tocam esses ficheiros; backend e frontend do botão ficam para depois do commit dela.
- Spike/deploy → só o spike (com o dono a ver o Claude app) + ADR 0033 nesta sessão.
- node-pty → 1.2 estável ainda não saiu (`npm view` 2026-11-15: latest 1.1.0, beta 1.2.0-beta.18); fica a vigiar, com data.
- (2026-11-18) Regressão do CLI 2.1.327 — diálogo "Adding a new directory" para cada `--add-dir` sem confiança → **verificar também as pastas do `--add-dir` (TERMINAL_007) + o dono confia `~/.workflow-app` uma vez** (não responder ao diálogo pelo backend).
- skill-stop → as cópias 🚧 nos filhos só mudam no próximo `/upgrade-project`.

## Ordem confirmada
1. [x] `opus` Spike: `/remote-control` escrito no PTY de um `/create` guiado em `waiting-text` (liga sem reiniciar? aceita nome?); recurso `--resume` + `--remote-control "Novo projeto · create"`; o Claude app mostra `AskUserQuestion`/permissões nativas? — **em curso**: script `backend/scripts/guided-rc-spike.ts` (`--via paste|typed|resume`). **1.ª corrida (via paste, 12 min)**: ✅ o paste de `/remote-control Novo projeto · create` em `waiting-text` liga o RC sem reiniciar (ecrã: "/remote-control is active" + URL); ✅ o nome aparece no Claude app (confirmado pelo dono); ✅ uma mensagem do app chega ao PTY e os hooks seguem (working → waiting-text). Achados: depois do paste o estado fica `working` (o slash command local não dispara `Stop`) e passa a `needs-you` ao fim de ~60 s (Notification de inatividade); o feed da página só mostrou a mensagem inicial (investigar). **2.ª corrida (2026-11-18)**: presa 20 min no diálogo novo do `--add-dir` (→ tarefa 1b). **3.ª corrida (2026-11-18, 20 min)**: o paste voltou a ligar o RC ("/remote-control is active" + URL), mas a barra do topo ficou **"· /rc connecting…" os 20 min** e não chegou nenhuma mensagem do app. O dono **não estava a ver** (confirmado): a corrida não conta como resultado. Na 1.ª corrida o "connecting" passou? Ver no próximo ecrã. **4.ª corrida (2026-11-18, com o dono) — concluída**: RC ligado pelo paste; "teste" escrito no app chegou ao PTY; o `AskUserQuestion` apareceu no app **com opções clicáveis** e a escolha chegou; o pedido de permissão `Write(answers.txt)` apareceu no app e foi **aprovado lá**; `result.json` `done`. O "/rc connecting…" na barra fica os 20 min, mas não impede nada (é cosmético). O feed da página continua sem as respostas dadas no app (só a mensagem inicial). A voz não se testa (o dono: "o detetor de voz do claude é muito bom"). O recurso `--resume` não é preciso. ~~**Falta**: o app mostrar `AskUserQuestion` com opções e o pedido de permissão; resposta por voz → 2.ª corrida com 20 min~~
1b. [x] `opus` 🔴 Regressão CLI 2.1.327: `assertTrusted` também para as pastas do `--add-dir` (guiado, imports, …), teste, docs — **concluída (2026-11-18)**: `TERMINAL_008`, 590/590, pedido real → 409. Falta só o dono confiar `~/.workflow-app` (por conta); a mensagem está por ver no browser (pendente).
2. [x] `opus` ADR 0033 com o resultado do spike e as decisões acima (muda 0020 pontos 2/3, 0017 opção "escrever /remote-control", liga 0021) — **concluída (2026-11-18)**: `aceite`
3. [x] `sonnet` skill-stop `prospective` → `proven` no Workflow (`library/skills/process/skill-stop.md`, `library/skills/README.md:18`, `docs/provenance.md:43`), `node tools/audit-library.mjs`, commit sem push — **concluída (2026-11-18)**: commit `935b8c3` no Workflow
4. [x] `sonnet` node-pty: bullet do ToDo com "verificado 2026-11-18, ainda beta" — **concluída (2026-11-18)**

## Próximo passo
Nada neste plano. A construção do botão é um bullet novo `opus` no ToDo (ADR 0033).
