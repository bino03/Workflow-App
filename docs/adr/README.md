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
| [[0003-auth-utilizador-unico]] | Login próprio de um só utilizador, sessão em cookie HttpOnly | `aceite` | 2026-09-27 |
| [[0004-exposicao-e-modelo-de-ameaca]] | Um terminal é um shell: `127.0.0.1` por omissão, proteções obrigatórias antes de expor | `aceite` | 2026-09-27 |
| [[0005-biblioteca-lida-do-disco]] | A biblioteca do Workflow é lida do disco, só leitura | `aceite` | 2026-09-27 |
| [[0006-organizacao-por-dominio]] | Backend organizado por domínio (módulos) | `aceite` | 2026-09-27 |
| [[0007-omissoes-do-frontend]] | Estado, ícones e terminal no frontend (omissões da stack) | `aceite` | 2026-09-27 |
| [[0008-identidade-visual]] | Violeta + Geist, só escuro; dois layouts de terminais (foco dividido · grelha); só desktop | `aceite` | 2026-09-27 |

## Decisões que ainda vão precisar de ADR

| Decisão | Opções à mesa | Quando |
|---|---|---|
| **Nome definitivo** | "Workflow App" é provisório | Quando houver um melhor |
| **Forma final da UI** | Web no browser · PWA · desktop (Tauri/Electron) por cima do mesmo backend. O design ([[0008-identidade-visual]]) foi feito para web no browser e serve qualquer das três | Quando houver motivo para sair do browser |
| **Onde se guardam as preferências** (modo de layout) | Browser · backend | `/design-database` |
| **Persistência** | Nenhuma BD (tudo em memória + o que o Claude Code já grava em `~/.claude`) · ficheiro JSON · SQLite | `/design-database` (Fundação) |
| **Fonte do indicador de quota** | Ver [[../product/domain-brief]] → perguntas em aberto — nenhuma fonte está confirmada | Spike antes da feature |
| **Como expor fora de casa** | VPN mesh (Tailscale) · túnel com autenticação à frente (Cloudflare Tunnel + Access) · reverse proxy com TLS | Antes de sair de `127.0.0.1` — ver [[0004-exposicao-e-modelo-de-ameaca]] |
| **Onde corre em "produção"** | Portátil hoje → desktop de casa (SO por confirmar) | Quando se mudar |
| **Vida dos PTYs sem browser** | Continuam a correr quando o browser fecha (proposta) · morrem | Na feature de terminais |
| **Reconexão e scrollback** | Buffer no servidor por terminal (quanto?) e reenvio ao voltar a ligar | Na feature de terminais |
| **Limite de terminais simultâneos** | `MAX_TERMINALS` (proposta: 8) — a quota é partilhada | Na feature de terminais |
| **2FA no login** | TOTP · nada | Antes de expor na web |
| **Testes do frontend** | Sem Vitest (omissão da stack) · Vitest + Testing Library | No scaffold do frontend |
