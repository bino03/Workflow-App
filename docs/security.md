# 🔐 Segurança & autenticação

> ✅ Fluxo de autenticação e CORS implementados e testados a 2026-09-28 (`backend/src/auth/`,
> `backend/src/common/authGuard.ts`). O resto: desenho da criação do projeto, a confirmar com o código.

## Fluxo de autenticação

Um só utilizador, **sem provedor externo** — adaptação do padrão "JWT em cookies HttpOnly" do Workflow
([[adr/0003-auth-utilizador-unico]]).

```
1. UI  → POST /api/auth/login {password}
2. backend compara com APP_PASSWORD_HASH (argon2id) — tempo constante, rate limit por IP
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
  errados → `429 AUTH_004`. A password compara-se com `argon2.verify` (tempo constante).
- **`Origin` no upgrade do WebSocket**: sem `Origin`, ou fora de `CORS_ALLOWED_ORIGINS` → `403 AUTH_003`,
  antes do upgrade. Testado (ADR 0004): sem cookie → 401; com cookie e `Origin` alheio → 403; sem
  `Origin` → 403; com os dois → liga.
- Terminar a sessão (logout ou expiração) **fecha os WebSockets abertos** dessa sessão; os PTYs continuam
  (❓ a confirmar — [[adr/README]] → decisões em aberto).

## Modelo de confiança — o que se executa na máquina

**O backend é a única fonte de verdade** — e aqui isso quer dizer, sobretudo, que **é o único que decide
o que se executa na máquina**:

| Quem | Pode | Não pode |
|---|---|---|
| Browser | Pedir um terminal numa pasta; enviar bytes a um terminal que existe; ler a biblioteca | Escolher o binário, os argumentos ou o ambiente do processo; abrir fora de `ALLOWED_ROOTS` |
| Backend | Lançar **apenas** `CLAUDE_BIN`, com argumentos fixos (`--resume <uuid validado>`) | Construir comandos a partir de texto do cliente; lançar um shell |
| Processo `claude` | Tudo o que o Claude Code pode fazer na pasta, com as permissões que ele próprio pede | — (a app não o limita; o modelo de permissões é o do Claude Code) |

Consequência a não esquecer: **um terminal desta app é um shell na máquina** — o Claude Code executa
comandos. Quem entra na app entra na máquina. Por isso a exposição à rede é uma decisão própria
([[adr/0004-exposicao-e-modelo-de-ameaca]]). Se vier uma base de dados, só o backend lhe liga.

## CORS

Origens permitidas lidas de configuração (`CORS_ALLOWED_ORIGINS`), nunca hardcoded. Sem valor de produção
por omissão, de propósito. Com credenciais ativas, uma origem errada em produção dá a qualquer site a
sessão do utilizador.

## Regras base

Ver [[security-baseline]]. Checklist antes de produção em `notes/roadmap/pre-deploy-security.md`.

## Relacionado

[[architecture]] · [[environment]]
