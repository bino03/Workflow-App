# 🔐 Segurança & autenticação

> ✅ Fluxo de autenticação e CORS implementados e testados a 2026-09-28 (`backend/src/auth/`,
> `backend/src/common/authGuard.ts`). O resto: desenho da criação do projeto, a confirmar com o código.

## Fluxo de autenticação

Um só utilizador, **sem provedor externo** — adaptação do padrão "JWT em cookies HttpOnly" do Workflow
([[adr/0003-auth-utilizador-unico]]; nome de utilizador desde [[adr/0011-nome-de-utilizador-no-login]]).

```
1. UI  → POST /api/auth/login {username, password}
2. backend compara o nome com APP_USERNAME (SHA-256 + timingSafeEqual) e a password com APP_PASSWORD_HASH
   (argon2id), os dois sempre — tempo constante, rate limit por IP; qualquer um errado → o mesmo AUTH_001
3. backend → Set-Cookie: session (id opaco assinado com SESSION_SECRET; HttpOnly, SameSite=Strict,
   Secure fora de localhost). A sessão vive em memória do backend — reiniciar = entrar outra vez
4. pedidos REST seguintes: o browser envia o cookie; a guarda valida-o
5. upgrade do WebSocket: a MESMA guarda valida o cookie **e o header Origin** (contra
   CORS_ALLOWED_ORIGINS) — sem isto, qualquer site aberto no browser podia ligar-se a um terminal
   (Cross-Site WebSocket Hijacking)
6. GET /api/auth/me → {authenticated: true}
7. POST /api/auth/logout → apaga a sessão no servidor e o cookie com os mesmos atributos
8. 401 no frontend → limpar estado local e ir para /login (sem refresh token: a sessão é de servidor)
```

- **O frontend não guarda credenciais nem tokens.** `withCredentials: true` na instância HTTP.
- **Endpoints públicos, explícitos**: `POST /api/auth/login`, `GET /api/health`. Tudo o resto — incluindo
  o WebSocket — exige sessão.
- **Protegido por omissão**: a guarda é um hook `onRequest` global; uma rota só é pública se o disser
  (`config: { public: true }`). Uma rota nova esquecida nasce fechada, não aberta. Corre antes do parse do
  corpo — um pedido sem sessão nunca chega à validação.
- **Sessão**: id de 32 bytes aleatórios (`base64url`), num `Map` em memória; cookie `session` assinado
  (HMAC do `@fastify/cookie` com `SESSION_SECRET`), `HttpOnly`, `SameSite=Strict`, `Path=/`,
  `Max-Age` = limite absoluto. Expira ao fim de **`SESSION_IDLE_HOURS` (12 h) sem pedidos** ou
  **`SESSION_MAX_DAYS` (7 dias) desde o login**, o que vier primeiro; um varrimento por minuto apanha as
  que expiram sem mais pedidos. O fim da sessão (logout, expiração, novo login) corre callbacks
  `sessionStore.onEnd` — é aí que o gateway dos terminais fecha os WebSockets dessa sessão.
- **Rate limit do login**: 5 pedidos por minuto por IP (`@fastify/rate-limit`, só nessa rota), certos ou
  errados → `429 AUTH_004`. A password compara-se com `argon2.verify` (tempo constante); o nome, com
  `timingSafeEqual` sobre o SHA-256 dos dois lados (comprimentos iguais). O argon2 corre **mesmo com o nome
  errado**, e a resposta é o mesmo `AUTH_001`: nem o conteúdo nem o tempo dizem qual dos dois falhou (testado em
  `authService.test.ts`).
- **`Origin` no upgrade do WebSocket**: sem `Origin`, ou fora de `CORS_ALLOWED_ORIGINS` → `403 AUTH_003`,
  antes do upgrade. Testado (ADR 0004): sem cookie → 401; com cookie e `Origin` alheio → 403; sem
  `Origin` → 403; com os dois → liga.
- **Endpoints públicos das passkeys**: `POST /api/auth/passkeys/login/options` e `POST /api/auth/passkeys/login`
  (secção abaixo).
- Terminar a sessão (logout ou expiração) **fecha os WebSockets abertos** dessa sessão; os PTYs continuam
  (❓ a confirmar — [[adr/README]] → decisões em aberto).

