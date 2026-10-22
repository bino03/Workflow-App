# Feature: Bot de Telegram com Remote Control

| | |
|---|---|
| **Estado** | 🚧 Em curso |
| **Criada** | 2026-10-22 |
| **Última sessão** | 2026-10-22 |
| **Passos** | 2 / 8 concluídos |

> Escrita para uma sessão que **não viu a conversa que a originou**. Se algo só faz sentido com contexto
> externo, falta escrevê-lo.

---

## 1. O que é e porquê

O dono quer retomar trabalho **só com o telemóvel**, sem acesso à app (que só escuta em `127.0.0.1`; a forma de
a expor fora de casa continua em aberto, [[../adr/0004-exposicao-e-modelo-de-ameaca|ADR 0004]]). Nas palavras dele:
"imagina que eu quero retomar trabalho e apenas estou no telemóvel e não tenho acesso à aplicação… no bot de
Telegram escolher um chat e ele automaticamente iniciava o chat com /remote-control. Assim, se fosse a aplicação do
Claude, poderia fazer isto, continuar o meu trabalho sem qualquer tipo de problema."

O Claude Code já tem o **Remote Control** (`claude --remote-control "<nome>"`): a sessão corre no desktop e
controla-se no app Claude do telemóvel. Falta **mandar o desktop abri-la** — é o que o bot faz. A decisão e as
alternativas estão em [[../adr/0017-bot-telegram-e-remote-control|ADR 0017]].

**Como sei que está bem feito:** no telemóvel, fora de casa, escrevo ao bot → escolho o projeto → escolho
"Continuar a última" → em segundos o bot responde "Aberto com Remote Control" → abro o app Claude → Code e a sessão
está lá, com o nome "<projeto> · <título>", e continuo a conversa. Mais tarde, no PC, abro a app e o mesmo terminal
está na lateral do projeto, com a etiqueta **RC**, a correr, e posso escrever nele.

## 2. Âmbito

### Dentro
- **Retomar uma sessão gravada**: projeto (o mesmo registo da lateral, `ProjectsService`) → "Continuar a última" ou
  uma das últimas 5 sessões (pré-visualização + data) → terminal com `--resume <uuid> --remote-control "<nome>"`.
- **Nova conversa** num projeto, com Remote Control (nome automático do Claude Code).
- **`/estado`**: terminais a correr (projeto, nome, RC ou não) + quota da janela de 5h e semanal (`usage.json`).
- **`/parar`**: escolher um terminal a correr → confirmar → o processo morre, o terminal **fica** na app como
  parado, com **Reabrir**.
- **Sessão já aberta**: se a sessão escolhida está num terminal a correr **sem** RC → o bot pergunta e, se
  confirmado, para esse terminal e reabre-o (mesmo id) com `--resume` + RC, avisando que se perde o que estiver a
  meio. Se já tem RC → só diz que já está no app Claude. Se está parado/terminado → reabre-o com RC.
- **Na app**: o terminal aberto pelo bot é um terminal normal (guardado no `state.json`, aparece na lateral/grelha
  do projeto) com a etiqueta **RC** no cabeçalho; a lista de terminais volta a ler-se quando a janela ganha foco.
- **Reabrir mantém o RC**: um terminal com RC que parou volta com RC, seja pelo bot ou pelo Reabrir da app.

### ⛔ Fora — não implementar nesta feature
- Notificações "à espera de input" no Telegram — o app Claude já as envia nas sessões RC (`/config` → *Push when
  actions required*).
- **Qualquer conteúdo dos terminais no Telegram** (output, últimas mensagens, resumos gerados) — ADR 0017 §5.
- Ligar/desligar o RC a partir da UI da app (botão "Ligar RC") — segunda fase.
- Ligar o RC num terminal a correr sem o reiniciar (escrever `/remote-control` no PTY) — recusado no ADR 0017.
- Modo servidor `claude remote-control`, webhook do Telegram, vários utilizadores de Telegram, grupos.
- O link direto da sessão (`claude.ai/code/session_…`) na resposta do bot — o `claude` escreve-o no ecrã e dava para o ler, mas o dono recusou (2026-10-22): "não é preciso visto que ao fazer remote-control o claude abre logo a sessão na mobile app" (a notificação de "pronto" do app Claude).
- Abrir pastas fora do registo de projetos, ou pastas recentes/favoritas.
- Escolher o modelo, o modo de permissões ou qualquer outro argumento a partir do bot.

