# 🗺️ Backlog — estado das iniciativas

**Uma linha por frente de trabalho: em que pé está e o que a desbloqueia.** O [[../ToDo]] diz *o que*
fazer; este ficheiro diz *onde está cada frente*. Máximo ~20 linhas — se crescer, uma linha devia ser um plano.

**Quem escreve aqui**: `/implement-todo` Fase 7.

---

## Em curso

| Iniciativa | Estado (data) | Desbloqueia-se com |
|---|---|---|
| **Novo projeto guiado** ([[../../docs/features/novo-projeto-guiado]], [[../../docs/adr/0021-permissoes-das-sessoes-guiadas|ADR 0021]]) | ✅ 10/10 + seguimento (2026-10-26): permissões aprovadas dentro do destino novo e seletor Perguntar / Automático; 420 testes do backend, browser 14/14 | Contar as permissões na próxima criação real (eram 53; esperado: só `git init`/comandos fora da allowlist) — [[../verificacao-browser-pendente]]; depois esta linha sai |
| **Upwork** ([[../../docs/features/upwork]], [[../../docs/adr/0022-seccao-upwork|ADR 0022]]) | 🚧 10/11 passos (2026-10-26): ADRs, skill `/upwork-proposal` no Workflow, backend completo (455 testes) e **frontend completo** — página `/upwork`, drawers Perfil e Nova candidatura, detalhe Pacote · Conversa · Dados, conversa guiada partilhada com o Novo projeto; `scripts/verify/upwork.mjs` 34/34 com a skill simulada. Commits locais dos passos 7-10 por enviar (app); o do Workflow (`033d2dc`) também | Passo 11 **com o dono**: uma candidatura real com o `/upwork-proposal` a sério (a skill nunca correu invocada de verdade) — `/implement-todo` → "Implementar a partir de uma spec"; a spec §6 diz o que fazer |
| **Pré-visualização remota** ([[../../docs/features/pre-visualizacao]], [[../../docs/adr/0018-pre-visualizacao-por-tailscale-serve|ADR 0018]]) | ⏳ 7/8 passos (2026-10-23): spike, portas Windows+Linux, cliente do Tailscale, `PreviewService`, rotas, `/preview` no bot, UI (`Alt+L`, etiqueta, seletor de portas); 355 testes do backend, browser 20/20; `TAILSCALE_BIN` já no `.env` do dono | Passo 8 com o dono: Tailscale no PC remoto, um `npm run dev` real num terminal, abrir o link fora de casa e medir ([[../verificacao-browser-pendente]]); depois docs e fecho |
| **Atalhos editáveis** ([[../../docs/features/atalhos-editaveis]], [[../../docs/adr/0016-atalhos-editaveis-no-state|ADR 0016]]) | ✅ 7/7 passos (2026-10-20): `state.json` v2, `/api/keybindings`, secção nas Definições, ações novas; 259 testes do backend, browser 40/40 | Só o `AltGr+.` (o CDP não simula AltGr) no browser do dono ([[../verificacao-browser-pendente]]); depois esta linha sai |
| **Bot de Telegram com Remote Control** ([[../../docs/features/bot-telegram]], [[../../docs/adr/0017-bot-telegram-e-remote-control|ADR 0017]]) | ✅ 8/8 passos (2026-10-22): bot real `@workflow_app_bot` verificado no telemóvel do dono; 294 testes do backend, browser 11/11 + 3/3 | Restos da spec §7: `/parar` com a página aberta não verificado depois da correção; consentimento do RC no desktop Linux ao instalar; "Continuar a última" pode apanhar uma conversa aberta fora da app. Depois esta linha sai |
| **Passkeys no login** ([[../../docs/adr/0015-passkeys-webauthn|ADR 0015]]) | ✅ em `localhost` (2026-10-09): backend + frontend, 241 testes, browser 34/34 com autenticador virtual | Expor a app com HTTPS + domínio fixo (ideia "Antes de sair de `127.0.0.1`") → `WEBAUTHN_RP_ID` → teste no iPhone real ([[../verificacao-browser-pendente]]); depois esta linha sai |
| **Correr e parar a app** ([[../../docs/features/correr-a-app]], [[../../docs/adr/0030-correr-e-parar-a-app-de-um-projeto|ADR 0030]]) | 🚧 6/8 passos (2026-11-13): ADRs 0030 (app) e 0013 (Workflow); skill `/stop` na biblioteca (`prospective`); backend; frontend (cabeçalho comum + Correr/Parar, verificado no browser) | Levar o `/stop` aos projetos e a esta app pelo `/upgrade-project` (7); a verificação real num projeto (8), que também passa o `/stop` a `proven` |
| **node-pty beta contra o segfault do ConPTY** ([[../../docs/adr/0029-node-pty-beta-1-2|ADR 0029]], `proposto`) | ✅ corrigido (2026-11-12): beta.18 + guard do `pid` 0; suite 4/4 em forks, 22/24 em threads (resta um SIGABRT raro do `fs` do Node, origem por provar) | Sair a 1.2 estável → subir e ADR a `aceite`; dias de uso real sem o backend morrer. Depois esta linha sai |

## Por começar

| Iniciativa | Estado (data) | Desbloqueia-se com |
|---|---|---|

## Parado por decisão

| Iniciativa | Porquê | Reabre se |
|---|---|---|

---

Estados: ✅ feito · ⏳ em curso · ⏸️ bloqueado · 📋 por começar · ❓ por especificar.
Uma linha que chega a ✅ sem restos sai daqui — o registo está no [[../whatIveDone]].