## Passkeys (WebAuthn) — ✅ segundo caminho de entrada (em `localhost`; o iPhone espera pela exposição)

Um caminho **independente** da password, que continua a funcionar e serve de recuperação
([[adr/0015-passkeys-webauthn]]). Biblioteca: `@simplewebauthn/server` (`backend/src/auth/passkey.routes.ts`) e `@simplewebauthn/browser` (botão + autofill em `pages/login/LoginPage.tsx`; registar/listar/revogar em Definições → `components/settings/PasskeysSection.tsx`).

```
Registar (com sessão, no ecrã de definições):
1. UI → POST /api/auth/passkeys/registration/options {password}   ← a password outra vez; conta no rate limit
2. backend → opções (residentKey + userVerification "required", excludeCredentials); challenge preso à sessão
3. browser → navigator.credentials.create() (Face ID / Windows Hello)
4. UI → POST /api/auth/passkeys {name, response} → verifica challenge (uso único, desta sessão), origem, rpID,
   UV → guarda id + chave pública + contador em DATA_DIR/passkeys.json

Entrar (público):
1. UI → POST /api/auth/passkeys/login/options → challenge (sem allowCredentials: passkey descobrível)
2. browser → navigator.credentials.get() — botão "Entrar com passkey" ou autofill do campo do nome
3. UI → POST /api/auth/passkeys/login {response} → verifica assinatura, challenge, origem, rpID, UV →
   atualiza o contador → a MESMA sessão/cookie do login com password
```

- **Rate limit partilhado**: o login com password, o login com passkey e a password pedida ao registar
  gastam o **mesmo** contador de 5/min por IP (um handler `app.rateLimit()` ligado às três rotas — um
  `config.rateLimit` por rota daria um contador a cada uma, e o `groupId` não partilha entre rotas com o
  store em memória). As opções de login têm um limite próprio de 30/min: não provam nada.
- **Challenges** em memória, de uso único, 5 min, máx. 100 pendentes. O do login não precisa de cookie — vem
  dentro do `clientDataJSON` assinado e só é aceite se foi emitido e ainda não usado (um replay dá `AUTH_005`).
  O do registo fica preso à sessão que o pediu.
- **Resposta opaca**: passkey desconhecida, assinatura forjada, origem ou `rpID` errados, challenge inventado
  ou repetido → sempre o mesmo `401 AUTH_005`. Testado com um autenticador por software
  (`backend/test/softAuthenticator.ts`) contra a verificação real da biblioteca.
- **`rpID` e origens** vêm do `.env` (`WEBAUTHN_RP_ID`, omissão `localhost`; [[environment]]). `127.0.0.1`
  nunca serve de `rpID` → em local abre-se a app em `localhost`. **O iPhone só funciona com a app exposta em
  HTTPS com um domínio fixo**, e mudar o `rpID` invalida as passkeys registadas.
- **Revogar** (`DELETE /api/auth/passkeys/:id`) apaga a passkey **e termina as sessões abertas com ela** (a
  sessão guarda `passkeyId`). iPhone perdido: entrar com a password noutro sítio e revogar.
- Só a parte pública é guardada; a chave pública e o contador nunca saem do backend.

## Modelo de confiança — o que se executa na máquina

**O backend é a única fonte de verdade** — e aqui isso quer dizer, sobretudo, que **é o único que decide
o que se executa na máquina**:

