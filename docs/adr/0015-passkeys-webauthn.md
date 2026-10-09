---
tags: [adr]
status: aceite
data: 2026-10-09
---

# ADR 0015 — Passkeys (WebAuthn) como alternativa à password

**Data**: 2026-10-09 · **Estado**: `aceite` · **Decidido com**: `/implement-todo` (pedido do dono)

Complementa [[0003-auth-utilizador-unico]] e [[0011-nome-de-utilizador-no-login]]: acrescenta um **segundo
caminho** de entrada. Nada do que eles decidiram muda — um utilizador, sessão de servidor em cookie
`HttpOnly`, `APP_USERNAME` + `APP_PASSWORD_HASH` no `.env`, rate limit de 5/min por IP.

## Contexto

O dono pediu (2026-10-09): «no login da workflowapp quero adicionar uma passkey para poder entrar com o meu
iphone» — Face ID / Touch ID via chaveiro do iCloud, sem escrever a password.

Duas restrições do WebAuthn moldam tudo o resto:

- Só funciona num **contexto seguro** (HTTPS, ou `http://localhost`), e a passkey fica presa a um **`rpID`**
  — o domínio da página. Um IP (`127.0.0.1`) não serve de `rpID`.
- **Mudar o `rpID` invalida todas as passkeys registadas** — o autenticador só as oferece ao mesmo domínio.

Hoje a app só escuta em `127.0.0.1` por HTTP ([[0004-exposicao-e-modelo-de-ameaca]]); a forma de expor fora
de casa (Tailscale / túnel / proxy) ainda não está decidida. O iPhone não chega à app hoje.

## Opções

| Questão | Opções | Escolhida | Porquê |
|---|---|---|---|
| Relação com a password | em vez · **além** · as duas (2FA) | **Além, caminhos independentes** | A password continua a ser a recuperação (perder o iPhone não tranca o dono fora); "as duas" não cumpre "sem escrever a password" |
| Quando | **já, testado em `localhost`** · depois de expor · adiar | **Já** | O código não depende da forma de expor; `rpID`/origens vêm do `.env`. O teste no iPhone real espera pela exposição |
| Onde guardar as credenciais públicas | `state.json` v2 · **`DATA_DIR/passkeys.json`** · `.env` | **`passkeys.json`** | O 0011 recusou misturar credenciais com estado de terminais; o `.env` não se escreve a partir da app |
| Quantas | uma · **várias** | **Várias**, com nome | iPhone + portátil; revogar uma não afeta as outras |
| Registar exige | a sessão · **a password outra vez** | **Password** | Uma sessão roubada (um browser esquecido aberto) não pode plantar uma passkey e ganhar acesso permanente |
| Rate limit | próprio · **partilhado** | **Partilhado** | Um só orçamento de 5 tentativas/min por IP para tudo o que prova identidade: login com password, login com passkey, e a password pedida ao registar |
| Biblioteca | **`@simplewebauthn/server` + `/browser`** · `fido2-lib` + código próprio | **SimpleWebAuthn** | A mais usada, só JS (sem binários nativos — o Application Control do Windows já bloqueou nativos aqui), com tipos TS dos dois lados |
| 2FA (TOTP) | a passkey substitui · **independente** | **Independente** | O TOTP continua decisão em aberto, antes de expor ([[README]]) |

## Decisão

- **Passkeys descobríveis** (`residentKey: required`, `userVerification: required`) — o login não pede nome;
  o browser oferece a passkey num botão "Entrar com passkey" **e** no autofill do campo do nome (pedido
  condicional, `autocomplete="username webauthn"`).
- **Configuração**: `WEBAUTHN_RP_ID` (por omissão `localhost`; tem de ser um nome, não um IP) e
  `WEBAUTHN_ORIGINS` (por omissão: as origens de `CORS_ALLOWED_ORIGINS` e `http://localhost:<PORT>` cujo host
  é o `rpID` ou um subdomínio dele). Validados pelo zod no arranque.
- **Armazenamento**: `DATA_DIR/passkeys.json` (`{version: 1, passkeys: [...]}`), com escrita atómica como o
  `state.json`. Cada entrada: id do credencial, chave pública, contador, transports, nome, `createdAt`,
  `lastUsedAt`. Ficheiro inválido → o backend **não arranca** (nunca o sobrescreve). Máximo de 20 passkeys.
- **Challenges**: aleatórios, em memória, **de uso único**, expiram ao fim de 5 minutos; no máximo 100
  pendentes. O do login não precisa de cookie: o challenge vem dentro do `clientDataJSON` assinado, e o
  servidor aceita-o só se o emitiu e ainda não foi usado. O do registo fica preso à sessão que o pediu.
- **Rotas**: opções de login (pública, limite próprio e folgado — não prova nada, só emite um challenge);
  login com passkey (pública, **no limite partilhado**); opções de registo (com sessão, pede a password, **no
  limite partilhado**); verificação do registo, listagem e revogação (com sessão).
- **Revogar uma passkey termina as sessões abertas com ela.** A sessão guarda com que passkey nasceu. Perdido
  o iPhone: entra-se com a password noutro sítio, revoga-se, e a sessão do iPhone acaba logo.
- **A sessão emitida é a mesma** das duas formas (o mesmo cookie, `SESSION_IDLE_HOURS`, `SESSION_MAX_DAYS`).
  Um login com passkey invalidado (credencial desconhecido, assinatura errada, challenge expirado ou
  repetido) devolve sempre o mesmo erro, sem dizer qual.

## Consequências

- **O iPhone só funciona depois de a app estar exposta com HTTPS e um domínio fixo.** Até lá, a passkey usa-se
  em `http://localhost` no desktop (Windows Hello, ou o iPhone como autenticador por QR/Bluetooth). A página
  tem de ser aberta em `localhost`, não em `127.0.0.1`.
- **Escolher a forma de expor fixa o `rpID`**, e mudá-lo depois obriga a registar as passkeys outra vez. As
  passkeys registadas em `localhost` não servem no domínio final.
- O ecrã de login no iPhone corre num telemóvel, e o [[0008-identidade-visual]] é "só desktop". O login é
  um formulário simples e funciona; o resto da app no telemóvel continua fora do âmbito.
- Mais uma superfície pública (as duas rotas de login com passkey): ficam sob o mesmo rate limit e a mesma
  resposta opaca do login com password.

## Estado

`aceite` — decidido com o dono no `/implement-todo` de 2026-10-09.
