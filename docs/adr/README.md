# 🧭 Decisões de arquitetura (ADRs)

Registo numerado e datado das decisões estruturais. Cada ADR guarda **o contexto, as alternativas e o
porquê** — não só a escolha.

## Regra

**Nunca editar um ADR antigo para mudar de decisão.** Cria-se um novo que referencia o anterior, e
marca-se o antigo como `substituído por [[NNNN-…]]`. O histórico das decisões erradas é tão útil como o
das certas.

Estados: `proposto` → `aceite` → `substituído`. Template: `Templates/ADR.md` (**Ctrl+T**). Nome:
`NNNN-titulo-curto.md`.

## ADRs

| # | Decisão | Estado | Data |
|---|---|---|---|
| [[0001-stack-tecnologica]] | `node-fastify` (📋 criado na hora — Node + TypeScript + Fastify + node-pty) + `react-vite-antd` (✅) + xterm.js | `aceite` | 2026-09-27 |
| [[0002-motor-via-pty-sobre-subscricao]] | O motor é o Claude Code interativo num PTY — nunca a API/SDK | `aceite` | 2026-09-27 |
| [[0003-auth-utilizador-unico]] | Login próprio de um só utilizador, sessão em cookie HttpOnly | `aceite` (contrato de login substituído por [[0011-nome-de-utilizador-no-login]]) | 2026-09-27 |
| [[0004-exposicao-e-modelo-de-ameaca]] | Um terminal é um shell: `127.0.0.1` por omissão, proteções obrigatórias antes de expor | `aceite` | 2026-09-27 |
| [[0005-biblioteca-lida-do-disco]] | A biblioteca do Workflow é lida do disco, só leitura | `aceite` (a regra "nunca escreve" foi parcialmente aberta por [[0014-escrita-controlada-biblioteca]], que o [[0019-importar-pelas-skills-do-workflow]] substituiu: a app volta a não escrever ficheiros, lança as skills do Workflow) | 2026-09-27 |
| [[0006-organizacao-por-dominio]] | Backend organizado por domínio (módulos) | `aceite` | 2026-09-27 |
| [[0007-omissoes-do-frontend]] | Estado, ícones e terminal no frontend (omissões da stack) | `aceite` | 2026-09-27 |
| [[0008-identidade-visual]] | Violeta + Geist, só escuro; dois layouts de terminais (foco dividido · grelha); só desktop | `aceite` | 2026-09-27 |
| [[0009-estado-em-ficheiro-json]] | Sem BD: `state.json` (terminais a reabrir, histórico de fechados com resumo do `.jsonl`, pastas); layout no browser; scrollback só em memória | `aceite` | 2026-09-28 |
| [[0010-spa-servida-pelo-backend]] | O backend serve o `frontend/dist`: uma origem em produção; fora de `/api` público (exceto WebSocket); origem própria aceite no WS | `aceite` | 2026-09-28 |
| [[0011-nome-de-utilizador-no-login]] | Login com `{username, password}`: `APP_USERNAME` no `.env`, o mesmo `AUTH_001` para os dois, comparação em tempo constante (substitui o contrato de login do 0003) | `aceite` | 2026-09-28 |
| [[0012-argumentos-do-claude-e-status-line]] | Argumentos do `claude`: `--session-id` (novo), `--resume` (retomar/continuar/reabrir), `--settings` com a status line da quota (confirmada no spike) | `aceite` | 2026-09-28 |
| [[0013-linux-no-desktop-de-casa]] | Desktop de casa em Linux com ambiente gráfico leve (Xubuntu/Debian + Xfce, login automático) — pela RAM (8 GB) e para a extensão Claude in Chrome ter sessão | `aceite` | 2026-09-28 |
| [[0014-escrita-controlada-biblioteca]] | A app escreve na biblioteca do Workflow em dois sítios só: `stacks/<id>/skills/skill-*.md` (criar, nunca sobrescrever) + `provides-skills` do `STACK.md` dessa stack (abre parcialmente o [[0005-biblioteca-lida-do-disco]]) | `substituído` por [[0019-importar-pelas-skills-do-workflow]] | 2026-09-30 |
| [[0015-passkeys-webauthn]] | Passkeys (WebAuthn) como alternativa à password: descobríveis, várias, em `DATA_DIR/passkeys.json`, registo exige a password, rate limit partilhado, revogar mata as sessões dessa passkey; `rpID` por `.env` (complementa o 0003/0011) | `aceite` | 2026-10-09 |
| [[0016-atalhos-editaveis-no-state]] | Atalhos de teclado editáveis nas Definições, guardados no `state.json` (só as alterações, `STATE_VERSION` 2); restrições `Alt+…`, colisões internas recusadas, Claude Code avisa | `aceite` | 2026-10-20 |
| [[0017-bot-telegram-e-remote-control]] | Bot de Telegram (long polling, opcional, só o ID autorizado) que abre terminais com `--remote-control [<nome>]` — argumento novo à lista do 0012; nunca conteúdo dos terminais no Telegram (complementa o 0004/0012) | `aceite` (spike por fazer) | 2026-10-22 |
| [[0018-pre-visualizacao-por-tailscale-serve]] | Pré-visualização de apps em dev por `tailscale serve` (só tailnet, nunca `funnel`), a pedido, ligada a um terminal: `TAILSCALE_BIN` com argumentos fixos (abre a regra 4 do 0004), porta descoberta pelo backend, limpeza só da própria gama; o bot envia o link (complementa o 0004/0017). A Workflow App continua em `127.0.0.1` | `aceite` (spike por fazer) | 2026-10-23 |
| [[0019-importar-pelas-skills-do-workflow]] | Importar skills/designs/stacks pela skill `/import` **do Workflow** num terminal `hidden` (prompt inicial + `--add-dir` + `--settings` com hooks, nada do cliente na linha de comando), estado por `result.json` e hooks, revisão do diff e commit/descarte com `GIT_BIN`; sai o upload direto (substitui o 0014, complementa o 0004/0012) | `aceite` | 2026-10-25 |
| [[0020-sessoes-guiadas]] | Sessões guiadas: o `claude` interativo num terminal `hidden` com UI própria — `AskUserQuestion` e permissões por hooks bloqueantes (`PreToolUse` com `updatedInput`, `PermissionRequest`) ligados à app por ficheiros em `DATA_DIR/guided/`, `--permission-mode default` fixo, texto do dono no PTY por REST em bracketed paste (sem caracteres de controlo), conversa lida do `.jsonl`, `react-markdown` sem HTML (complementa o 0002/0012/0019) | `aceite` | 2026-10-26 |
| [[0021-permissoes-das-sessoes-guiadas]] | Permissões das sessões guiadas: o `/create` declara o destino (`destination.json`) e o hook aprova as ferramentas de ficheiros lá dentro (só numa pasta nova, dentro das `ALLOWED_ROOTS`); modo **Perguntar / Automático** por sessão, guardado fora do alcance do Claude (`DATA_DIR/guided-control/`) (complementa o 0020) | `aceite` | 2026-10-26 |

