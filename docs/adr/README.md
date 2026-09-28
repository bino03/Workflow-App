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
| [[0005-biblioteca-lida-do-disco]] | A biblioteca do Workflow é lida do disco, só leitura | `aceite` | 2026-09-27 |
| [[0006-organizacao-por-dominio]] | Backend organizado por domínio (módulos) | `aceite` | 2026-09-27 |
| [[0007-omissoes-do-frontend]] | Estado, ícones e terminal no frontend (omissões da stack) | `aceite` | 2026-09-27 |
| [[0008-identidade-visual]] | Violeta + Geist, só escuro; dois layouts de terminais (foco dividido · grelha); só desktop | `aceite` | 2026-09-27 |
| [[0009-estado-em-ficheiro-json]] | Sem BD: `state.json` (terminais a reabrir, histórico de fechados com resumo do `.jsonl`, pastas); layout no browser; scrollback só em memória | `aceite` | 2026-09-28 |
| [[0010-spa-servida-pelo-backend]] | O backend serve o `frontend/dist`: uma origem em produção; fora de `/api` público (exceto WebSocket); origem própria aceite no WS | `aceite` | 2026-09-28 |
| [[0011-nome-de-utilizador-no-login]] | Login com `{username, password}`: `APP_USERNAME` no `.env`, o mesmo `AUTH_001` para os dois, comparação em tempo constante (substitui o contrato de login do 0003) | `aceite` | 2026-09-28 |
| [[0012-argumentos-do-claude-e-status-line]] | Argumentos do `claude`: `--session-id` (novo), `--resume` (retomar/continuar/reabrir), `--settings` com a status line da quota (condicionado ao spike) | `aceite` | 2026-09-28 |

## Decisões que ainda vão precisar de ADR

> Vida dos PTYs sem browser, reconexão/scrollback e `MAX_TERMINALS` ficaram decididos na spec
> [[../features/terminais]] §3 (2026-09-28) — decisões da feature, sem ADR próprio.

| Decisão | Opções à mesa | Quando |
|---|---|---|
| **Nome definitivo** | "Workflow App" é provisório | Quando houver um melhor |
| **Forma final da UI** | Web no browser · PWA · desktop (Tauri/Electron) por cima do mesmo backend. O design ([[0008-identidade-visual]]) foi feito para web no browser e serve qualquer das três. **Intenção (2026-09-28): uma app desktop no futuro**, como janela que abre o URL do backend (mesma origem → cookie e `Origin` sem mudanças), nunca com o PTY dentro do Electron. Para ficar barato: o backend serve a SPA e o URL da API é configurável ([[../../notes/ideas]] → App desktop) | Quando se avançar para a app desktop |
| **Fonte do indicador de quota** | Status line injetada ([[0012-argumentos-do-claude-e-status-line]]) — **a confirmar no spike** (passo 1 de [[../features/terminais]]) | No início da feature Terminais |
| **Como expor fora de casa** | VPN mesh (Tailscale) · túnel com autenticação à frente (Cloudflare Tunnel + Access) · reverse proxy com TLS | Antes de sair de `127.0.0.1` — ver [[0004-exposicao-e-modelo-de-ameaca]] |
| **Onde corre em "produção"** | Portátil hoje → desktop de casa (SO por confirmar) | Quando se mudar |
| **2FA no login** | TOTP · nada | Antes de expor na web |
| **Testes do frontend** | Sem Vitest (omissão da stack) · Vitest + Testing Library | No scaffold do frontend |