| Quem | Pode | Não pode |
|---|---|---|
| Browser | Pedir um terminal numa pasta; enviar bytes a um terminal que existe; ler a biblioteca e pedir uma importação (o pedido vai para um ficheiro, nunca para a linha de comando) e aceitá-la ou descartá-la (ADR 0019); começar uma criação (a descrição vai para o `brief.md`, nunca para a linha de comando) e responder a uma sessão guiada — escolher opções, permitir/recusar o pedido **que está à espera** (`requestId`), e escrever texto livre, que entra no PTY como um bracketed paste **sem caracteres de controlo** e só com o Claude parado à espera (ADR 0020); listar sub-pastas e sessões gravadas **só dentro** de `ALLOWED_ROOTS` (sem pastas escondidas nem junctions; nunca acima de uma raiz) | Escolher o binário, os argumentos ou o ambiente do processo; abrir fora de `ALLOWED_ROOTS`; escrever no `WORKFLOW_PATH` (a app nunca escreve lá ficheiros; o `git` do Workflow só recebe caminhos tirados do próprio `git status`, confirmados dentro do repo); pôr texto seu na linha de comando de uma importação |
| Bot de Telegram (só com `TELEGRAM_BOT_TOKEN`; só o `TELEGRAM_ALLOWED_USER_ID`, numa conversa privada) | Listar os projetos do registo e as conversas gravadas (títulos); abrir/retomar um terminal **com Remote Control** numa pasta de confiança do Claude Code; ver os terminais a correr e a quota; parar um terminal (fica parado, não fechado) | Ver ou escrever no que um terminal mostra (isso exige o login claude.ai, no app Claude); abrir fora do registo/`ALLOWED_ROOTS`; escolher argumentos — [[adr/0017-bot-telegram-e-remote-control]] |
| Backend | Lançar **apenas** `CLAUDE_BIN`, com os argumentos de [[adr/0012-argumentos-do-claude-e-status-line]] e [[adr/0017-bot-telegram-e-remote-control]] (`--session-id <uuid do backend>`, `--resume <uuid validado>`, `--settings <DATA_DIR>/claude-settings.json`, `--remote-control [<nome gerado pelo backend>]`), e numa importação ([[adr/0019-importar-pelas-skills-do-workflow]]) `--add-dir <pastas resolvidas pelo backend>` (primeiro), `--settings <DATA_DIR>/claude-import-settings.json` e o prompt `/import <DATA_DIR>/imports/<uuid>/request.json` (último, validado — as respostas do dono ficam dentro do ficheiro); numa sessão guiada ([[adr/0020-sessoes-guiadas]]) `--add-dir <DATA_DIR>/guided/<uuid>`, `--settings <DATA_DIR>/claude-guided-settings.json`, `--permission-mode default` (fixo) e o comando do propósito, de um conjunto fechado — hoje só `/create --app <DATA_DIR>/guided/<uuid>/brief.md` (validado). **E** `GIT_BIN`, só em `src/imports/workflowGit.ts`, `cwd` = `WORKFLOW_PATH`: `status --porcelain=v1 -z`, `diff -- <p>`, `add -- <p…>`, `commit -m <mensagem validada>`, `reset -- <p…>`, `checkout -- <p…>`, `rev-parse HEAD` — os `<p>` vêm do próprio `git status` e são confirmados dentro do repo. **E** `TAILSCALE_BIN`, só em `src/preview/tailscale.ts` e só em quatro formas ([[adr/0018-pre-visualizacao-por-tailscale-serve]]): `status --json`, `serve status --json`, `serve --bg --https=<P da gama> http://127.0.0.1:<D descoberta pelo backend>`, `serve --https=<P> off` — portas validadas como inteiros antes do `argv`, tempo limite de 10 s. Além disso, comandos de leitura fixos do sistema (`powershell` com `Get-CimInstance`/`Get-NetTCPConnection`, `taskkill` por PID) | Construir comandos a partir de texto do cliente; lançar um shell; `tailscale funnel`/`serve reset`/`up`/`set` |
| Processo `claude` | Tudo o que o Claude Code pode fazer na pasta, com as permissões que ele próprio pede | — (a app não o limita; o modelo de permissões é o do Claude Code) |

**O bot é uma porta de entrada que não é a app** ([[adr/0017-bot-telegram-e-remote-control]]): só faz ligações de
saída (long polling, nunca webhook), não depende de expor a app, e quem controlar a conta de Telegram do dono pode
**abrir e parar** terminais (gastar quota, interromper trabalho) mas não **ver nem escrever** neles. Mensagens de
outras pessoas ou de grupos são ignoradas sem resposta; os botões levam só uma chave curta em memória (10 min) e cada
ação revalida projeto, conversa e terminal. Para o Telegram e para os logs só vão nomes, títulos, estados e a quota —
nunca o conteúdo de um terminal nem o token (o URL da Bot API contém-no: os erros são reescritos sem ele;
`TELEGRAM_*` fora do ambiente do `claude`). Reforço opcional do lado da Anthropic: *Require trusted devices* no claude.ai.

