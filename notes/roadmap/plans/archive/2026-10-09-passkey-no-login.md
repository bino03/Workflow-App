# Plano — 2026-10-09 passkey-no-login

**Estado**: concluído
**Âmbito escolhido**: só o item "Entrar com uma passkey no login" (MVP — a detalhar)
**Orçamento da sessão**: sem limite

## Esclarecimentos já obtidos
- A app não está exposta (só `127.0.0.1`, HTTP) e o WebAuthn no iPhone exige HTTPS + domínio fixo → **implementar já, testar em localhost**; `rpID`/origin configuráveis por `.env`; a verificação no iPhone real fica pendente até a app ser exposta.
- Passkey **além** da password (a password fica como alternativa/recuperação).
- Credenciais públicas num **ficheiro à parte em `DATA_DIR`** (`passkeys.json`, escrita atómica) — coerente com o ADR 0011 (não misturar credenciais com o estado dos terminais).
- **Várias passkeys**, cada uma com nome e revogável; **registar exige a password outra vez**.
- Biblioteca: **`@simplewebauthn/server` + `@simplewebauthn/browser`**.
- Relação com o 2FA: **caminhos independentes** (password OU passkey); o 2FA/TOTP continua em aberto.
- Rate limit: **o mesmo 5/min por IP, partilhado** entre password e passkey.
- Login UI: passkey **descobrível**, **botão + autofill** (pedido condicional no campo do nome).
- (decidido ao planear) Revogar uma passkey **termina as sessões abertas com ela**.

## Ordem confirmada
1. [x] ADR 0015 — passkeys (WebAuthn) como alternativa à password — concluída (`docs/adr/0015-passkeys-webauthn.md`)
2. [x] Backend — config, passkeyStore, challenges, rotas, erros, testes, docs — concluída (238 testes + 3 de config; HTTP real fica na verificação da tarefa 3)
3. [x] Frontend — serviço, erros, LoginPage (botão + autofill), SettingsDrawer (registar/listar/revogar), verificação em localhost com autenticador virtual — concluída (browser 34/34; bug do ciclo do autofill corrigido; iPhone real pendente da exposição)

## Próximo passo
Nenhum nesta frente até a app ser exposta — ver `notes/verificacao-browser-pendente.md`.
