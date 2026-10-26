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
| Passkeys (WebAuthn) | `backend/src/auth/passkey.routes.ts` · `auth/passkeyStore.ts` (`DATA_DIR/passkeys.json`) · `auth/challengeStore.ts` · testes com `test/softAuthenticator.ts` · frontend: `services/passkeyService.ts`, `pages/login/LoginPage.tsx`, `components/settings/PasskeysSection.tsx` |
| Gestor de terminais (PTYs, scrollback) | `backend/src/terminals/terminalManager.ts` |
| Política de pastas (`ALLOWED_ROOTS`: `realpath`, junctions, prefixo, maiúsculas) | `backend/src/folders/cwdPolicy.ts` |
| Binário `claude`, ambiente do filho, kill da árvore | `backend/src/terminals/spawnClaude.ts` |
| Árvore de processos (Windows + Linux) | `backend/src/common/processTree.ts` |
| Pré-visualização (🚧 [[features/pre-visualizacao]], [[adr/0018-pre-visualizacao-por-tailscale-serve]]) | rotas `POST`/`DELETE /api/terminals/:id/preview` em `backend/src/preview/preview.routes.ts` · registo e ciclo de vida em `preview/previewService.ts` · portas de dev nos descendentes em `preview/listeningPorts.ts` · o único sítio que lança o `tailscale` em `preview/tailscale.ts` · montagem em `app.ts` (só com `TAILSCALE_BIN`) · frontend: ação `togglePreview` (`Alt+L`, catálogo em `backend/src/keybindings/catalog.ts`) tratada em `pages/TerminalsPage.tsx`, etiqueta `PreviewTag` em `components/terminals/TerminalPane.tsx`, `components/terminals/PreviewPortsModal.tsx`, `startPreview`/`stopPreview` em `hooks/useTerminals.ts` e `services/terminalService.ts` |
| Spike manual do PTY com o `claude` real | `backend/scripts/pty-spike.ts` |
| Verificação no browser (instância de teste, driver CDP, cenário de exemplo) | `scripts/verify/instance.mjs` · `scripts/verify/cdp.mjs` · `scripts/verify/smoke.mjs` — uso em [[commands]] |
| Protocolo do WebSocket | `backend/src/terminals/protocol.ts` ↔ `frontend/src/types/terminal.ts` |
| Rotas e providers | `frontend/src/main.tsx` |
| Navegação persistente, barra de estado | `frontend/src/layouts/AppLayout.tsx` |
| Sessão (`useAuth`), guarda de rota | `frontend/src/contexts/AuthContext.tsx` · `hooks/useAuth.ts` · `components/PrivateRoute.tsx` · `services/authService.ts` |
| Login | `frontend/src/pages/login/LoginPage.tsx` |
| Confirmação (`useConfirm`) | `frontend/src/contexts/ConfirmDialogContext.tsx` · `hooks/useConfirm.ts` |
| Atalhos de teclado (ADR 0016) | backend: `keybindings/catalog.ts` (o único catálogo: ações, predefinidos, teclas permitidas, avisos) · `keybindings/keybindingsService.ts` · `keybindings/keybindings.routes.ts` · frontend: `keyboard/shortcuts.ts` (evento → bind → ação, sinónimos, rótulos) · `contexts/KeybindingsContext.tsx` (no `AppLayout`) · `hooks/{useKeybindings,useShortcuts}.ts` · `components/settings/{ShortcutsSection,ShortcutCapture}.tsx` · `services/keybindingService.ts` |
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
| | `components/settings/SettingsDrawer.tsx` · `hooks/{useTerminals,useLayoutMode,useUsage}.ts` · `services/{terminal,session,folder,usage}Service.ts` · `types/{terminal,session,folder,usage}.ts` · `terminal/terminalSize.ts` |
| **Backend** | `backend/src/terminals/` — `terminals.routes.ts` · `terminals.gateway.ts` (WS) · `terminalsService.ts` (ciclo de vida) · `terminalManager.ts` (PTYs) · `claudeArgs.ts` · `terminal.schemas.ts` |
| | `backend/src/sessions/` (`.jsonl` do Claude Code) · `backend/src/folders/` (política de pastas, favoritas, browse) · `backend/src/usage/` (quota) |
| **Dados** | `DATA_DIR/state.json` (`terminals`, `closedTerminals`, `folders`) · `DATA_DIR/usage.json` · `~/.claude/projects/` (só leitura) |
| **Detalhe** | [[api]] → "Terminais", "Sessões gravadas e pastas", "Quota" · spec [[features/terminais]] |