**As sessões guiadas** ([[adr/0020-sessoes-guiadas]]) acrescentam três superfícies, cada uma estreita:
- **Uma rota REST que escreve num PTY** (`POST /api/guided/:id/message`). Sessão obrigatória como as outras (o
  cookie `SameSite=Strict` não segue num pedido de outro site); só para terminais de sessões guiadas, só no estado
  "à espera de texto"; o texto perde todos os caracteres de controlo exceto `\n`/`\t` (`terminals/paste.ts`) — sem
  isso um `ESC[201~` fechava o paste e o resto chegava como teclas — e nunca vai para o log (só o tamanho).
- **Hooks bloqueantes** (`DATA_DIR/guided-hook.cjs`, comando fixo, `timeout` 24 h): só atuam numa sessão cujo
  `session_id` (validado como UUID) está no índice `DATA_DIR/guided/by-session/`; qualquer outra sai sem decidir. A
  resposta vem de um ficheiro que só o backend escreve, para o `requestId` que está à espera.
- **Duas permissões no `--settings` das sessões guiadas**: escrever em `DATA_DIR/guided/**` (o `result.json` e os
  ficheiros de trabalho do `/create`) e **ler** dentro de cada `ALLOWED_ROOTS` (ver se o destino existe) sem
  perguntar. Escrever fora disso, correr comandos fora da allowlist do Workflow, `git init` — tudo continua a pedir,
  e é o dono que decide no cartão. `--permission-mode default` garante isso mesmo que a conta use `auto`.
- **O hook também aprova sozinho** ([[adr/0021-permissoes-das-sessoes-guiadas]]), em dois casos: (1) a sessão está em
  **Automático** — escolha explícita do dono, por sessão, reversível no mesmo seletor; (2) uma ferramenta de
  ficheiros (`Read`/`Glob`/`Grep`/`Edit`/`Write`/`MultiEdit`/`NotebookEdit`) com caminho absoluto **dentro do
  destino** que o `/create` declarou em `destination.json` — e só se esse destino estiver dentro de uma
  `ALLOWED_ROOTS` sem ser uma, não tocar no Workflow nem no `DATA_DIR`, e **for novo** (não existe, ou nasceu depois
  do início da sessão). Um `destination.json` a apontar para um projeto que já existia continua a pedir. Bash nunca
  entra no caso (2). O modo e o início vivem em `DATA_DIR/guided-control/`, que só o backend escreve — fora de
  `DATA_DIR/guided/**`, onde o Claude escreve sem perguntar; senão o próprio Claude ligava o Automático.

Consequência a não esquecer: **um terminal desta app é um shell na máquina** — o Claude Code executa
comandos. Quem entra na app entra na máquina. Por isso a exposição à rede é uma decisão própria
([[adr/0004-exposicao-e-modelo-de-ameaca]]). Se vier uma base de dados, só o backend lhe liga.

## CORS

Origens permitidas lidas de configuração (`CORS_ALLOWED_ORIGINS`), nunca hardcoded. Sem valor de produção
por omissão, de propósito. Com credenciais ativas, uma origem errada em produção dá a qualquer site a
sessão do utilizador.

**Quando o backend serve a SPA** (há `FRONTEND_DIST/index.html`), junta às origens aceites **no upgrade
do WebSocket** as suas próprias: `http://localhost:<PORT>` e `http://127.0.0.1:<PORT>`. É a origem que
o browser manda quando a página veio do próprio backend. O `Host` do pedido nunca entra na decisão (é
forjável e muda atrás de um proxy). O REST não precisa: um pedido da mesma origem não depende de CORS.
Servido por outro nome (Tailscale, túnel, proxy), essa origem tem de entrar no `CORS_ALLOWED_ORIGINS`.

**A guarda isenta tudo fora de `/api`** (o HTML, os assets e a página de login carregam sem sessão), mas
**só para HTTP normal**: um WebSocket exige sessão e `Origin` em qualquer caminho. `/api` sem sessão
continua a dar `401` mesmo em rotas que não existem. Testado em `backend/test/spa.test.ts` (incluindo
path traversal para fora do `dist`).

## Regras base

Ver [[security-baseline]]. Checklist antes de produção em `notes/roadmap/pre-deploy-security.md`.

## Relacionado

[[architecture]] · [[environment]]
