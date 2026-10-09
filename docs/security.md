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
| Browser | Pedir um terminal numa pasta; enviar bytes a um terminal que existe; ler a biblioteca e acrescentar-lhe uma skill validada (ADR 0014); listar sub-pastas e sessões gravadas **só dentro** de `ALLOWED_ROOTS` (sem pastas escondidas nem junctions; nunca acima de uma raiz) | Escolher o binário, os argumentos ou o ambiente do processo; abrir fora de `ALLOWED_ROOTS`; escrever no `WORKFLOW_PATH` fora de `stacks/<id>/skills/skill-*.md` e do `provides-skills` desse `STACK.md` |
| Backend | Lançar **apenas** `CLAUDE_BIN`, com os argumentos de [[adr/0012-argumentos-do-claude-e-status-line]] (`--session-id <uuid do backend>`, `--resume <uuid validado>`, `--settings <DATA_DIR>/claude-settings.json`) | Construir comandos a partir de texto do cliente; lançar um shell |
| Processo `claude` | Tudo o que o Claude Code pode fazer na pasta, com as permissões que ele próprio pede | — (a app não o limita; o modelo de permissões é o do Claude Code) |

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