## Biblioteca — ✅

| Camada | Ficheiros |
|---|---|
| **Entrada** | rota `/library` → `frontend/src/pages/LibraryPage.tsx` (tabs, pesquisa com `/`, chips de maturidade, filtro por camada/categoria) |
| **Frontend** | `components/library/` (`LibraryEntryDrawer`, `MaturityTag`, `libraryFormat.ts`; importações: `ImportDrawer` + `importFormSchema.ts`, `ImportPanel`, `ImportBanner`, `ImportReviewDrawer`) · `hooks/useLibrary.ts` · `hooks/useCurrentImport.ts` (polling só enquanto corre) · `services/libraryService.ts` · `services/importService.ts` · `types/library.ts` · `types/imports.ts` · o "Ver terminal" chega à `pages/TerminalsPage.tsx` por `location.state.focusTerminalId` |
| **Backend** | `backend/src/library/` — `library.routes.ts` (só `GET`) · `libraryService.ts` (lê o disco, nunca escreve) · `library.schemas.ts` (zod dos manifestos + `maturityOf`) |
| **Dados** | `WORKFLOW_PATH/library` — só leitura ([[adr/0005-biblioteca-lida-do-disco]]); o que entra vem do `/import` do Workflow ([[adr/0019-importar-pelas-skills-do-workflow]], linha "Importações") |
| **Detalhe** | [[api]] → "Biblioteca" |
| **Importações** (🚧 [[features/importar-para-a-biblioteca]], [[adr/0019-importar-pelas-skills-do-workflow]]) | `backend/src/imports/` — `imports.routes.ts` (multipart) · `importService.ts` (criar, estado derivado, revelar, cancelar) · `imports.schemas.ts` (o pedido e o contrato `request.json`/`result.json` v1) · `stagingFiles.ts` (ficheiros enviados → `DATA_DIR/imports/<id>/files/`) · `workflowGit.ts` (o `git` do Workflow) · `importFiles.ts` (o `--settings` das importações e o `import-hook.cjs`) · o terminal escondido em `terminals/terminalsService.ts` (`createImport`/`reveal`) e a linha de comando em `terminals/claudeArgs.ts` · a skill do outro lado: `WORKFLOW_PATH/docs/skills/skill-import.md` |

## Novo projeto e sessões guiadas — 🚧 (spec [[features/novo-projeto-guiado]], [[adr/0020-sessoes-guiadas]])

| Camada | Ficheiros |
|---|---|
| **Entrada** | rota `/new-project` → `frontend/src/pages/NewProjectPage.tsx` (descrição → sessão → resumo); **+ Novo projeto** em `components/terminals/ProjectTabs.tsx` |
| **Frontend** | `components/guided/` (genéricos: `GuidedFeed` com as mensagens e linhas, `QuestionCard` + `questionLabels.ts`, `PermissionCard`, `ReplyBox`) · `components/common/Markdown.tsx` (sem HTML) · `hooks/useGuidedSession.ts` (polling 1,5 s, pára com o separador escondido) · `services/{guided,creation}Service.ts` · `types/guided.ts` · `pages/dev/GuidedPreviewPage.tsx` (`/_guided`, só em dev) |
| **Backend** | `backend/src/guided/` — `guided.routes.ts` · `guidedService.ts` (pasta, estado derivado, respostas, paste, resume) · `guidedFiles.ts` (o `--settings` e o `guided-hook.cjs`) · `transcriptFeed.ts` (`.jsonl` → conversa) · `guided.schemas.ts` · `backend/src/creation/` (`POST /api/creations`, `current`, `open`) · o terminal em `terminals/terminalsService.ts` (`createGuided`/`paste`) e `terminals/paste.ts` · a linha de comando em `terminals/claudeArgs.ts` (`kind: 'guided'`) |
| **Dados** | `DATA_DIR/guided/<id>/`, `DATA_DIR/guided/by-session/` e `DATA_DIR/guided-control/` ([[database]]) · o `.jsonl` da sessão (só leitura) · do outro lado, `WORKFLOW_PATH/docs/skills/skill-create.md` → "Modo app" |
| **Scripts** | `backend/scripts/guided-spike.ts` (o mecanismo, com o `claude` real) · `guided-engine-check.ts` (o motor de produção, com o `claude` real) · `create-app-dry-run.ts` (o `/create` real até à proposta) |
| **Detalhe** | [[api]] → "Novo projeto", "Sessões guiadas" |