> Esta lista impede uma sessão futura de expandir o âmbito sozinha.

### Segunda fase (se houver)
- Botão "Ligar/Desligar RC" no cabeçalho do terminal na app (reinicia com `--resume`).
- Ver/escolher sessões além das 5 mais recentes ("Mais…").

## 3. Decisões tomadas

| Decisão | Escolha | Porquê | Alternativa rejeitada |
|---|---|---|---|
| Canal | Bot de Telegram em long polling no backend | Só ligações de saída: não depende da decisão de exposição | Webhook (URL público a entrar); expor a app |
| Como ligar o RC | Argumento `--remote-control [<nome>]` no arranque | Lista fechada de argumentos (ADR 0012/0017); sem escrever no PTY | Escrever `/remote-control` no PTY (alternar, não ligar; recusado antes para o "Resumir") |
| Âmbito v1 | Retomar · nova conversa · `/estado` · `/parar` | Pedido do dono (2026-10-22) | Só retomar |
| Sessão já aberta sem RC | Perguntar; se sim, parar e reabrir o mesmo terminal com RC | Pedido do dono; um `.jsonl` não pode ter dois processos | Só avisar; RC sempre ligado em todos os terminais |
| Nome no app Claude | "<projeto> · <título>" ao retomar; **nenhum** numa conversa nova | Pedido do dono; sem nome o Claude Code dá um automático que muda para o tema do 1.º prompt | Nome fixo "<projeto> · nova conversa" (não mudaria sozinho) |
| `/parar` | Mata o processo, o terminal fica parado (Reabrir) | Pedido do dono: retomar no PC com um clique | Fechar como na app (vai para o histórico) |
| Reabrir um terminal com RC | Mantém o RC (`remoteControl` guardado no `state.json`) | Pedido do dono | RC só enquanto vive o processo do bot |
| Na app | Terminal normal + etiqueta **RC**; lista relida ao ganhar foco | Pedido do dono: "deve aparecer na mesma como se tivesse aberto pelo frontend" | Só a etiqueta (terminal novo só aparecia ao recarregar) |
| Autenticação do bot | Só conversa privada com `from.id` = `TELEGRAM_ALLOWED_USER_ID`; o resto ignorado em silêncio | Uso pessoal; responder a desconhecidos revelava que o bot existe | Senha no chat; lista de vários IDs |
| Bot opcional | Sem `TELEGRAM_BOT_TOKEN` → o módulo não arranca | A app funciona como hoje para quem não o quer; instâncias de teste sem token | Obrigatório |
| Cliente Telegram | `fetch` do Node 24, ~5 métodos da Bot API | Sem dependência nova; superfície pequena | grammY/telegraf |
| Pastas sem *trust* | O bot recusa ("abre primeiro no PC") | O prompt de trust ficaria à espera sem ninguém | Aceitar o trust automaticamente |
| Tamanho do PTY aberto pelo bot | 120×32 | Não há browser a dizer o tamanho; o primeiro browser que se liga redimensiona | — |
| `remoteControl` no `state.json` | Campo com `default(false)`, **sem** subir o `STATE_VERSION` | Ficheiros antigos leem-se sem migração; um campo opcional não muda a forma | Subir para v3 com migração |

**ADRs gerados:** [[../adr/0017-bot-telegram-e-remote-control|ADR 0017]] (complementa o 0012 e o 0004).

## 4. Desenho técnico

### 4.1 Dados

`DATA_DIR/state.json` ([[../database]]), `savedTerminalSchema` em `backend/src/state/state.schema.ts`:

```ts
remoteControl: z.boolean().default(false), // ADR 0017 — o terminal arranca (e reabre) com --remote-control
```

Nada mais persistido. Os menus do bot (mapa `chave curta → ação`) vivem **em memória**, com validade de 10 min.