## Decisões que ainda vão precisar de ADR

> Vida dos PTYs sem browser, reconexão/scrollback e `MAX_TERMINALS` ficaram decididos na spec
> [[../features/terminais]] §3 (2026-09-28) — decisões da feature, sem ADR próprio.

| Decisão | Opções à mesa | Quando |
|---|---|---|
| **Nome definitivo** | "Workflow App" é provisório | Quando houver um melhor |
| **Forma final da UI** | Web no browser · PWA · desktop (Tauri/Electron) por cima do mesmo backend. O design ([[0008-identidade-visual]]) foi feito para web no browser e serve qualquer das três. **Intenção (2026-09-28): uma app desktop no futuro**, como janela que abre o URL do backend (mesma origem → cookie e `Origin` sem mudanças), nunca com o PTY dentro do Electron. Para ficar barato: o backend serve a SPA e o URL da API é configurável ([[../../notes/ideas]] → App desktop) | Quando se avançar para a app desktop |
| **Como expor fora de casa** | VPN mesh (Tailscale) · túnel com autenticação à frente (Cloudflare Tunnel + Access) · reverse proxy com TLS | Antes de sair de `127.0.0.1` — ver [[0004-exposicao-e-modelo-de-ameaca]] |
| **2FA no login** | TOTP · nada | Antes de expor na web |
| **Testes do frontend** | Sem Vitest (omissão da stack) · Vitest + Testing Library | No scaffold do frontend |