## Upwork — 🚧 (spec [[features/upwork]], [[adr/0022-seccao-upwork]])

| Camada | Ficheiros |
|---|---|
| **Backend** | `backend/src/upwork/` — `upwork.routes.ts` · `upworkService.ts` (perfil, registo, a sessão guiada `upwork`, pausar, arquivar) · `packageReader.ts` (o `package.json` da skill) · `upwork.schemas.ts` (o registo, os corpos, `ApplicationView`) · `upworkFiles.ts` (caminhos, modelo do perfil, `job.md`) · o propósito em `terminals/claudeArgs.ts` (`GUIDED_COMMANDS.upwork`) e a regra `WebFetch` no hook de `guided/guidedFiles.ts` |
| **Dados** | `DATA_DIR/upwork/` ([[database]]) · do outro lado, `WORKFLOW_PATH/docs/skills/skill-upwork-proposal.md` |
| **Frontend** | por fazer (spec passos 7-9) — só `errors/errorMessages.ts` (`UPWORK_*`) e `types/guided.ts` (`purpose`) |
| **Detalhe** | [[api]] → "Upwork" |

## Projetos — 🚧 (spec [[features/separadores-de-projetos]] em curso)

| Camada | Ficheiros |
|---|---|
| **Backend** | `backend/src/projects/` — `projects.routes.ts` · `projectsService.ts` (lê o disco, esconde `descartado` e o que sai de `ALLOWED_ROOTS`) · `projectIndexParser.ts` (tabela Markdown → linhas) · `project.schemas.ts` (`ProjectEntry`) |
| **Dados** | `WORKFLOW_PATH/projects/INDEX.md` — só leitura, mesma postura da Biblioteca ([[adr/0005-biblioteca-lida-do-disco]]) |
| **Detalhe** | [[api]] → "Projetos" |

## Bot de Telegram — ✅ (spec [[features/bot-telegram]], [[adr/0017-bot-telegram-e-remote-control]])

| Camada | Ficheiros |
|---|---|
| **Entrada** | long polling a partir de `backend/src/app.ts` (só com `config.telegram`; arranca no `onReady`, pára no `onClose`) — sem rota HTTP |
| **Backend** | `backend/src/telegram/` — `telegramBot.ts` (ciclo, autorização, comandos e botões) · `botActions.ts` (menus e ações sobre os serviços) · `botMessages.ts` (todos os textos) · `menuStore.ts` (chaves dos botões em memória) · `telegramApi.ts` (Bot API sobre `fetch`) |
| | Remote Control nos terminais: `terminals/claudeArgs.ts` (`--remote-control`) · `terminals/remoteName.ts` · `sessions/claudeTrust.ts` (confiança da pasta no `.claude.json`) · `TerminalsService.stop` |
| | Pré-visualização ([[adr/0018-pre-visualizacao-por-tailscale-serve]]): `/preview` → `BotActions.previewMenu` / `preview` / `previewOff`; os avisos sem pedido (link ligado pela app, desligado sozinho) saem do `PreviewNotifier` montado em `app.ts`, com `BotActions.previewStarted` / `previewStopped` — o único sítio onde o bot escreve sem lhe perguntarem |
| **Dados** | `remoteControl` em cada terminal do `state.json`; menus só em memória |

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