### 4.2 Endpoints

Nenhum endpoint novo. Muda:

| Método | Rota | Mudança |
|---|---|---|
| GET | `/api/terminals` | `TerminalView` ganha `remoteControl: boolean` |
| POST | `/api/terminals/:id/reopen` | Se o terminal tem `remoteControl`, reabre com RC (sem mudar o pedido) |

O bot **não** usa HTTP: chama os serviços diretamente (`TerminalsService`, `ProjectsService`, `ClaudeSessions`,
`readUsage`).

**Comandos do bot** (registados com `setMyCommands`):

| Comando | Faz |
|---|---|
| `/start`, `/ajuda` | O que o bot faz e os comandos |
| `/projetos` (e qualquer texto solto) | Um botão por projeto → menu do projeto |
| menu do projeto | **Continuar a última** · até 5 sessões (`preview` cortado a ~40 car. + data) · **Nova conversa** |
| `/estado` | Terminais a correr (projeto · nome · `RC`) + quota 5h/semanal com a hora de reposição |
| `/parar` | Um botão por terminal a correr → "Parar <nome>? O que estiver a meio perde-se." **Sim/Não** |

Resposta depois de abrir: "✅ Aberto com Remote Control: «<nome>». Abre o app Claude → Code." (numa conversa nova:
"…aparece com um nome automático, que muda com o teu primeiro prompt").

### 4.3 Tipos / DTOs

`backend/src/terminals/claudeArgs.ts`:

```ts
export type ClaudeArgsOptions = {
  settingsPath?: string;
  /** ADR 0017. `name` omitted → Claude Code's automatic name. */
  remoteControl?: { name?: string };
};
// args: [--session-id|--resume <uuid>] [--settings <abs>] [--remote-control [<name>]]
export const REMOTE_NAME = /^[\p{L}\p{N}][\p{L}\p{N} ._\-()·]{0,79}$/u; // nunca começa por '-'
```

`backend/src/terminals/terminalsService.ts`:

```ts
export type TerminalView = { /* … */ remoteControl: boolean };
export type CreateTerminal = { /* … */ remoteControl?: boolean };
reopen(id, size, options?: { remoteControl?: boolean }) // true liga o RC e grava-o; omitido mantém o guardado
stop(id): Promise<TerminalView>                         // mata o processo, mantém o terminal (status 'stopped')
```

- O **nome RC** é calculado no serviço (`remoteControlName(cwd, sessionId)`, ficheiro
  `backend/src/terminals/remoteName.ts`): `basename(cwd)` + " · " + `preview` da sessão (`ClaudeSessions`), limpo
  para a allowlist e cortado a 80; conversa nova → sem nome. Se o resultado ficar vazio → sem nome.
- **Trust** (confirmado no spike, passo 1): antes de lançar com RC, o serviço confirma que a pasta é de confiança
  para o Claude Code. Fonte: `.claude.json` na pasta de configuração (`<CLAUDE_CONFIG_DIR>/.claude.json` se definido,
  senão `~/.claude.json`) → `projects[<caminho>].hasTrustDialogAccepted === true`. As chaves usam `/` (`C:/Users/…`)
  e há duplicados só com a letra da drive em minúscula (`c:/…`, às vezes `false`): comparar sem distinguir maiúsculas
  em `win32` e aceitar se **alguma** entrada equivalente for `true`. **Uma pasta-mãe de confiança conta** (uma
  subpasta não fica registada) → subir de `cwd` até à raiz. Ficheiro ilegível ou ausente → não é de confiança.
  Não é → `TERMINAL_007`. Só se lê; nunca se escreve no `.claude.json`.
- **Nome RC** (spike): chega ao app numa conversa nova; ao retomar uma conversa que já teve RC, o Claude Code reutiliza
  a sessão remota e o nome pode não mudar — aceitável, não se tenta corrigir.

`backend/src/config.ts`:

```ts
telegram: { botToken: string; allowedUserId: number } | undefined
// TELEGRAM_BOT_TOKEN: opcional, /^\d+:[A-Za-z0-9_-]{30,}$/
// TELEGRAM_ALLOWED_USER_ID: obrigatório se houver token (inteiro positivo); token sem ID → não arranca
```

