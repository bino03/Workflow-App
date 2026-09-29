# 🗺️ Mapa do código — onde vive cada funcionalidade

Este ficheiro responde a **"onde está o código disto?"**. Não explica como funciona nem porquê — para
isso há os outros:

| Pergunta | Onde |
|---|---|
| **Onde está?** | este ficheiro |
| Que rotas e regras de acesso? | [[api]] |
| Que tabelas e colunas? | [[database]] |
| Como se faz uma alteração aqui? | [[skills/SKILLS-INDEX]] |
| Como se chama isto? | [[project-vocabulary]] |

> Mantém-se **grosso de propósito**: portas de entrada e ficheiros-chave, não listas exaustivas. Um mapa
> que tenta listar tudo fica errado à primeira semana. O hook avisa quando nasce uma porta de entrada nova.

---

## Transversal

| Coisa | Onde |
|---|---|
| Arranque, sinais, shutdown | `backend/src/server.ts` |
| Plugins, rotas, hooks (testável com `inject`) | `backend/src/app.ts` |
| Configuração do ambiente | `backend/src/config.ts` |
| Erros (`ErrorCode`, handler) | `backend/src/common/errors.ts` → espelho em `frontend/src/errors/errorMessages.ts` |
| Validação de pedidos (zod → `COMMON_001`) | `backend/src/common/validation.ts` |
| `GET /api/health` | `backend/src/common/health.routes.ts` |
| Guarda de auth (REST + WS, `Origin`) | `backend/src/common/authGuard.ts` |
| Servir o `frontend/dist` (fallback da SPA, cache, origem própria) | `backend/src/common/spa.ts` |
| Estado persistido (`state.json`: schema, limites, fila de escrita) | `backend/src/state/stateStore.ts` · schema em `state/state.schema.ts` · `tmp`+`rename` com retry em `state/atomicWrite.ts` |
| Login / logout / me | `backend/src/auth/auth.routes.ts` · sessões em `auth/sessionStore.ts` · `scripts/hash-password.ts` |
| Gestor de terminais (PTYs, scrollback) | `backend/src/terminals/terminalManager.ts` |
| Política de pastas (`ALLOWED_ROOTS`: `realpath`, junctions, prefixo, maiúsculas) | `backend/src/folders/cwdPolicy.ts` |
| Binário `claude`, ambiente do filho, kill da árvore | `backend/src/terminals/spawnClaude.ts` |
| Spike manual do PTY com o `claude` real | `backend/scripts/pty-spike.ts` |
| Protocolo do WebSocket | `backend/src/terminals/protocol.ts` ↔ `frontend/src/types/terminal.ts` |
| Rotas e providers | `frontend/src/main.tsx` |
| Navegação persistente, barra de estado | `frontend/src/layouts/AppLayout.tsx` |
| Sessão (`useAuth`), guarda de rota | `frontend/src/contexts/AuthContext.tsx` · `hooks/useAuth.ts` · `components/PrivateRoute.tsx` · `services/authService.ts` |
| Login | `frontend/src/pages/login/LoginPage.tsx` |
| Confirmação (`useConfirm`) | `frontend/src/contexts/ConfirmDialogContext.tsx` · `hooks/useConfirm.ts` |
| Instância HTTP, endereço do backend | `frontend/src/api.ts` · `config/apiBase.ts` |
| Erros e toasts | `frontend/src/errors/` · `services/general/notificationService.tsx` |
| Tokens | `frontend/src/index.css` + `theme.ts` · `terminal/xtermTheme.ts` · pré-visualização em `/_tokens` (só dev) |
| Componente de terminal (xterm.js) | `frontend/src/components/terminals/TerminalView.tsx` |

---

## Terminais — ✅

| Camada | Ficheiros |
|---|---|
| **Entrada** | rota `/terminals` → `frontend/src/pages/TerminalsPage.tsx` (foco dividido / grelha, atalhos, reabrir) |
| **Frontend** | `components/terminals/` — `TerminalView.tsx` (xterm.js + WS) · `TerminalPane.tsx` (cabeçalho, banner; variante `tile`) · `TerminalSidebar.tsx` (por projetos) · `TerminalGrid.tsx` · `QuotaMeter.tsx` · `projects.ts` · `new/` (drawer Novo terminal) |
| | `components/settings/SettingsDrawer.tsx` · `hooks/{useTerminals,useTerminalShortcuts,useLayoutMode,useUsage}.ts` · `services/{terminal,session,folder,usage}Service.ts` · `types/{terminal,session,folder,usage}.ts` · `terminal/terminalSize.ts` |
| **Backend** | `backend/src/terminals/` — `terminals.routes.ts` · `terminals.gateway.ts` (WS) · `terminalsService.ts` (ciclo de vida) · `terminalManager.ts` (PTYs) · `claudeArgs.ts` · `terminal.schemas.ts` |
| | `backend/src/sessions/` (`.jsonl` do Claude Code) · `backend/src/folders/` (política de pastas, favoritas, browse) · `backend/src/usage/` (quota) |
| **Dados** | `DATA_DIR/state.json` (`terminals`, `closedTerminals`, `folders`) · `DATA_DIR/usage.json` · `~/.claude/projects/` (só leitura) |
| **Detalhe** | [[api]] → "Terminais", "Sessões gravadas e pastas", "Quota" · spec [[features/terminais]] |

## Biblioteca — ✅

| Camada | Ficheiros |
|---|---|
| **Entrada** | rota `/library` → `frontend/src/pages/LibraryPage.tsx` (tabs, pesquisa com `/`, chips de maturidade, filtro por camada/categoria) |
| **Frontend** | `components/library/` (`LibraryEntryDrawer`, `MaturityTag`, `libraryFormat.ts`) · `hooks/useLibrary.ts` · `services/libraryService.ts` · `types/library.ts` |
| **Backend** | `backend/src/library/` — `library.routes.ts` · `libraryService.ts` (lê o disco) · `library.schemas.ts` (zod dos manifestos + `maturityOf`) |
| **Dados** | `WORKFLOW_PATH/library` — só leitura ([[adr/0005-biblioteca-lida-do-disco]]) |
| **Detalhe** | [[api]] → "Biblioteca" |

## Projetos — 🚧 (spec [[features/separadores-de-projetos]] em curso)

| Camada | Ficheiros |
|---|---|
| **Backend** | `backend/src/projects/` — `projects.routes.ts` · `projectsService.ts` (lê o disco, esconde `descartado` e o que sai de `ALLOWED_ROOTS`) · `projectIndexParser.ts` (tabela Markdown → linhas) · `project.schemas.ts` (`ProjectEntry`) |
| **Dados** | `WORKFLOW_PATH/projects/INDEX.md` — só leitura, mesma postura da Biblioteca ([[adr/0005-biblioteca-lida-do-disco]]) |
| **Detalhe** | [[api]] → "Projetos" |

---

_(Uma secção por domínio, à medida que nasce:)_

## <Domínio>

| Camada | Ficheiros |
|---|---|
| **Entrada** | rota `/…` → `pages/…` |
| **Frontend** | `components/<domain>/` · `services/<domain>Service.ts` · `types/<domain>.ts` |
| **Backend** | `<domain>/controller/…` · `service/…` · `repository/…` |
| **Base de dados** | tabela `…` — `V…` |
| **Detalhe** | [[api]] → "…" |

---

## Onde procurar, por sintoma

| Sintoma | Primeiro sítio a olhar |
|---|---|
| _(preencher com os casos reais à medida que acontecem)_ | |