`backend/src/telegram/`:

| Ficheiro | Papel |
|---|---|
| `telegramApi.ts` | `getUpdates(offset, timeoutS)`, `sendMessage`, `editMessageText`, `answerCallbackQuery`, `setMyCommands` sobre `fetch`; `AbortSignal` para parar; **erros reescritos sem o token** (o URL contém-no) |
| `menuStore.ts` | `put(action) → key` (≤ 16 car.), `take(key)`, validade 10 min; `callback_data` = a chave |
| `telegramBot.ts` | Ciclo de long polling (`timeout` 50 s, recuo exponencial até 60 s em erro, 409 → log de aviso "outro backend com o mesmo token"), filtro de autorização, encaminhamento de comandos e botões |
| `botActions.ts` | As ações (listar projetos, sessões, abrir, `/estado`, `/parar`) sobre os serviços; revalida tudo no momento |
| `botMessages.ts` | Os textos em português, incluindo `AppError` → frase (`TERMINAL_002` "Limite de terminais atingido"…) |

O ciclo arranca em `app.ts` (onde os serviços existem) e para no `onClose` (aborta o `getUpdates` pendente).

### 4.4 Interface
- **Onde vive**: `TerminalPane.tsx` (cabeçalho do terminal) e `useTerminals.ts`.
- **Como se chega lá**: um terminal com `remoteControl: true` mostra uma etiqueta **RC** junto ao nome, com o
  título "Remote Control — também no app Claude". Cores dos tokens ([[../skills/references/design/tokens-and-colors]]),
  mesmo estilo das etiquetas que o cabeçalho já tem (`meta.tag`).
- **Lista**: `useTerminals` chama `refresh()` em `window` `focus` e `visibilitychange` → visível (no máximo uma
  vez a cada 5 s).
- **Ficheiros**: `frontend/src/types/terminal.ts` (`remoteControl`), `components/terminals/TerminalPane.tsx`,
  `hooks/useTerminals.ts`, `errors/errorMessages.ts` (`TERMINAL_007`).
- **Estado vazio**: nada novo.
- **Visibilidade por role**: um só utilizador.

### 4.5 Códigos de erro novos
| Código | HTTP | Mensagem no frontend |
|---|---|---|
| `TERMINAL_007` | 409 | "Esta pasta ainda não é de confiança para o Claude Code — abre-a uma vez num terminal da app." |

## 5. Passos

Ordem obrigatória. Tiers: `opus` (desenho, não delegar) · `sonnet` (implementação) · `haiku` (mecânico).

- [x] **1. Spike do `--remote-control` num PTY** — ✅ 2026-10-22 (resultados no ADR 0017 §Estado e em §4.3)
  - Ficheiro: `backend/scripts/remote-control-spike.ts` (como `pty-spike.ts`/`statusline-spike.ts`)
  - Skill: — (spike; resultado no ADR 0017 §Estado e aqui em §4.3/§6)
  - Tier: `opus` (inline — precisa do dono a confirmar no telemóvel)
  - Aceite quando: confirmado e escrito: (a) `claude --resume <uuid> --settings <abs> --remote-control "X · Y"` e
    `--session-id <uuid> … --remote-control` (sem nome) arrancam num PTY **sem nenhum prompt extra** (consentimento
    de primeira vez do RC? se houver, como se aceita uma vez à mão); (b) a status line da quota continua a escrever
    `usage.json`; (c) a sessão aparece no app Claude com o nome dado; (d) onde fica guardada a confiança de uma
    pasta e se uma pasta-mãe conta; (e) o que o PTY mostra numa pasta sem trust. Se (a) falhar, parar e rever o ADR.

- [x] **2. `claudeArgs` com `--remote-control`** — ✅ 2026-10-22
  - Ficheiro: `backend/src/terminals/claudeArgs.ts`, `backend/test/claudeArgs.test.ts`
  - Skill: — (não há skill de backend; seguir [[../backend-conventions]] e [[security-baseline]])
  - Tier: `sonnet`
  - Aceite quando: só produz os argumentos de §4.3; nome fora de `REMOTE_NAME` (vazio, a começar por `-`, com
    `$`/`"`/quebra de linha, > 80) → `ClaudeArgsError`; testes cobrem com e sem nome, com e sem `--settings`.

- [ ] **3. `TerminalsService`: `remoteControl`, nome, trust e `stop`**
  - Ficheiro: `backend/src/state/state.schema.ts`, `backend/src/terminals/terminalsService.ts`,
    `backend/src/terminals/remoteName.ts` (novo), `backend/src/sessions/claudeSessions.ts` (ler a confiança, se o
    spike disser que é no `.claude.json`), `backend/src/common/errors.ts` (`TERMINAL_007`), testes em
    `backend/test/` (com `fakeClaude.ts`)
  - Skill: — ([[../backend-conventions]])
  - Tier: `sonnet`
  - Aceite quando: `create({…, remoteControl: true})` grava `remoteControl: true` e lança com RC e o nome de §4.3;
    `reopen` mantém o RC guardado e `reopen(id, size, {remoteControl: true})` liga-o; `stop` mata o processo e o
    terminal fica `stopped` na lista; pasta sem trust → `TERMINAL_007`; um `state.json` antigo (sem o campo) lê-se
    com `false`; `TerminalView.remoteControl` sai no `GET /api/terminals`. `npm test` verde.

- [ ] **4. Configuração e ambiente do filho**
  - Ficheiro: `backend/src/config.ts`, `backend/src/terminals/spawnClaude.ts` (denylist `TELEGRAM_`),
    `backend/.env.example`, `backend/test/config.test.ts`, `docs/environment.md`
  - Skill: — ([[../backend-conventions]])
  - Tier: `sonnet`
  - Aceite quando: sem token → `config.telegram` indefinido; token sem `TELEGRAM_ALLOWED_USER_ID` ou com formato
    errado → `Invalid environment:` sem mostrar o valor; `childEnv` nunca passa `TELEGRAM_*` (teste); as duas
    variáveis documentadas em [[../environment]].

- [ ] **5. Cliente da Bot API**
  - Ficheiro: `backend/src/telegram/telegramApi.ts`, `backend/test/telegramApi.test.ts`
  - Skill: — ([[../backend-conventions]])
  - Tier: `sonnet`
  - Aceite quando: os 5 métodos de §4.3 com `fetch` injetável; um erro de rede ou HTTP nunca contém o token
    (teste com um `fetch` falso que falha); `getUpdates` aborta com o `AbortSignal`.

- [ ] **6. O bot: polling, autorização, menus e ações**
  - Ficheiro: `backend/src/telegram/{telegramBot,menuStore,botActions,botMessages}.ts`, `backend/src/app.ts`
    (arrancar se `config.telegram`, parar no `onClose`), `backend/test/telegramBot.test.ts` (API falsa)
  - Skill: — ([[../backend-conventions]])
  - Tier: `sonnet` (rever a autorização com olhos `opus` antes de fechar)
  - Aceite quando, com uma API falsa: mensagem de outro `from.id` ou de um grupo → nenhuma resposta e nenhuma ação;
    botão com chave expirada/desconhecida → "Este menu expirou, usa /projetos"; fluxo retomar (livre / a correr sem
    RC → pergunta → reinicia o mesmo id / a correr com RC → "já está no app Claude" / parado → reabre com RC);
    nova conversa; `/estado` sem nenhum conteúdo de terminal; `/parar` com confirmação; `TERMINAL_002/003/004/007`
    e `SESSION_001` em português; nenhum log com texto de mensagens nem o token; 409 do Telegram → aviso, sem crash.

- [ ] **7. Frontend: etiqueta RC e lista relida ao ganhar foco**
  - Ficheiro: `frontend/src/types/terminal.ts`, `frontend/src/components/terminals/TerminalPane.tsx`,
    `frontend/src/hooks/useTerminals.ts`, `frontend/src/errors/errorMessages.ts`
  - Skill: `frontend-design-system` (+ `frontend-error-handling` para `TERMINAL_007`)
  - Tier: `sonnet`
  - Aceite quando: um terminal com `remoteControl` mostra **RC** (tokens, sem cores soltas) nos dois layouts; com a
    app aberta, um terminal criado pelo bot aparece ao voltar à janela, sem recarregar; um terminal parado pelo bot
    mostra o estado parado com **Reabrir**, e Reabrir volta com RC. `npm run typecheck` + `lint` verdes.

- [ ] **8. Verificação a sério e documentação**
  - Ficheiro: `docs/api.md`, `docs/architecture.md`, `docs/code-map.md`, `docs/security.md`, `docs/database.md`,
    esta spec (§6), `notes/whatIveDone.md`
  - Skill: `implement-todo` (fecho) · [[testing-and-verification]]
  - Tier: `opus` (inline — telemóvel do dono + browser)
  - Aceite quando: com um bot real de teste (token **diferente** do de uso, se já existir um): o momento de §1
    funciona de ponta a ponta no telemóvel; um ID de Telegram não autorizado não recebe resposta; nada do conteúdo
    de um terminal aparece no Telegram; a app no PC mostra o terminal com RC e permite escrever nele; reiniciar o
    backend → o terminal fica parado → Reabrir volta com RC. Docs atualizados (o módulo `telegram/` no code-map; a
    porta de entrada nova em security; `remoteControl` em database).

## 6. Estado atual

> ⚠️ **Atualizar SEMPRE no fim de cada sessão.** É a secção que torna esta spec retomável.

**Feito:** spec e [[../adr/0017-bot-telegram-e-remote-control|ADR 0017]] escritos (2026-10-22). Passo 1 (spike) feito
e confirmado no telemóvel do dono: `npx tsx backend/scripts/remote-control-spike.ts --hold 180` (fases A–D) e
`--name-test --prompt --hold 300` (E, nome numa conversa nova). Resultados no ADR 0017 §Estado e em §4.3 (trust, nome).
**Em curso:** —
Passo 2 feito: `claudeArgs(launch, {settingsPath, remoteControl: {name?}})` põe `--remote-control [<nome>]` em último;
`REMOTE_NAME` exportado de `claudeArgs.ts` (usar o mesmo regex ao gerar o nome no passo 3). 261 testes verdes.
**Próxima ação concreta:** passo 3 — `remoteControl` em `savedTerminalSchema` (`state.schema.ts`), depois
`terminalsService.ts` (`create`/`reopen`/`stop`, nome por `remoteName.ts`, trust → `TERMINAL_007`).
**Desvios ao plano:** o spike mostrou que uma conversa sem mensagens não aparece na lista do app Claude; o dono chega
lá pela notificação de "pronto" do próprio app, por isso o bot **não** envia o link (decisão do dono, §2 Fora).
**O que uma sessão nova precisa de saber:**
- Criar o bot é manual e do dono: `@BotFather` → `/newbot` → token; o ID de Telegram dele obtém-se com
  `@userinfobot`. Os dois vão para `backend/.env`, nunca para o git.
- **Nunca** dar o token real a uma instância de teste nem correr dois backends com ele (409 no `getUpdates`).
- Não editar o backend a partir de um terminal servido por ele em `npm run dev` (CLAUDE.md, regra 8).
- O `TerminalManager.kill` esquece o terminal (fica `stopped` na vista) — é isso que o `stop` usa.

## 7. Perguntas em aberto

| Pergunta | Bloqueia | Notas |
|---|---|---|
| No desktop de casa (Linux, ADR 0013), o primeiro `--remote-control` pede consentimento? | Não (instalação) | No spike, no portátil, não pediu — mas o RC já tinha sido usado lá. Se pedir, aceitar uma vez à mão num terminal normal |
| Um browser ligado a um terminal que o bot para recebe o fim do processo? | Passo 7 | `kill` faz `dispose`; ver se o painel aberto passa a parado ou fica pendurado |

## Relacionado

[[../adr/0017-bot-telegram-e-remote-control]] · [[../adr/0012-argumentos-do-claude-e-status-line]] ·
[[../adr/0004-exposicao-e-modelo-de-ameaca]] · [[terminais]] · [[skill-plan-feature]] · [[skill-implement-todo]]
