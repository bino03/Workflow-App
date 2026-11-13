# 🏁 What I've Done

**Work log de features concluídas.**

Cada entrada é acrescentada pelo `/implement-todo` (Fase 6) quando uma tarefa do [[ToDo]] é implementada
**e testada** — nunca sobrescreve, só acrescenta.

```markdown
## AAAA-MM-DD — <título curto>

- <resumo em 1-2 linhas do que mudou>
- Files: <ficheiros tocados>
- Item original do ToDo: "<texto verbatim do bullet>"
```

Guardar o verbatim importa: vários bullets são vagos, e o log preserva o que foi realmente decidido.

---

<!-- Entradas novas abaixo, mais recentes no fim. -->

## 2026-09-27 — Projeto criado pelo Workflow

- Vault gerado com `/create`: `node-fastify` (📋 criado na hora — Node + TypeScript + Fastify + node-pty) + `react-vite-antd` (✅) + xterm.js.
- Files: vault inteiro (ver [[../docs/provenance|provenance]])
- Item original do ToDo: — (criação)

## 2026-09-27 — Identidade visual escolhida: Violeta + Geist (`/choose-design`, via Claude Design)

- Prompt gerado a partir do vault ([[design-briefs/2026-09-27-claude-design-prompt]]) → o Claude Design devolveu 3 paletas (Gelo, Violeta, Sinal), 3 tipografias (Plex, Geist, Consola) e 3 layouts de Terminais (foco, dividido, grelha), mais Novo terminal, Fechar, Biblioteca, detalhe e Login. O dono escolheu **Violeta** (pelo acento — longe das cores de estado) e **Geist**, contra as recomendações do Claude Design (Gelo, Consola). Pediu **dois modos de layout** escolhidos nas Definições: **foco dividido** por omissão, **grelha** em alternativa — daí o drawer de Definições e a pergunta nova "onde persiste a preferência" (→ `/design-database`).
- Contraste reverificado com o próprio gerador (`wfa-tokens.js`): todos os pares ≥ 4.5:1. Armadilha registada: a escala do acento é de tema escuro — `accent-700` como texto dá 1.6:1, por isso o kicker da referência de tabelas passou a `--wfa-color-accent`.
- Sem tratamento responsivo (≥ 1280 px); atalhos da app em `Alt+…` (AltGr no teclado PT exclui `Ctrl+Alt`). Marcador `design:pending` e avisos ⛔ removidos. Sem frontend ainda, por isso nenhum ecrã a rever.
- Files: `docs/design/handoff-2026-09-27/` (README, `wfa-tokens.js`, `Terminais.dc.html`, `Biblioteca.dc.html` — o canvas `Workflow App.dc.html` e o runtime `support.js` ficaram só no Claude Design), `docs/adr/0008-identidade-visual.md`, `docs/adr/README.md`, `docs/skills/references/design/{tokens-and-colors,tables-and-lists,buttons-and-icons,cards,drawers-and-modals,app-shell-and-auth}.md`, `docs/product/{design-brief,use-cases}.md`, `CLAUDE.md`, `frontend/CLAUDE.md`, `00-INDEX.md`, `docs/skills/{SKILLS-INDEX,SKILLS-QUICK-REFERENCE}.md`, `docs/skills/references/code-best-practices.md`, `notes/ToDo.md`
- Item original do ToDo: "⛔ **Escolher o design — `/choose-design`** (biblioteca do Workflow · importar da net · Claude Design). Nenhum ecrã antes disto. Antes, fechar a **forma da UI** (web/PWA/desktop) e os ecrãs — estão em standby"

## 2026-09-28 — Scaffold do backend (`backend/`)

- `package.json` ESM com os scripts de [[../docs/commands|commands]], Node 24 fixado (`.nvmrc` + `engines`), `node-pty` **1.1.0 exata**, zod 4 (não 3 — docs corrigidos), TypeScript 6, ESLint 10 flat, Vitest 5; `tsconfig.json` único (src+scripts+test) para o typecheck e `tsconfig.build.json` só com `src/` para o build.
- `node-pty` confirmado no Windows: instala pelo prebuild `win32-x64`, **sem Build Tools nem Python** (não há nenhum na máquina). Armadilha nova descoberta: depois do `onExit`, o ConPTY deixa handles vivos e o Node não sai sozinho → `process.exit()` explícito em scripts e no shutdown.
- Testado: `npm run typecheck`, `lint`, `build` limpos; spawn de `cmd.exe /c echo` num PTY com output e `exit 0`.
- Files: `backend/{package.json,package-lock.json,.nvmrc,tsconfig.json,tsconfig.build.json,eslint.config.js,vitest.config.ts,src/server.ts}`, `docs/backend-conventions.md`, `docs/commands.md`
- Item original do ToDo: "Scaffold em `backend/`: Node LTS + TypeScript strict (ESM) — `fastify`, `@fastify/websocket`, `@fastify/cookie`, `@fastify/cors`, `@fastify/rate-limit`, `node-pty`, `zod`, `argon2`; dev: `tsx`, `typescript`, `vitest`, `eslint`. Estrutura de [[../docs/architecture|architecture]] → Backend. **Confirmar que o `node-pty` instala no Windows** (binário pré-compilado ou VS Build Tools) e registar o que foi preciso em `docs/backend-conventions.md` → Armadilhas"

## 2026-09-28 — Base comum do backend (config, erros, health, shutdown)

- `config.ts` (zod 4, falha no arranque com `Invalid environment:` + nomes/razões, nunca valores; roots e `WORKFLOW_PATH` têm de existir, guarda-se o `realpath`), `ErrorCode` `COMMON_001-003`/`AUTH_001-004` + `AppError` + handler único que também apanha os erros do Fastify e o 404, `parseWith` (zod → 400 com `fieldErrors`), `GET /api/health`, CORS com credenciais só das origens configuradas, `app.ts` separado do `server.ts` para testar com `inject`. Shutdown: `onClose` → `TerminalManager.killAll()` (ainda stub) + `process.exit` explícito (handles do ConPTY) com timeout de 5 s.
- Variáveis novas: `LOG_LEVEL`, `SESSION_IDLE_HOURS` (12), `SESSION_MAX_DAYS` (7) — as duas últimas já para o auth.
- **Smart App Control** (ligado nesta máquina) bloqueou o binding nativo do `rolldown` → Vitest 5 não arranca; ficou Vitest 4 + `vite@7`. A mensagem do npm ("optional dependencies bug") é enganadora.
- Testado: 14 testes Vitest; servidor real com curl — health 200, rota inexistente 404 `COMMON_003`, JSON partido 400 `COMMON_001`, config em falta → sai com 1 e a lista; escuta só em `127.0.0.1`. **Não provado**: o shutdown por Ctrl+C real (no Windows, `kill` do bash é `TerminateProcess`) — coberto pelo teste do `onClose`, a confirmar à mão no `run`.
- Files: `backend/src/{app.ts,server.ts,config.ts}`, `backend/src/common/{errors.ts,validation.ts,health.routes.ts}`, `backend/src/terminals/terminalManager.ts`, `backend/test/{helpers.ts,config.test.ts,app.test.ts}`, `backend/package.json`, `backend/.env.example`, `docs/{environment,api,architecture,code-map,commands,backend-conventions}.md`
- Item original do ToDo: "Base comum: `config.ts` (zod, falha no arranque), `ErrorCode` + `AppError` + error handler único ([[error-model]]), `GET /api/health`, bind em `127.0.0.1`, graceful shutdown que mata todos os PTYs"

## 2026-09-28 — Spike do PTY: `claude` real num PTY no Windows

- No código real: `terminals/spawnClaude.ts` (`resolveClaudeBin` pelo PATH+PATHEXT, recusa `.cmd`; `childEnv` com denylist; `killProcessTree` via `taskkill /T /F`), `terminals/terminalManager.ts` (create/attach/write/resize/kill/killAll, scrollback em pedaços inteiros, `MAX_TERMINALS`), `terminals/protocol.ts` (binário = bytes do terminal, texto = JSON de controlo; `ready`/`exit`/`resize`). O `server.ts` resolve o `claude` no arranque e só avisa se faltar.
- Spike manual `scripts/pty-spike.ts` com o `claude` 2.1.283 real, ecrãs lidos num `@xterm/headless`: **7/7** — `claude.exe` do instalador nativo; com uma `ANTHROPIC_API_KEY` falsa e as 8 `CLAUDE_CODE_*` + `CLAUDE_PID` + `CLAUDECODE` desta sessão no backend, o filho não vê nenhuma; `/status` → "Login method: Claude Pro account"; resize redesenha; dois Ctrl+C → sai com 0; kill sem sobreviventes. Não gasta quota (o `/status` é local).
- Decisão alargada durante a implementação: a denylist também retira as **variáveis da própria app** (o `loadEnvFile` punha `SESSION_SECRET`, `APP_PASSWORD_HASH` e `PORT=7400` no ambiente do filho — um dev server lançado pelo Claude apanharia a porta do backend). Exceção: `CLAUDE_CONFIG_DIR`.
- Armadilha nova: o `kill()` do node-pty no Windows só mata o que está ligado à consola e o helper rebenta (`AttachConsole failed`) depois de um `taskkill` → `taskkill` primeiro, `kill()` só como fallback. Sem fuga de `OpenConsole.exe`.
- Testado: 23 testes Vitest (9 novos: denylist, resolução do binário, manager com um `node -e` falso — eco, resize, exit code, **kill leva o neto**, limite); spike real 7/7; typecheck/lint/build limpos.
- Files: `backend/src/terminals/{spawnClaude,terminalManager,protocol}.ts`, `backend/src/{server,app}.ts`, `backend/scripts/pty-spike.ts`, `backend/test/{spawnClaude,terminalManager,app}.test.ts`, `backend/package.json` (`@xterm/headless` dev), `docs/{api,backend-conventions,environment,architecture,code-map,commands}.md`
- Item original do ToDo: "⚗️ **Spike do PTY** (antes de qualquer feature de terminais): lançar `claude` num PTY a partir do Node no Windows e confirmar — resolução do binário (`claude.exe` vs `claude.cmd` → `CLAUDE_BIN`), ambiente **sem** `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN`/`CLAUDECODE`, que `/status` mostra o **login da subscrição**, resize, Ctrl+C, que matar o PTY mata a árvore de processos. Resultado: protocolo do WebSocket fixado em `docs/api.md` + armadilhas confirmadas em `docs/backend-conventions.md` (tirar o 🚧 do que ficar provado)"

## 2026-09-28 — Auth de um utilizador (ADR 0003)

- `POST /api/auth/login|logout`, `GET /api/auth/me`; sessões num `Map` (`auth/sessionStore.ts`, id de 32 bytes, 12 h de inatividade + 7 dias absoluto, varrimento por minuto, callbacks `onEnd` para o gateway fechar os WebSockets); cookie `session` assinado, `HttpOnly`, `SameSite=Strict`, `Max-Age` = limite absoluto; rate limit 5/min por IP só no login → `429 AUTH_004`; `npm run hash-password` (duas vezes sem eco, mín. 12, ou por pipe).
- **Guarda global, protegido por omissão** (`common/authGuard.ts`, `onRequest`): só é pública a rota que diz `config: { public: true }` — uma rota esquecida nasce fechada; sem sessão, até uma rota inexistente dá 401 (não revela rotas). No upgrade do WebSocket verifica também o `Origin` (sem ou alheio → `403 AUTH_003`).
- Testado: 15 testes novos (38 no total) — cookie e atributos, password errada, corpo vazio, cookie adulterado, logout invalida o cookie antigo, novo login substitui a sessão, expiração 12 h / 7 dias com relógio falso, rate limit, e os testes de segurança do ADR 0004 para o WS (sem cookie 401, `Origin` alheio 403, sem `Origin` 403, válido liga). Servidor real com curl + cliente `ws`: os mesmos resultados, e `Set-Cookie` com os atributos certos.
- Files: `backend/src/auth/{auth.routes,authService,auth.schemas,sessionStore}.ts`, `backend/src/common/{authGuard,health.routes}.ts`, `backend/src/app.ts`, `backend/scripts/hash-password.ts`, `backend/test/{auth,app}.test.ts`, `docs/{api,security,commands,code-map}.md`, `notes/roadmap/pre-deploy-security.md`
- Item original do ToDo: "Auth de um utilizador ([[../docs/adr/0003-auth-utilizador-unico|ADR 0003]]): `npm run hash-password`, `POST /api/auth/login|logout`, `GET /api/auth/me`, sessão em memória com cookie HttpOnly, rate limit no login, guarda única reutilizada no upgrade do WebSocket (cookie **e** `Origin`)"

## 2026-09-28 — `.env` do backend + arranque confirmado com a skill `run`

- `backend/.env` criado a partir do `.env.example`: `SESSION_SECRET` aleatório (64 bytes, nunca mostrado), `CLAUDE_BIN` com o caminho completo do `claude.exe`, pastas do exemplo confirmadas a existir; o hash veio do dono (`npm run hash-password` no terminal dele — a password nunca passou pela conversa). Confirmado que o `process.loadEnvFile` não interpreta os `$` do hash argon2.
- `/run` (só backend): portas livres → `npm run dev` → `Server listening at http://127.0.0.1:7400`, sem aviso de `CLAUDE_BIN` → `GET /api/health` 200; login com password errada → 401 `AUTH_001` (o hash lê-se bem). Aviso de "não verificados" retirado da skill `run` para o backend.
- Files: `backend/.env` (não versionado), `docs/skills/process/skill-run.md`
- Item original do ToDo: "`.env` a partir do `.env.example`; arranque confirmado com a skill `run` (`/api/health` 200)"

## 2026-09-28 — Modelo de dados: sem BD, um `state.json` (`/design-database`)

- O dono quer que sobrevivam a um reinício: os terminais abertos (para reabrir), as etiquetas, as pastas recentes/favoritas, e um **histórico de terminais fechados com quando e um resumo curto**. Layout no `localStorage`; scrollback só em memória; quota calculada. Motor: **ficheiro JSON** (comparado com SQLite `node:sqlite` a pedido — ganha o JSON com o histórico limitado a 200). Coleções `terminals`, `closedTerminals`, `folders`; 10 recentes + favoritas.
- Descoberto na investigação: o `claude` aceita `--session-id <uuid>` (o backend impõe o uuid e reabre com `--resume`); cada `.jsonl` do Claude Code já traz um `ai-title`; o Claude Code apaga as transcrições ao fim de 30 dias → o resumo copia-se **ao fechar**.
- O dono pediu o resumo feito pelo Claude; a proposta de escrever um prompt no PTY ao fechar foi **recusada por ele** (suja a conversa gravada, interfere com tarefas/permissões a meio, fecho lento e frágil) → no MVP `summary` vem do `.jsonl` (`ai-title` / última mensagem cortada); botão "Resumir" explícito fica em ideias. Também pediu **fila de escrita + retry no `rename`** (`EPERM` no Windows).
- Files: `docs/database.md` (reescrito), `docs/adr/0009-estado-em-ficheiro-json.md` (novo), `docs/adr/README.md`, `docs/product/domain-brief.md`, `docs/skills/references/project-vocabulary.md`, `notes/ToDo.md` (secção "Modelo de dados", 3 tarefas), `notes/ideas.md`
- Item original do ToDo: "⛔ **Desenhar o modelo de dados — `/design-database`** (parte de [[../docs/product/domain-brief|domain-brief]]). Nenhuma persistência antes disto — e a conclusão pode ser "sem base de dados""

## 2026-09-28 — Scaffold do frontend (Vite 7 + React 19 + antd 6 + Tailwind 4)

- `frontend/` escrito à mão (o `create-vite` atual já traz o Vite 8/rolldown, que o Smart App Control bloqueia): `@vitejs/plugin-react@5` (o 6 exige Vite 8), **TypeScript 6** (o 7 é binário nativo novo), **antd 6** em vez do 5 (React 19 sem patch — decisão do dono). Alias `@`, 7401 + `strictPort`, proxy `/api` com `ws: true` para `127.0.0.1:7400` (no Node 24 `localhost` pode ser `::1`).
- **`VITE_API_URL` passou a vazia por omissão** (decisão do dono): dev via proxy, produção mesma origem; a variável só para apontar a outro backend. `127.0.0.1:7401` juntou-se ao `CORS_ALLOWED_ORIGINS` (origem diferente de `localhost`).
- Testado: `npx tsc -b --listFiles` analisa `main.tsx`/`vite-env.d.ts`/`vite.config.ts`; lint limpo; `npm run build` ok (os binários do Tailwind 4 correram sem bloqueio); `vite` pronto na 7401, `GET /` 200 e `GET /api/health` via proxy 200. Proxy do WebSocket por provar — ainda não há rota WS.
- Files: `frontend/{package.json,package-lock.json,tsconfig*.json,vite.config.ts,eslint.config.js,index.html,.env.example,src/main.tsx,src/index.css,src/vite-env.d.ts}`, `frontend/.env` (não versionado), `backend/.env.example`, `backend/.env`, `docs/environment.md`, `docs/commands.md`, `docs/frontend-conventions.md`, `docs/skills/frontend/skill-frontend-design-system.md`
- Item original do ToDo: "Scaffold em `frontend/` (Vite + React + TS strict; antd, @ant-design/icons, tailwindcss 4, react-router, react-hook-form, zod, @hookform/resolvers, axios, dayjs, **@xterm/xterm, @xterm/addon-fit**) com alias `@` → `src`, `server.port: 7401` + `strictPort`, proxy de `/api` com `ws: true`; confirmar que `npx tsc -b` analisa ficheiros"

## 2026-09-28 — Tokens Violeta + Geist no frontend

- `index.css` com todos os `--wfa-*` do `tokens-and-colors.md` (cores, escalas, estados, tipografia, espaço, raios, sombras, movimento, `--wfa-term-*`/`--wfa-ansi-*`), utilitárias (`.kicker`, `.text-display`, `.card*`, `.tag*` com a forma dos estados e da maturidade tirada dos protótipos, `.state-icon.is-*`, `.kbd`, `.elev-*`), pele da `.ant-table`, `prefers-reduced-motion`. `theme.ts` (espelho §10), `terminal/xtermTheme.ts` (§8 + `xtermFont`), Geist no `index.html`.
- Decidido na implementação: **as paletas por omissão do Tailwind são apagadas** e só os tokens existem como classes (`bg-surface-1`…) — o "nunca um hex" passa a ser imposto pelo compilador. Camadas `theme, base, antd, components, utilities` + `<StyleProvider layer>` (`@ant-design/cssinjs` como dependência direta) para o preflight não apagar o antd.
- Testado: `tsc -b`, lint, build; CSS gerado com as 5 camadas pela ordem certa e sem paletas do Tailwind. **Não verificado no browser** (extensão do Chrome sem responder) — incluindo o efeito do `colorTextLightSolid` escuro; registado em `notes/verificacao-browser-pendente.md`, com uma página `/_tokens` (só em dev) para essa passagem.
- Files: `frontend/src/{index.css,theme.ts,terminal/xtermTheme.ts,main.tsx,TokenPreview.tsx}`, `frontend/index.html`, `frontend/package.json`, `docs/skills/references/design/tokens-and-colors.md`, `docs/frontend-conventions.md`, `notes/verificacao-browser-pendente.md`
- Item original do ToDo: "Tokens Violeta + Geist ([[../docs/skills/references/design/tokens-and-colors|tokens-and-colors]], [[../docs/adr/0008-identidade-visual|ADR 0008]]): `index.css` com as `--wfa-*` + classes utilitárias (`.kicker`, `.tag-*`, `.state-icon`, `.kbd`, pele da `.ant-table`) + `prefers-reduced-motion`; `theme.ts` (`darkAlgorithm`, espelho §10 — verificar o efeito de `colorTextLightSolid` escuro); `terminal/xtermTheme.ts` (§8); import das fontes Geist/Geist Mono no `index.html`"

## 2026-09-28 — Infraestrutura do frontend: `api.ts`, `errors/`, `notificationService`

- `config/apiBase.ts` é o único sítio com o endereço do backend: `API_BASE_URL` e `apiWebSocketUrl(path)`, relativos à página com `VITE_API_URL` vazia. `api.ts`: instância única, `withCredentials`, `FormData` sem `Content-Type`, **redirect para `/login` por `AUTH_002` e não por 401** (o `AUTH_001` também é 401), handler de sessão expirada registável pelo `AuthContext`, rede de segurança que adia um tick e só notifica erros sem dono (rede sem resposta notifica logo). Flags `skipErrorNotification`/`skipAuthRedirect`.
- `errors/`: espelho 1:1 dos 7 códigos + `DEFAULT` + `NETWORK_ERROR_MESSAGE` (fora do mapa, porque não é código do backend); `ErrorHandler.handle/getMessage`, marca `Symbol.for('workflow-app.errorHandled')`. `notificationService` sobre a instância do `<App>` do antd via `NotificationBridge` (o estático do antd 6 não herda o tema).
- Deixado de fora: interceptor de erro em `Blob` (não há downloads).
- Testado: `tsc -b`, lint; contrato confirmado pelo proxy do Vite (`AUTH_001` 401, `AUTH_002` 401, `COMMON_001` 400 com `fieldErrors`). **Não verificado no browser** → `notes/verificacao-browser-pendente.md`.
- Files: `frontend/src/{api.ts,config/apiBase.ts,errors/*,services/general/notificationService.tsx,services/general/NotificationBridge.tsx,main.tsx}`, `docs/api.md`, `docs/frontend-conventions.md`
- Item original do ToDo: "Infraestrutura: `api.ts` (instância única, `withCredentials`, 401 → `/login` sem refresh; endereço base da API **e** do WebSocket vindo de config — `VITE_API_URL`, relativo por omissão — nunca fixo no código, para servir também uma futura app desktop), `errors/` (`ErrorHandler`, `errorMessages.ts` espelho do backend), `notificationService`"

## 2026-09-28 — App shell: sessão, confirmação, layout, login

- `AuthContext`/`useAuth` (`checking|authenticated|anonymous`; `/auth/me` no arranque com cache em `sessionStorage` só para não piscar; regista o handler de `AUTH_002` no `api.ts`), `ConfirmDialogContext`/`useConfirm` (440 px, `danger` por omissão, `onConfirm` assíncrono com loading), `PrivateRoute` (spinner / `/login` com `state.from`), `AppLayout` (header 48 com wordmark + nav com sublinhado `accent`, avatar com ícone, menu só com "Terminar sessão"; barra 26 com estado do backend via `/api/health` e versão), `LoginPage` (RHF + Zod, **todos** os erros inline), `/terminals` e `/library` vazias, `/_tokens` só em dev.
- Decisões do dono: omitir quota/atalhos/iniciais enquanto não existem; páginas vazias para a nav funcionar. Sem "Definições" no menu até à tarefa própria.
- **Encontrado na verificação**: o `darkAlgorithm` do antd 6 **reescreve as cores de marca** (`#A88FFF`→`#927DDC`, `#FF958D`→`#DC827B`) → algoritmo `pinBrandColors` depois dele; o `colorTextLightSolid` escuro deixava o **Tooltip ilegível** (texto escuro sobre azul derivado) → override por componente + `colorBgSpotlight` = `surface-3`. Título do Modal 18/24.
- Testado: `tsc -b`, lint, build (a `/_tokens` fica fora do bundle). Extensão do Chrome sem responder → verificação em **Chrome headless via CDP** (script no scratchpad): redirect sem sessão, erro Zod, `AUTH_001` inline sem toast, backend inacessível (pedidos falhados no browser) → um só toast, shell com `/auth/me` simulado (medidas, nav, confirmação, logout). **Por verificar**: login com a password real (só o dono) → `notes/verificacao-browser-pendente.md`.
- Files: `frontend/src/{main.tsx,theme.ts,vite-env.d.ts,contexts/*,hooks/*,components/PrivateRoute.tsx,components/common/{Wordmark,PagePlaceholder}.tsx,layouts/AppLayout.tsx,pages/**,services/{authService,healthService}.ts}`, `frontend/vite.config.ts`, `docs/skills/references/design/{app-shell-and-auth,tokens-and-colors}.md`, `docs/code-map.md`
- Item original do ToDo: "App shell: `AuthContext` + `useAuth`, `ConfirmDialogContext` + `useConfirm`, `PrivateRoute`, `AppLayout` (header de 48 px + barra de estado de 26 px, [[../docs/skills/references/design/app-shell-and-auth|app-shell-and-auth]]), página de login (só password — protótipo 1n)"

## 2026-09-28 — Componentes comuns: `ListActions`, `SectionCard`, `FieldError`

- `ListActions` (+ `Primary`/`Secondary`/`Danger`, `stopPropagation` no contentor, `minWidth` 110, `Danger` em `accent` .75 como diz o `tables-and-lists`), `SectionCard` (`.card` + ícone `accent` + kicker/título + `extra`), `FieldError` (erro do Zod por `name`+`errors` **ou** `message` solto; `✕` + `error`, altura reservada). O login passou a usar o `FieldError`. Os três ficam montados na `/_tokens`.
- **Armadilha encontrada**: `{...register()}` num `<Input>` do antd não liga (o `ref` é um `InputRef`) — a validação vê sempre `''`. Documentado: campos do antd sempre por `Controller`.
- Testado em Chrome headless: clique numa ação não dispara o clique da linha, clique na linha sim; larguras 110 e cores; `SectionCard` sem sombra, ícone `accent`; `FieldError` aparece ao submeter vazio e some depois de escrever; login continua a mostrar o erro.
- Files: `frontend/src/components/common/{ListActions,SectionCard,FieldError}.tsx`, `frontend/src/pages/login/LoginPage.tsx`, `frontend/src/pages/dev/TokenPreviewPage.tsx`, `docs/skills/references/design/{forms-and-validation,tables-and-lists,cards}.md`, `docs/frontend-conventions.md`
- Item original do ToDo: "Componentes comuns: `ListActions`, `SectionCard`, `FieldError`"

## 2026-09-28 — `.env` do frontend + arranque confirmado com a skill `run`

- `frontend/.env` criado na tarefa do scaffold a partir do `.env.example` (`VITE_API_URL` vazia). `/run`: backend já estava a correr na 7400 (não foi tocado); frontend com `npm run dev` → `VITE v7.3.6 ready in 367 ms` → `/api/health` 200 direto, `localhost:7401` 200, `/api/health` pelo proxy 200. **Proxy do WebSocket provado**: upgrade para `/api/...` com `Origin: http://localhost:7401` chega ao guard com o `Origin` intacto (→ `AUTH_002` sem cookie); `Origin` alheio → `AUTH_003`.
- A skill `run` passa a dar o frontend como confirmado e ganha o health check pelo proxy; nota de que mudar o `CORS_ALLOWED_ORIGINS` só vale depois de reiniciar o backend (o backend a correr ainda não tem o `127.0.0.1:7401`).
- Files: `frontend/.env` (não versionado), `docs/skills/process/skill-run.md`, `docs/commands.md`
- Item original do ToDo: "`.env` a partir do `.env.example`; arranque confirmado com a skill `run`"

## 2026-09-28 — O backend serve a SPA (ADR 0010)

- `@fastify/static` 10 (JS puro) em `common/spa.ts`: serve `FRONTEND_DIST` (omissão `frontend/dist`, absoluto) **sempre que tem `index.html`** (decisão do dono), `wildcard: true` para um build novo ser servido sem reiniciar; fallback para `index.html` só em `GET`/`HEAD` fora de `/api` sem extensão; asset em falta e outros métodos → `404 COMMON_003`; `/assets/*` imutável, `index.html` `no-cache`.
- Guarda: fora de `/api` é público **só para HTTP normal** — um WebSocket exige sessão em qualquer caminho (encontrado ao ler os testes: a isenção por caminho deixaria um WS fora de `/api` sem sessão). Quando serve a SPA, `localhost`/`127.0.0.1` na `PORT` entram nas origens do WS (decisão do dono: juntar a própria origem, nunca comparar com o `Host`).
- `testEnv` aponta `FRONTEND_DIST` para uma pasta inexistente — os testes deixam de depender de haver build no disco.
- Testado: 59/59 Vitest (21 novos em `spa.test.ts`: fallback, cache, 404s, `/api` continua 401, path traversal ×4, origem própria aceite / alheia recusada / sem sessão recusada, sem build → 404, WS fora de `/api` precisa de sessão); lint limpo; `tsc` com 1 erro **pré-existente** em `test/auth.test.ts:40` (inalterado). Backend real (o `tsx watch` do dono reiniciou sozinho): curl a `/`, `/terminals`, assets, `/api/nope`, WS com origem própria/alheia; Chrome headless na 7400: link direto → login, password errada inline, `/_tokens` ausente em produção.
- Files: `backend/src/{app.ts,config.ts,common/spa.ts,common/authGuard.ts,common/errors.ts}`, `backend/test/{spa.test.ts,helpers.ts}`, `backend/package.json`, `backend/.env.example`, `docs/adr/0010-spa-servida-pelo-backend.md` (novo), `docs/adr/README.md`, `docs/{architecture,api,security,environment,commands,code-map}.md`
- Item original do ToDo: "Backend serve a SPA em produção (`frontend/dist` com `@fastify/static`, fallback para `index.html` fora de `/api`) — fecha o ❓ de [[../docs/architecture|architecture]]; é o que deixa uma futura app desktop abrir o URL do backend sem mexer em cookie/`Origin` ([[ideas]] → App desktop)"

## 2026-09-28 — `StateStore`: `state.json` em `DATA_DIR`

- `backend/src/state/`: schema zod v1 (`SavedTerminal`, `ClosedTerminal`, `Folder`; ids de terminal e caminhos de pasta únicos), `migrate` (versão mais nova → recusa), `enforceLimits` (200 fechados por `closedAt`; 10 recentes não-favoritas por `lastUsedAt`, as nunca usadas saem primeiro). `StateStore.load` cria a `DATA_DIR`; ficheiro inexistente → vazio (nada escrito até à 1.ª mudança); inválido → `StateFileError` com caminho+razão, o backend sai com 1 e **nunca** o sobrescreve. `update(recipe)` valida uma cópia (inválida → lança e nada muda), aplica limites e põe na fila: uma escrita de cada vez, mudanças durante uma escrita juntam-se na seguinte. `atomicWrite`: `tmp` + `fsync` + `rename` com backoff exponencial em `EPERM`/`EBUSY`/`EACCES` — sem `write-file-atomic` (nenhuma dependência nova). Falha depois das tentativas → log, estado fica em memória até à próxima escrita (decisão do dono).
- `DATA_DIR` (omissão `~/.workflow-app`, absoluto) no `config.ts`; entra na denylist do filho, e com ele `FRONTEND_DIST`, que faltava. `buildApp` recebe `stateStore` (opcional até a feature Terminais o usar) e esvazia a fila no `onClose`. `testEnv` aponta `DATA_DIR` para o tmp — os testes nunca tocam no `~/.workflow-app` real.
- Testado: 77/77 Vitest (16 novos em `stateStore.test.ts` + `DATA_DIR` em config e denylist); lint limpo; `tsc` só com o erro pré-existente em `test/auth.test.ts:40`. Backend real com `DATA_DIR` num tmp: arranca, cria a pasta, `/api/health` 200; com `state.json` inválido: sai com 1, lista os campos, ficheiro intacto.
- Files: `backend/src/state/{state.schema,stateStore,atomicWrite}.ts` (novos), `backend/src/{config,app,server}.ts`, `backend/src/terminals/spawnClaude.ts`, `backend/test/{stateStore.test.ts,config.test.ts,spawnClaude.test.ts,helpers.ts}`, `backend/.env.example`, `docs/{environment,database,architecture,code-map}.md`
- Item original do ToDo: "`StateStore` em `backend/src/state/`: `DATA_DIR` no `config.ts` (omissão `~/.workflow-app/`) + `docs/environment.md` + `.env.example`; schema zod v1 (`terminals`, `closedTerminals`, `folders`); ler no arranque (inexistente → vazio, inválido → não arranca, nunca sobrescrever); **fila de escrita** + `tmp` e `rename` com retry em `EPERM`/`EBUSY` (ou `write-file-atomic` — cuidado com o Smart App Control se trouxer binário); limites (200 fechados, 10 recentes não-favoritas); testes Vitest com `DATA_DIR` temporário"

## 2026-09-28 — Biblioteca só de leitura (ADR 0005)

- Backend: `GET /api/library/{stacks,themes,skills}` → `{entries, invalid}`, frontmatter com `yaml` + zod, lido a cada pedido; maturidade normalizada em 3 chips (`maturity`) com o valor original em `maturityRaw`; manifesto inválido vai para `invalid[]` (nunca fatal); só a falta de `library/` dá `LIBRARY_001` (espelhado no frontend). Frontend: `LibraryPage` (protótipo 1l) com tabs e contagens, pesquisa com o atalho `/`, chips Todas/Provado/Parcial/Rascunho (`.filter-chip` + `.mat-glyph`, a mesma forma das tags), `Select` de camada só em Stacks e de categoria só em Skills, rodapé com contagens + "a mostrar N", `LIBRARY_001` inline com "Tentar de novo"; `LibraryEntryDrawer` (1m, 600) só com frontmatter, Copiar caminho, `Esc`.
- Encontrado a verificar: em dev, o StrictMode corre o efeito duas vezes, e o erro da execução cancelada não era reclamado, por isso aparecia um toast por cima do erro inline. Corrigido reclamando antes do `if (cancelled)`. Também: `Alert message` está obsoleto no antd 6 (passa a `title`), e o lint `set-state-in-effect` obrigou a pôr os `setState` só no `.then/.catch`. Tudo registado nas armadilhas de `frontend-conventions`.
- Testado: backend 85/85 Vitest (sessão anterior + hoje), lint limpo, `tsc` só com o erro pré-existente em `test/auth.test.ts:40`; frontend `tsc -b` e lint limpos; **Chrome headless via CDP, 35/35 verificações** com login real (password temporária de teste): contagens das tabs = API (6/1/19), linhas = API, rodapé, chips (cor computada `accent-subtle`/`accent-border`), filtro Provado, `/` foca sem escrever, pesquisa, select de categoria (3 opções = API) e reset ao mudar de tab, drawer por "Ver" e por clique na linha (600 px, título mono, caminho, rodapé, `Esc` fecha), `LIBRARY_001` simulado com `Fetch` → mensagem PT inline sem toast → "Tentar de novo" recupera, consola sem erros.
- Files: `backend/src/library/{library.schemas,libraryService,library.routes}.ts`, `backend/src/{app.ts,common/errors.ts}`, `backend/package.json` (`yaml`), `backend/test/library.test.ts`, `frontend/src/pages/LibraryPage.tsx`, `frontend/src/components/library/{LibraryEntryDrawer.tsx,MaturityTag.tsx,libraryFormat.ts}`, `frontend/src/{hooks/useLibrary.ts,services/libraryService.ts,types/library.ts,config/drawer.ts,index.css,errors/errorMessages.ts}`, `docs/{api,architecture,code-map,frontend-conventions,environment}.md`, `docs/skills/references/design/{tables-and-lists,drawers-and-modals}.md`
- Item original do ToDo: "⚠️ **Biblioteca** — `GET /api/library/*` a ler os manifestos de `WORKFLOW_PATH/library` ([[../docs/adr/0005-biblioteca-lida-do-disco|ADR 0005]]) + ecrã com filtros por tipo, camada e maturidade (protótipos 1l/1m em `docs/design/handoff-2026-09-27/Biblioteca.dc.html`)"

## 2026-09-28 — Nome de utilizador no login (ADR 0011)

- Pedido do dono no chat, a meio da Biblioteca ("quero que também adiciones nome de utilizador no login, podes colocar o meu como bino03"). Decidido com ele: `APP_USERNAME` no `.env` (não fixo no código), feito logo a seguir à Biblioteca. ADR 0011 substitui só o contrato de login do 0003. `POST /api/auth/login {username, password}`: o nome compara-se em tempo constante (SHA-256 + `timingSafeEqual`), o argon2 corre sempre, e um nome ou password errados dão o mesmo `AUTH_001`. O nome é sensível a maiúsculas, com espaços à volta ignorados. `APP_USERNAME` validado no arranque (`[A-Za-z0-9._-]`, 1–64) e fora do ambiente do `claude`. `APP_USERNAME=bino03` acrescentado ao `backend/.env` do dono (a pedido dele). Frontend: campo "Nome de utilizador" antes da password (`autocomplete=username`, foco inicial), Zod com a mesma lista branca, e o `AUTH_001` diz "Nome de utilizador ou password incorretos" (o nome fica, a password limpa-se).
- De caminho: três testes do `StateStore` terminavam sem `flush()`, e o `afterEach` apagava a pasta com uma escrita a meio (`ENOTEMPTY`, intermitente). Corrigido.
- Testado: 91/91 Vitest ×3 (novos: nome errado/maiúsculas/sufixo → o mesmo corpo `AUTH_001`, espaços ignorados, `fieldErrors` dos dois, `authService.test.ts` prova que o argon2 corre com o nome errado, config recusa nomes inválidos); lint limpo; `tsc` só com o erro pré-existente em `test/auth.test.ts:40`. Backend real (reiniciado com o `.env` do dono): nome certo + password errada → 401 `AUTH_001`, nome errado → o mesmo corpo, sem `username` → 400 `COMMON_001`. Chrome headless, 10/10: ordem e foco dos campos, `autocomplete`, erros por campo vazios e de caracteres, `AUTH_001` real inline sem toast, e caminho feliz (com `/auth/login` e `/auth/me` simulados) → `/terminals` com o corpo `{username, password}`. **Não testado com a password real do dono** — ele tem de confirmar que entra.
- Files: `backend/src/{config.ts,auth/auth.routes.ts,auth/auth.schemas.ts,auth/authService.ts,terminals/spawnClaude.ts}`, `backend/test/{auth,authService,config,library,spa,spawnClaude,stateStore}.test.ts`, `backend/test/helpers.ts`, `backend/.env.example`, `backend/.env` (não versionado), `frontend/src/{pages/login/LoginPage.tsx,pages/login/loginFormSchema.ts,services/authService.ts,contexts/AuthContext.tsx,contexts/authContextValue.ts,types/auth.ts,errors/errorMessages.ts}`, `docs/adr/{0011-nome-de-utilizador-no-login.md,0003-auth-utilizador-unico.md,README.md}`, `docs/{api,security,environment,commands}.md`
- Item original: pedido no chat (não havia bullet no ToDo)

## 2026-09-28 — Spec da feature Terminais (`/plan-feature`) + ADR 0012

- Os seis itens do backlog (Terminais, Terminais guardados, Pastas, Retomar sessões, Definições, Quota) passaram a uma só spec, `docs/features/terminais.md`: 17 passos, backend antes do frontend, cada um com ficheiro, skill, tier e critério. Os esclarecimentos do plano de 2026-09-28 foram copiados para a secção 3 (a spec não depende de notas pessoais). Novas decisões na entrevista:
  - o histórico dos fechados aparece só na lista Retomar do drawer;
  - favoritas e recentes ficam por cima do navegador de pastas;
  - clicar num terminal na grelha amplia-o temporariamente;
  - se o spike não confirmar `rate_limits`, a quota sai da spec.
- ADR 0012 fixa os argumentos do `claude` (`--session-id` gerado pelo backend, `--resume` para retomar/continuar/reabrir, `--settings` com a status line da quota), e a parte da quota fica condicionada ao spike. `security.md` aponta para ele. No `adr/README`, três "decisões por tomar" saíram (ficaram decididas na spec) e a da quota aponta para o 0012. No `api.md`, as propostas antigas de Terminais, Sessões e Quota, que já divergiam, deram lugar a ponteiros para a spec (uma só cópia até ao passo 9).
- Não houve código nem testes (spec).
- Files: `docs/features/terminais.md` (novo), `docs/adr/0012-argumentos-do-claude-e-status-line.md` (novo), `docs/adr/README.md`, `docs/api.md`, `docs/security.md`
- Itens originais do ToDo (substituídos por um bullet que aponta para a spec): "Terminais guardados (dentro da feature **Terminais**): …" · "Pastas recentes/favoritas: …" · "⚠️ **Terminais** — …" · "⚠️ **Definições — modo de layout dos terminais** — …" · "⚠️ **Retomar sessões** — …" · "⚠️ **Indicador de quota** — spike primeiro: …"

## 2026-09-28 — Terminais, passo 1: spike da quota pela status line

- `backend/scripts/statusline-spike.ts` lança o `claude` real num PTY (via `TerminalManager` + `claudeSpawner`) com `--session-id <uuid> --settings <tmp>/claude-settings.json`. O `statusLine` dessas settings grava cada JSON que recebe. Sem prompt, não gasta quota; com `--prompt`, manda "Responde apenas: ok" (o dono autorizou uma mensagem).
- Resultado (`claude` 2.1.283):
  - a status line corre logo no arranque, mas **sem** `rate_limits`;
  - depois da 1.ª resposta traz `rate_limits.five_hour` / `seven_day` = `{used_percentage, resets_at}`, com `resets_at` em segundos Unix. No momento: 44 % / 61 %.
  - A quota fica na spec, e o ADR 0012 passa a aceite por inteiro.
- De caminho, confirmado:
  - `--session-id` funciona, e o `<uuid>.jsonl` existe logo depois do arranque;
  - a codificação da pasta em `~/.claude/projects/` (`:`, `\` e espaço → `-`), que fecha a pergunta do passo 3.
- Para o passo 8: o script só pode reescrever `usage.json` quando o JSON traz `rate_limits`. Sem isso, cada terminal novo apagava o valor.
- Efeitos secundários:
  - duas sessões de spike ficaram no histórico do Claude Code desta pasta (`~/.claude/projects/C--Users-jlalv-Desktop-utad-projetos-WorkFlow-App/118f54da-….jsonl` e `d00fd2fb-….jsonl`);
  - pastas `wfa-statusline-*` ficaram em `%TEMP%`.
- Files: `backend/scripts/statusline-spike.ts` (novo), `docs/features/terminais.md` (§4.1, §4.3, passo 1, §6, §7), `docs/adr/0012-argumentos-do-claude-e-status-line.md`, `docs/adr/README.md`, `docs/api.md`, `docs/commands.md`
- Item original: passo 1 da spec [[../docs/features/terminais|terminais]] ("Spike da quota pela status line")

## 2026-09-28 — Terminais, passo 2: códigos de erro + política de pastas

- 8 códigos novos em `backend/src/common/errors.ts`: `TERMINAL_001`–`006`, `FOLDER_001` e `SESSION_001`. Ficam espelhados já em `errorMessages.ts`, porque a regra de `errors.ts` pede o mesmo commit (desvio registado na spec).
- `resolveAllowedPath` em `backend/src/folders/cwdPolicy.ts` é o único caminho por onde uma pasta vinda do cliente vira `cwd`:
  - absoluta, sem NUL, existente e pasta;
  - resolvida com `realpathSync.native` (segue `..`, symlinks e junctions, e devolve a grafia real);
  - dentro de uma raiz, com comparação sem maiúsculas no Windows. Exige separador no fim da raiz, para `C:\dev2` não passar por `C:\dev`, e trata bem uma raiz de unidade (`D:\`).
  - Qualquer falha dá `FOLDER_001`, sem dizer qual.
- Também exporta `isInsideRoot`/`findRoot`, que o browse do passo 9 vai usar.
- Testado:
  - 9 testes novos com uma árvore temporária real, incluindo uma junction para fora (recusada) e uma para dentro (resolvida). Suite 100/100.
  - Lint limpo; `tsc` sem erros; frontend `tsc -b` e lint limpos.
- Docs: `api.md` (tabela de códigos), `backend-conventions` (as regras 6 e 7 passam a apontar para o ADR 0012 e para `cwdPolicy`), `architecture` e `code-map` (a pasta `folders/`, e o caminho antigo `terminals/cwdPolicy.ts` corrigido).
- `notes/workflow-feedback.md` (regra nova do `CLAUDE.md`) ganhou 3 entradas do que se herdou e atrapalhou nesta sessão: o padding do `AppLayout`, o i18n num projeto sem i18n, e o SQL no template da spec.
- Files: `backend/src/common/errors.ts`, `backend/src/folders/cwdPolicy.ts` (novo), `backend/test/cwdPolicy.test.ts` (novo), `frontend/src/errors/errorMessages.ts`, `docs/{api,architecture,code-map,backend-conventions}.md`, `docs/features/terminais.md`
- Item original: passo 2 da spec [[../docs/features/terminais|terminais]] ("Códigos de erro + política de pastas")

## 2026-09-28 — Terminais, passos 3-9: o backend todo (modo contínuo)

- **Passo 3:** `ClaudeSessions` lê os `.jsonl` do Claude Code de forma tolerante. Não contam como mensagens os resultados de ferramentas, as linhas meta, os subagentes nem os ecos de comandos. O resumo vem do `ai-title` ou da última resposta cortada a 600. O id só entra num caminho depois de validado como UUID. Contra a pasta real: 10 sessões em 126 ms.
- **Passo 4:** `claudeArgs` é o único sítio que monta a linha de comando: `--session-id`, `--resume` e `--settings`.
- **Passo 5:** `TerminalsService` junta o `state.json` com o `TerminalManager`. O estado é running/exited/stopped; reabrir mantém o id e volta a validar a pasta; uma sessão já usada dá `TERMINAL_003`; fechar grava o resumo e nunca falha por causa dele. Se a gravação falhar depois do spawn, o processo é morto. O `TerminalManager` aceita o `id` e só conta os vivos.
- **Passo 6:** as rotas REST, com o rótulo em lista branca.
- **Passo 7:** o gateway WS: ready → scrollback → output ao vivo; só `resize` validado nos frames de texto; fecho 4404/4401; frames até 1 MiB; o conteúdo nunca vai para os logs (provado com um `logStream`).
- **Passo 8:** a quota. O `statusline.cjs` guarda só `rate_limits` + `fetchedAt`, não escreve sem `rate_limits` e grava de forma atómica. `/api/usage` devolve `null`s quando não há dados.
- **Passo 9:** as rotas de sessões (com `closed` e `openIn`) e de pastas (favoritas/recentes, browse de um nível sem pastas escondidas nem junctions).
- **Testado:** 159/159 Vitest; lint e tsc limpos.
  - Cada passo com rotas foi verificado numa instância isolada (porta 7498, password/`DATA_DIR`/`ALLOWED_ROOTS` temporários) com o `claude` real: criar/listar/fechar, o processo morre, WS com ready, TUI, resize, 4404 ao fechar e `Origin` alheio 403, o log só com ids, `--settings` no processo real, e folders/browse/sessions.
  - Nenhuma chamada ao modelo nestes passos, por isso não se gastou quota.
- **Enganos apanhados pelo caminho:**
  - Um commit (quota) entrou com lint a falhar, porque a cadeia usou `;` em vez de `&&`; foi corrigido num commit a seguir.
  - Dois testes estavam errados, não o código: um empate de mtime e uma ordem alfabética.
  - O `injectWS` só entrega os frames iniciais se os listeners forem ligados no `onInit`.
- **Files:**
  - `backend/src/{sessions,folders,usage}/*`, `backend/src/terminals/{claudeArgs,terminalsService,terminal.schemas,terminals.routes,terminals.gateway,terminalManager}.ts`, `backend/src/app.ts`;
  - `backend/test/{claudeSessions,claudeArgs,terminalsService,terminals.routes,terminals.gateway,usage,folders.sessions.routes,terminalManager}.test.ts`, `backend/test/{fakeClaude,helpers}.ts` e os testes que usam `buildApp`;
  - `docs/{api,architecture,code-map,security,database,commands}.md`, `docs/features/terminais.md`.
- Item original: passos 3-9 da spec [[../docs/features/terminais|terminais]]

## 2026-09-28 — Terminais, passos 10-17: o frontend, e a feature fechada (modo contínuo)

- **Passos 10-11:** tipos e serviços; `TerminalView` (xterm.js + WS):
  - `ready` → `reset` + resize ±1;
  - reconexão com backoff;
  - o componente é remontado ao reabrir;
  - `Alt+…` recusados pelo xterm.js e executados por um só listener da janela.
- **Passos 12-14:** página em foco, drawer Novo terminal (1j), fechar com confirmação, renomear no cabeçalho, `Alt+1…9/N/\/W/R`, "Reabrir todos", e um toast quando um terminal fora do ecrã termina.
- **Pedido do dono a meio (lateral por projetos):**
  - O que pediu: "em vez de ter isto por terminal preferia ter antes por projetos e depois cada terminal aberto por projeto iria ser aberto no mesmo caminho".
  - Decidido com ele: projeto = pasta (nada novo a gravar); a lateral agrupa por pasta; cada projeto tem **+** (terminal nessa pasta, sem drawer), estrela e "Retomar…".
- **Passos 15-16:** Definições (foco dividido/grelha no `localStorage`); grelha 3 colunas com scroll depois de 6 e ampliar temporário (`Esc` só fora do terminal); quota na lateral e no cabeçalho (aviso a partir de 80 %, a cinzento com "há X min" quando velha, "—" depois da reposição).
- **Passo 17:** reinício do backend → parados → "Reabrir todos": o terminal com conversa voltou com `--resume`, o sem conversa com `--session-id` e o aviso "Conversa nova".
- **Encontrado a verificar:**
  1. **Bug sério: um `CLAUDE_CONFIG_DIR=` vazio no `.env` chegava ao `claude`.** O `claude` usava a pasta do terminal como configuração: escrevia `projects/`, `history.jsonl` e `sessions/*.key` dentro do projeto e não via o login (mostrava "API Usage Billing"; nenhum prompt foi enviado). Corrigido no `childEnv` e no `config.ts`; os ficheiros apagados antes de qualquer commit; confirmado "Claude Pro" no ecrã.
  2. A denylist deixava passar `CLAUDE_EFFORT` e `CLAUDE_JOB_DIR`. Agora sai todo o `CLAUDE_*` exceto `CLAUDE_CONFIG_DIR`.
  3. O `claude` não grava sessões sem mensagens, o que deixava reabri-las em `TERMINAL_004`. Decidido com o dono: reabrir começa uma conversa nova no mesmo terminal (`freshSession`).
     - Diagnóstico corrigido a meio: primeiro atribuí os `.jsonl` "em falta" a isto e depois vi que o bug 1 os tinha posto noutra pasta. Voltei a testar com a config certa e a conclusão manteve-se.
- **Por investigar (ficou no ToDo):** o `claude` diz que o renderer fullscreen "has repeatedly failed to start on this machine, so it has been turned off here".
- **Testado:**
  - backend 161/161 Vitest; lint e tsc limpos; frontend `tsc -b` e lint limpos;
  - Chrome headless contra uma instância de teste com o `claude` real, sem prompts: 32/32 (terminais e projetos) + 21/21 (layouts e quota) + 10/10 (reinício).
- **Files:**
  - `frontend/src/{types,services,hooks,terminal,components/terminals,components/settings,pages/TerminalsPage.tsx,layouts/AppLayout.tsx,index.css,services/general/notificationService.tsx}`;
  - `backend/src/terminals/{terminalsService,spawnClaude}.ts`, `backend/src/config.ts`, `backend/.env.example` e os testes;
  - `docs/{api,architecture,backend-conventions,frontend-conventions,environment,code-map}.md`, `docs/skills/references/design/{app-shell-and-auth,tokens-and-colors}.md`, `docs/features/terminais.md`.
- Item original do ToDo: "**Terminais** (inclui guardados, pastas recentes/favoritas, retomar sessões, Definições do layout e quota) — executar a spec [[../docs/features/terminais|terminais]] …"

## 2026-09-28 — Investigado: o fullscreen do `claude` desligado ("repeatedly failed to start")

- **Causa (lida no binário do `claude` 2.1.283):** ao arrancar em fullscreen, o Claude Code arma um *canary* em `~/.claude.json` (`fullscreenBootPending[pid]`) e só o limpa ~10 s depois do primeiro frame ou numa saída limpa.
  - Se no arranque seguinte o processo desse canary já não existir, conta uma *strike*. Com **2 strikes**, grava `fullscreenAutoDisabled` e o fullscreen fica desligado **na máquina toda**, também nos terminais normais do dono, até um `/tui fullscreen` ou uma atualização.
  - O Fechar da app fazia `taskkill /T /F` logo, e as minhas corridas de teste abriam e fechavam terminais em segundos. Foi isso que o desligou às 16:23:37.
- **Correção:** `closeGracefully` em `backend/src/terminals/spawnClaude.ts`. Fecha com Ctrl+C ×2 e só faz `taskkill` se o processo não sair em 3 s. Lista os descendentes antes (uma saída limpa deixá-los-ia órfãos) e mata os que sobrarem.
  - Com o `claude` real, o Fechar da app fá-lo sair sozinho (código 0) em ~2,5 s.
  - Não fica coberto um backend morto à força (ex. o `tsx watch` a reiniciar) com terminais ainda a arrancar.
- **Não confirmado com o canary a sério.** Com o fullscreen desligado o canary não é armado (e o override `CLAUDE_CODE_NO_FLICKER=1` também o salta). Falta o dono correr `/tui fullscreen` e depois `scripts/fullscreen-canary-spike.ts` (está no ToDo).
- **Deslize meu:** o commit `9574516` entrou com um teste a falhar sob a carga da suite inteira. A verificação lia a saída com `| grep` em vez do código de saída do Vitest. Corrigido em `d3fa530` (`testTimeout` 20 s; 3 corridas 162/162 com código 0).
- Files: `backend/src/terminals/{spawnClaude,terminalManager}.ts`, `backend/test/{fakeClaude,terminalManager.test}.ts`, `backend/vitest.config.ts`, `backend/scripts/fullscreen-canary-spike.ts`, `docs/{api,architecture,backend-conventions,commands}.md`, `docs/features/terminais.md`
- Item original do ToDo: "**Terminais — renderer fullscreen do `claude` desligado** — …" (substituído pelo de reativar e confirmar)

## 2026-09-28 — Confirmado: o Fechar da app já não desliga o fullscreen do `claude`

- O dono correu `/tui fullscreen`: `fullscreenAutoDisabled` e as strikes saíram do `~/.claude.json`.
- Com o canary armado a sério, `scripts/fullscreen-canary-spike.ts` confirmou os dois casos:
  - A (`Ctrl+C` ×2): armado ao arrancar, retirado ao sair;
  - C (o Fechar da app, `TerminalManager.kill` → `closeGracefully`): armado ao arrancar, sai sozinho com código 0 em ~4 s, sem deixar `fullscreenBootPending`.
  - No fim, nenhuma strike nem nenhuma marca pendente.
- O spike passou a correr sem o override `CLAUDE_CODE_NO_FLICKER` (que salta o canary). A parte B (`taskkill` à força) ficou atrás de `--with-forced-kill`, porque deixaria uma strike verdadeira.
- Files: `backend/scripts/fullscreen-canary-spike.ts`, `docs/backend-conventions.md`, `docs/features/terminais.md`
- Item original do ToDo: "**Terminais — reativar o fullscreen do `claude` e confirmar o fecho limpo** — …"

## 2026-09-30 — Upload de skills para a biblioteca: passos 1-5 (o código todo)

- A Biblioteca deixou de ser só de leitura: na tab Skills, "+ Adicionar skill" abre um drawer onde se
  escolhe uma stack e se arrasta um `skill-*.md`; o backend valida o frontmatter, escreve
  `stacks/<pasta>/skills/skill-<name>.md` e acrescenta o nome ao `provides-skills` do `STACK.md` dessa
  stack. **Porquê assim**: o `WORKFLOW_PATH` não pertence a esta app — é a biblioteca partilhada por todos
  os projetos que o Workflow gera, e um ficheiro no sítio errado só dá erro no *próximo* projeto. Por isso
  a porta é estreita e fechada por construção: o `stackId` nunca entra num caminho (a pasta vem do
  `STACK.md` que o serviço encontrou ao varrer o disco), o nome do ficheiro vem do frontmatter validado e
  nunca do cliente, e não há overwrite ([[../docs/adr/0014-escrita-controlada-biblioteca|ADR 0014]], que
  reverte em parte a ADR 0005 — que já previa este dia).
- Decisões que valem a pena lembrar: o `provides-skills` atualiza-se em **melhor esforço** (se falhar, a
  skill já existe e a lista lê a pasta, não o manifesto); `library/stacks/README.md` fica de propósito por
  atualizar (tabela de prosa, frágil de editar); o drawer não usa React Hook Form porque não há nada para
  validar do lado do cliente — o que torna o ficheiro válido está dentro dele.
- **Testado**: 217 testes do backend a passar (45 novos — 23 do editor de frontmatter, 22 da rota, com
  path traversal, duplicados, ficheiro vazio/gigante e sem sessão). `tsc`/lint limpos dos dois lados. Como
  prova extra sem browser, o editor de frontmatter foi corrido **em leitura** contra os 6 `STACK.md` reais
  do Workflow: em todos muda exatamente uma linha e é idempotente, sem escrever nada.
- **Por fechar**: a verificação no browser (passos 5 e 6) — a extensão do Chrome não respondeu ("No group
  with id", 3 tentativas) e o login precisa da password real. Checklist em
  `notes/verificacao-browser-pendente.md`, com um ficheiro pronto a arrastar em `notes/skill-teste-upload.md`.
  O bloqueio do Rollup que travou as duas sessões anteriores já não acontece.
- Files: `docs/adr/0014-escrita-controlada-biblioteca.md` · `docs/adr/README.md` ·
  `backend/src/library/{frontmatterEditor,libraryService,library.routes,library.schemas}.ts` ·
  `backend/src/{app,common/errors}.ts` · `backend/test/{frontmatterEditor,library.upload}.test.ts` ·
  `backend/package.json` (+`@fastify/multipart`) ·
  `frontend/src/components/library/UploadSkillDrawer.tsx` · `frontend/src/pages/LibraryPage.tsx` ·
  `frontend/src/hooks/useLibrary.ts` · `frontend/src/services/libraryService.ts` ·
  `frontend/src/errors/errorMessages.ts` · `docs/{api,architecture,database,code-map,security}.md` ·
  `docs/product/use-cases.md` · `docs/skills/references/{project-vocabulary,design/forms-and-validation}.md` ·
  `docs/features/upload-de-skills.md`
- Item original do ToDo: "Implementar a spec [[../docs/features/upload-de-skills|upload de skills]] (6 passos) — na Biblioteca, tab Skills, arrastar um `skill-*.md` para uma stack existente e ele passa a viver em `WORKFLOW_PATH/library`; reverte parcialmente a ADR 0005 (novo ADR no passo 1). `/implement-todo` → "Implementar a partir de uma spec"."

## 2026-09-30 — Upload de skills verificado no browser (39/39), sem a extensão do Chrome

- A extensão do Chrome falhou outra vez ("No group with id", 3 tentativas). Em vez de adiar, usei o
  driver CDP de 2026-09-28 com uma volta nova: **uma segunda instância do backend (7498/7499) com
  credenciais de teste geradas na hora e o `WORKFLOW_PATH` a apontar para uma cópia da biblioteca real**,
  a servir a SPA do `frontend/dist`. **Porquê**: o login a sério sempre precisou da password do dono, e
  isso bloqueou três sessões seguidas de verificação. Com credenciais próprias da instância de teste o
  fluxo autenticado corre inteiro, sem password nenhuma do dono e sem tocar na biblioteca partilhada.
- **36/36 no fluxo principal**: caminho feliz (201, notificação, drawer fecha, linha na tabela sem F5 e
  sem segundo GET, ficheiro no disco com o nome do frontmatter, `provides-skills` atualizado e o resto do
  `STACK.md` intacto), duplicado 409 dentro do drawer, frontmatter inválido e kebab-case 400, > 256 KB
  avisado na UI e recusado no backend, escolher por clique, reabrir limpa o estado, consola limpa.
  **3/3 no estado vazio** (biblioteca sem stacks).
- Três armadilhas do antd 6 que custaram três corridas e ficaram no `learning.md`: `.ant-select-content`
  em vez de `.ant-select-selector`; o `[role="listbox"]` é um espelho de acessibilidade escondido (as
  opções a sério são `.ant-select-item-option` no dropdown); e o painel de tab ativo é
  `.ant-tabs-content-active`, com os outros painéis montados na mesma — ler `.ant-table-row` sem o
  escopo do painel mistura as tabelas das três tabs.
- **Por fazer**: a passagem contra a biblioteca **real** (passo 6). Fui impedido de escrever no
  `WORKFLOW_PATH` real — é partilhado por todos os projetos do Workflow, fora deste repo — e o guarda faz
  sentido. É o mesmo código já provado contra a cópia; fica para o dono, com o passo a passo em
  `notes/verificacao-browser-pendente.md`.
- Files: `docs/features/upload-de-skills.md` · `notes/verificacao-browser-pendente.md` · `notes/learning.md`
  (nenhum ficheiro de código mudou — a verificação não encontrou nenhum defeito)
- Item original do ToDo: "Implementar a spec [[../docs/features/upload-de-skills|upload de skills]] (6 passos)…"

## 2026-10-09 — Atualizado do Workflow (`6d8aaff` → `eff6838`, via `/upgrade-project`)

- Aplicadas 13 alterações de skills e referências que a biblioteca corrigiu desde a geração (Zod/RHF só com validação no cliente, i18n retirado, `refine-idea`, `implement-todo` Fase 2, links). O resto ficou de fora de propósito — razões em [[../docs/provenance|provenance]] → "Atualizações do Workflow".
- Files: `docs/skills/frontend/skill-frontend-design-system.md`, `docs/skills/process/skill-implement-todo.md`, `docs/skills/process/skill-refine-idea.md`, `docs/skills/references/{ai-workflow,security-baseline}.md`, `docs/skills/references/design/{drawers-and-modals,forms-and-validation}.md`, `docs/provenance.md`
- Item original do ToDo: — (manutenção)

## 2026-10-09 — Passkeys (WebAuthn) no login, além da password

- Decidido com o dono e escrito no [[../docs/adr/0015-passkeys-webauthn|ADR 0015]]: as passkeys são um caminho independente da password, que continua a ser a recuperação. São descobríveis, pode haver várias, e ficam em `DATA_DIR/passkeys.json`, à parte do `state.json` (o ADR 0011 recusou misturar credenciais com estado). Registar exige a password outra vez. O rate limit de 5/min é **partilhado** com a password, e revogar uma passkey termina as sessões abertas com ela. Biblioteca: `@simplewebauthn` 14. O `rpID` vem do `.env`, com `localhost` por omissão.
- **Porquê implementar já, sem o iPhone**: o WebAuthn exige HTTPS e um domínio fixo, e a app ainda só corre em `127.0.0.1`. O código não depende da forma de expor; o teste no iPhone real fica pendente até a app sair de casa ([[verificacao-browser-pendente]]).
- **Armadilha do rate limit**: o `config.rateLimit` por rota dá a cada rota o seu próprio contador, e o `groupId` não partilha entre rotas com o store em memória (`LocalStore.child`). A solução foi um só handler `app.rateLimit()` ligado como `onRequest` às três rotas que provam identidade.
- Testes: 41 novos no backend (passkey + config), 241 no total. Usam um **autenticador por software** (`test/softAuthenticator.ts`, ES256 com attestation "none") contra a verificação real da biblioteca: replay, assinatura forjada, origem/rpID errados, challenge de outra sessão, rate limit partilhado, revogação que mata a sessão, reinício.
- Browser: **34/34** em Chrome headless com o **autenticador virtual do CDP** (`WebAuthn.addVirtualAuthenticator`), contra uma instância de teste (porta 7498, credenciais geradas na hora, `DATA_DIR` temporário). Cobre registo, password errada no campo, registo repetido no mesmo dispositivo, login pelo botão e pelo autofill, "esta sessão", revogar → `/login`, passkey revogada recusada, e `127.0.0.1` → "abre em localhost".
- **Bug apanhado pelo browser**: o autofill voltava a armar-se depois de qualquer falha. Em headless o pedido condicional falha logo, e a página entrava num ciclo de pedidos de opções até ao rate limit ("Demasiadas tentativas" sem ninguém tocar em nada). Agora só se volta a armar depois de uma tentativa em que o utilizador escolheu mesmo uma passkey.
- Files: `backend/src/auth/{passkey.routes,passkeyStore,challengeStore,auth.routes,auth.schemas,sessionStore}.ts`, `backend/src/{config,app,server}.ts`, `backend/src/common/errors.ts`, `backend/test/{passkey.test,softAuthenticator,config.test}.ts`, `backend/.env.example`, `frontend/src/{pages/login/LoginPage,components/settings/{SettingsDrawer,PasskeysSection,AddPasskeyForm,addPasskeyFormSchema},contexts/{AuthContext,authContextValue},hooks/usePasskeys,services/passkeyService,errors/{errorMessages,passkeyErrors},types/auth}.ts(x)`, `docs/adr/0015-passkeys-webauthn.md`, `docs/{api,security,database,environment,code-map,backend-conventions}.md`, `docs/adr/README.md`
- Item original do ToDo: "⚠️ Entrar com uma **passkey** no login, para abrir a app com o iPhone (Face ID / Touch ID via chaveiro do iCloud) sem escrever a password" (com o bloco de 6 decisões por tomar, todas respondidas — ver o ADR)

## 2026-10-20 — Quota duplicada: fica só a lateral

- Os limites de utilização (sessão de 5 h e semanal) apareciam duas vezes: na lateral e no cabeçalho do modo Grelha. Removida a variante do cabeçalho; a lateral (sempre visível) fica. `tsc -b` e lint do frontend limpos; verificação no browser não feita (o login pede a password, que o dono esqueceu).
- O "há 517 h" era o rótulo de valor desatualizado: a quota só se atualiza quando um terminal recebe uma resposta, e o último valor guardado tinha ~21 dias.
- Files: `frontend/src/components/terminals/QuotaMeter.tsx`, `frontend/src/components/terminals/TerminalGrid.tsx`, `frontend/src/pages/TerminalsPage.tsx`, `docs/features/terminais.md`
- Item original do ToDo: "(sem item — pedido direto do dono)"

## 2026-10-20 — Atalhos de teclado editáveis nas Definições (spec `atalhos-editaveis`, ADR 0016)

- Todos os atalhos (`Alt+1…9`, `Alt+N`, `Alt+\`, `Alt+W`, `Alt+R`, zoom, `AltGr+.`) passam a ser predefinidos editáveis numa secção "Atalhos" das Definições, mais 7 ações novas sem bind (projeto seguinte/anterior, fechar o projeto, terminal seguinte/anterior, ir para Terminais/Biblioteca). As alterações ficam no `state.json` (v2, só o que mudou); o catálogo vive só no backend.
- Captura da combinação com colisão pelo nome da outra ação, Ctrl/Shift recusados, aviso para combinações do shell/browser (`Alt+B/F/D/E/.`) com "Gravar mesmo assim", remover, repor uma, repor todas.
- Mudança de comportamento: só as combinações **com bind** deixam de chegar ao PTY — antes qualquer `Alt+…` da app era cortado.
- Testado: 259 testes do backend (18 novos: migração v1→v2 e as rotas); `curl` numa instância de teste; browser 40/40 em Chrome headless via CDP (DOM + rede), com reinício do backend a meio. Falta só o AltGr no browser do dono ([[verificacao-browser-pendente]]). A 1.ª corrida dos testes do backend teve um worker do Vitest a sair a meio (3 falhas sem ficheiro identificado); as duas seguintes passaram todas — instabilidade, não um teste novo.
- O backend em `dev` (7400) reiniciou com o esquema v2: o `state.json` real foi migrado **em memória** e passa a v2 em disco na próxima alteração; depois disso uma versão anterior da app já não o abre.
- Files: `backend/src/state/state.schema.ts`, `backend/src/keybindings/{catalog,keybindingsService,keybindings.routes}.ts`, `backend/src/common/errors.ts`, `backend/src/app.ts`, `backend/test/{stateStore,keybindings}.test.ts`, `frontend/src/keyboard/shortcuts.ts`, `frontend/src/contexts/{KeybindingsContext.tsx,keybindingsContextValue.ts}`, `frontend/src/hooks/{useKeybindings,useShortcuts}.ts` (sai `useTerminalShortcuts.ts`), `frontend/src/services/keybindingService.ts`, `frontend/src/types/keybindings.ts`, `frontend/src/components/settings/{ShortcutsSection,ShortcutCapture,SettingsDrawer}.tsx`, `frontend/src/components/terminals/TerminalView.tsx`, `frontend/src/pages/TerminalsPage.tsx`, `frontend/src/layouts/AppLayout.tsx`, `frontend/src/errors/errorMessages.ts`, docs (`api`, `database`, `code-map`, `frontend-conventions`, `features/terminais`, `product/use-cases`, `design/buttons-and-icons`, ADR 0016, spec)
- Item original do ToDo: "Implementar a spec [[../docs/features/atalhos-editaveis|atalhos editáveis]] (7 passos) — nas Definições, criar e mudar as binds dos terminais (guardadas no `state.json`, ADR 0016), com ações novas de projetos e de navegação (sem bind por defeito). `/implement-todo` → "Implementar a partir de uma spec"."

## 2026-10-20 — Nome do utilizador no cabeçalho, junto ao ícone

- O `GET /api/auth/me` passa a devolver `username` (o `APP_USERNAME`, só com sessão); o `AuthContext` guarda-o (`username`) — no arranque e logo a seguir ao login por password ou passkey — e o `AppLayout` mostra-o ao lado do ícone do menu de utilizador (13px, `text-2`, cortado com reticências acima de 160px). Não vai para a cache de `sessionStorage`, para nunca mostrar um nome antigo.
- Testado: 38 testes de auth/passkey; `tsc -b`/lint limpos; browser 7/7 em Chrome headless (instância de teste): sem nome no login, nome depois do login pelo formulário, depois de recarregar, e sem nome depois de sair.
- Files: `backend/src/auth/auth.routes.ts`, `backend/test/auth.test.ts`, `frontend/src/services/authService.ts` (`hasSession` → `currentUser`), `frontend/src/contexts/{AuthContext.tsx,authContextValue.ts}`, `frontend/src/layouts/AppLayout.tsx`, `docs/api.md`
- Item original do ToDo: "(sem item — pedido direto do dono: «No canto superior direito, onde aparece o símbolo do utilizador, quero que apareça um nome» / «nome do user»)"

## 2026-10-21 — Separadores de projetos e estilos de grelha verificados no browser (specs fechadas)

- Verificação pendente das specs `separadores-de-projetos` (passo 8) e `estilos-de-grelha` (passo 5), mais o filtro "a correr" por omissão e o `ResumeSessionModal` da mesma sessão de 2026-09-29: **57/57** em Chrome headless via CDP, provado por DOM + API. Sem código novo da app. As duas specs passam a ✅.
- Como: a extensão do Chrome não estava ligada → instância de teste na 7498 (credenciais descartáveis com login a sério pelo formulário, `DATA_DIR`/`ALLOWED_ROOTS` próprios, `WORKFLOW_PATH` com um `projects/INDEX.md` de teste Alfa/Beta/Gama, e — novo desta vez — `CLAUDE_CONFIG_DIR` próprio, para semear duas sessões `.jsonl` falsas sem tocar no `~/.claude` do dono), `frontend/dist` reconstruído (estava mais antigo do que o último commit). `claude` real, sem nenhum prompt; sem processos órfãos no fim.
- O bloqueio do Rollup nativo (passo 0 do plano) não se repetiu: a app do dono já estava a correr, frontend na 7401.
- Observado, conforme a spec (não é bug): num estilo com lugares, um terminal criado fora do "+" do lugar vazio (ex.: o "+" da lateral) não ocupa esse lugar sozinho — fica de fora até se clicar nele.
- Fica para o dono: o `AltGr+.` (o CDP não simula AltGr — já está no bloco `atalhos-editaveis` do [[verificacao-browser-pendente]]) e o upload contra a biblioteca real (spec `upload-de-skills`).
- Files: `docs/features/separadores-de-projetos.md`, `docs/features/estilos-de-grelha.md`, `notes/verificacao-browser-pendente.md`, `notes/ToDo.md`, `notes/roadmap/backlog.md`, `notes/roadmap/plans/2026-10-20-verificacoes-pendentes.md`
- Itens originais do ToDo: "Implementar a spec [[../docs/features/separadores-de-projetos|separadores de projetos]] (8 passos) — reescreve a lateral e a página Terminais para navegar por projeto (registo do Workflow), com um separador tipo browser por projeto aberto. `/implement-todo` → "Implementar a partir de uma spec"." · "Implementar a spec [[../docs/features/estilos-de-grelha|estilos de grelha]] (5 passos) — no modo Grelha, escolher entre 4 arranjos por projeto (Grelha 3×2, Colunas 2/3/4, 2×2, Principal + laterais) num botão no cabeçalho. `/implement-todo` → "Implementar a partir de uma spec"."

## 2026-10-21 — Login real verificado no Chrome do dono

- Com a extensão do Chrome já ligada, e o login feito pelo dono, verifiquei o item "Login a sério" do bloco Fundação: cai em `/terminals` com o nome `bino03`; o arranque (F5) nunca passa pelo `/login` (num iframe, 1411 amostras a cada 2 ms, sem o formulário de password); "Terminar sessão" mostra a confirmação e leva ao `/login`, com `/api/auth/me` e `/api/terminals` a darem 401 e o `/terminals` a voltar a pedir login.
- `AltGr+.`: a extensão também não o consegue gerar — envia `Ctrl+Alt+.` com `getModifierState('AltGraph') === false`, que `keyboard/shortcuts.ts` ignora de propósito (é assim que separa AltGr de Ctrl+Alt). Fica só ao teclado do dono.
- Files: `notes/verificacao-browser-pendente.md`, `notes/roadmap/backlog.md`
- Item original do ToDo: "(sem item — pedido direto do dono: «volta a tentar ligar-te ao chrome»; checklist em [[verificacao-browser-pendente]] → Fundação)"

## 2026-10-21 — `prefers-reduced-motion` verificado (bloco Fundação fechado)

- O arco "a trabalhar" em `/_tokens`: sem a preferência roda (`wfa-spin`, 1.4 s, o `transform` muda); com `prefers-reduced-motion: reduce` fica parado (`animation: none`). 2/2 em Chrome headless contra o dev server do dono (só leitura, a página não pede login), com a preferência **emulada** por `Emulation.setEmulatedMedia` — não com o interruptor do Windows, mas é a mesma media query que ele liga.
- Com o login real verificado antes, o bloco Fundação de [[verificacao-browser-pendente]] fica todo feito e a linha "Fundação" sai do backlog.
- Files: `notes/verificacao-browser-pendente.md`, `notes/roadmap/backlog.md`
- Item original do ToDo: "(sem item — checklist em [[verificacao-browser-pendente]] → Fundação: «`prefers-reduced-motion` ligado no SO → o arco "a trabalhar" em `/_tokens` fica parado»)"

## 2026-10-22 — Bot de Telegram com Remote Control (spec fechada)

- Do `/refine-idea` à spec ([[../docs/features/bot-telegram|bot-telegram]], [[../docs/adr/0017-bot-telegram-e-remote-control|ADR 0017]]) e aos 8 passos na mesma sessão. O bot (long polling, opcional, só o `TELEGRAM_ALLOWED_USER_ID` numa conversa privada) lista projetos e conversas, abre/retoma com `claude --remote-control` (nome "pasta · título"; numa conversa nova o automático), `/estado` e `/parar` (fica parado, não fechado). Só nomes, títulos, estados e quota vão para o Telegram — nunca conteúdo de terminal nem o token.
- Spike (passo 1, com o dono a ver o app Claude): o `--remote-control` arranca num PTY sem prompts, ao lado do `--settings`; o nome só chega numa conversa nova (ao retomar, a sessão remota é reutilizada); uma conversa vazia não aparece na lista do app — o dono recusou que o bot enviasse o link ("o claude abre logo a sessão na mobile app"). Confiança das pastas lida do `.claude.json`, com a pasta-mãe a contar → `TERMINAL_007`.
- No teste real o dono apanhou um bug: a lista de terminais só se relia ao ganhar foco, e com a janela do PC sempre focada o terminal reaberto pelo bot ficou "Parado" e o Reabrir deu `TERMINAL_006`. Corrigido com releitura de 10 em 10 s e o `TERMINAL_006` do Reabrir a reler e ligar.
- O dono colou o primeiro token do bot na conversa → revogado no `@BotFather` antes de usar (confirmado: 401). Nenhum segredo nos commits (verificado depois do push).
- Testes: 294 no backend (claudeArgs, claudeTrust, remoteName, TerminalsService com RC/stop, config, telegramApi, telegramBot com `TerminalsService` real), browser 11/11 + 3/3 numa instância isolada, bot real no telemóvel. Falha intermitente da suite e o erro de tipos antigo em `test/auth.test.ts` em [[bugs]].
- Files: `backend/src/telegram/*`, `backend/src/terminals/{claudeArgs,remoteName,terminalsService,spawnClaude}.ts`, `backend/src/sessions/{claudeTrust,claudeSessions}.ts`, `backend/src/state/state.schema.ts`, `backend/src/{config,app}.ts`, `backend/src/common/errors.ts`, `backend/scripts/remote-control-spike.ts`, `frontend/src/{types/terminal.ts,hooks/useTerminals.ts,pages/TerminalsPage.tsx,components/terminals/{TerminalPane,terminalDisplay}.ts*,errors/errorMessages.ts}`, docs (`adr/0017`, `features/bot-telegram`, `api`, `database`, `environment`, `security`, `architecture`, `code-map`)
- Item original do ToDo: "Implementar a spec [[../docs/features/bot-telegram|bot de Telegram com Remote Control]] (8 passos, começa por um spike) — retomar trabalho só com o telemóvel: o bot abre o terminal do projeto com `--remote-control` e continua-se no app Claude ([[../docs/adr/0017-bot-telegram-e-remote-control|ADR 0017]]). `/implement-todo` → "Implementar a partir de uma spec"." (veio de `ideas.md`: "Adicionar um bot no telegram para poder retormar projetos(/remote-control)")

## 2026-10-23 — Scripts de verificação no browser (`scripts/verify/`)

- O driver CDP e a instância de teste, reconstruídos no scratchpad em três sessões seguidas, passam a scripts versionados: `instance.mjs start|stop` (porta própria, login gerado a cada arranque, `DATA_DIR`/`ALLOWED_ROOTS`/`CLAUDE_CONFIG_DIR`/Workflow falsos, anula o `.env` do dono — `TELEGRAM_BOT_TOKEN` incluído —, paragem por `taskkill /T` ao PID da porta), `cdp.mjs` (driver sem dependências) e `smoke.mjs` (cenário de exemplo). Decidido: versionados na raiz, login gerado pelo start, só infra + 1 exemplo (os cenários antigos não se portam), `.mjs`.
- Testado: `start --fresh --sessions` → `smoke.mjs` 6/6 → um terminal `claude` aberto pela API → `stop --clean`: porta livre, `/api/health` 000, nem o pai do `tsx` nem `claude` filhos ficaram vivos; `--port 7400` recusado.
- Files: `scripts/verify/{instance,cdp,smoke}.mjs`, `docs/{commands,code-map,operations,environment}.md`, `notes/learning.md`
- Item original do ToDo: "Passar o driver de verificação por CDP e o arranque da instância de teste a scripts do projeto (ex.: `scripts/verify/`) — três sessões seguidas a reconstruí-los no scratchpad, que se perde. Base: o driver inline de `verify-tabs-grid.cjs` + `tabs-start.sh`/`tabs-stop.ps1`, da sessão de 2026-10-21 (scratchpad `063b02f3-…`) (o processo está descrito em [[learning]] → Ferramentas). ⚠️ onde vivem (pasta, versionados ou não) e se o login de teste é gerado por cada script."

## 2026-10-23 — Upload de skills contra a biblioteca real (spec fechada)

- Passo 6 da spec feito pela sessão, com o dono a aprovar a escrita no `WORKFLOW_PATH` partilhado (a regra "só o dono" era o guarda de permissões, não uma regra do projeto): instância de `scripts/verify/` com o Workflow real e login gerado, upload pela UI na stack `Tauri v2` → 18/18 (DOM, API 19→20 skills, disco, `git diff` de uma linha no `STACK.md`, consola limpa). Limpo a seguir, incluindo a pasta `skills/` que o `mkdir` cria e o `git status` não mostra; `git status` do Workflow limpo. Spec ✅ 6/6; cenário só no scratchpad (decidido: não se versionam cenários além do exemplo).
- Files: `docs/features/upload-de-skills.md`, `notes/verificacao-browser-pendente.md`, `notes/roadmap/backlog.md`; apagado `notes/skill-teste-upload.md`
- Item original do ToDo: "⏳ Spec [[../docs/features/upload-de-skills|upload de skills]] — código feito e **verificado no browser (39/39)**. Falta só um upload contra a biblioteca **real** do Workflow (`Tauri v2` ou `Rust + Axum`, nunca uma `proven`) e limpar a seguir: [[verificacao-browser-pendente]]."

## 2026-10-23 — Pré-visualização remota: spec, ADR 0018 e passos 1-7 (passo 8 por fazer)

- Pedido do dono no `/refine-idea` (ideia "Pré-visualizar", agora fora do `ideas.md`): ver no PC dele, fora de casa, a UI do projeto que corre num terminal, por um link só para ele. Decidido: `tailscale serve` na tailnet (não Cloudflare), link no Telegram **e** na app, ligado a pedido (`Alt+L` / `/preview`), desliga com o terminal ou o servidor de dev, Windows + Linux, o ADR não decide expor a própria app. Spec `docs/features/pre-visualizacao.md` + ADR 0018 via `/plan-feature`; medição de velocidade acrescentada ao passo 8 a pedido.
- Spike (passo 1): `serve` sem elevação em qualquer porta; com o Serve por ativar o CLI fica pendurado (→ tempo limite + `PREVIEW_007` com o link); 1.º HTTPS ~26 s (certificado); um servidor lançado pelo `claude` fica na árvore dele. O link só foi aberto no próprio desktop — prova noutro dispositivo adiada para o passo 8.
- Passos 2-7: `common/processTree.ts` (Windows+Linux; o fecho dos terminais no Linux passou a matar os sobreviventes) e `preview/listeningPorts.ts`; `preview/tailscale.ts` (só quatro formas de argumentos) + `TAILSCALE_BIN`/`PREVIEW_HTTPS_PORTS`; `preview/previewService.ts` (ciclo de vida, limpeza só da gama, `PREVIEW_001`–`007`); rotas `POST`/`DELETE /api/terminals/:id/preview`; `/preview` no bot e o link enviado ao Telegram quando se liga pela app; UI com `Alt+L`, etiqueta 🔗 + ✕ e seletor de portas. 355 testes do backend, chamadas reais contra o Tailscale e um `claude` real, browser 20/20 (com respostas intercetadas por CDP — `scripts/verify/cdp.mjs` ganhou `on()`).
- `TAILSCALE_BIN` posto no `backend/.env` do dono e backend reiniciado; passo 8 (servidor de dev verdadeiro, PC fora de casa, medições, bot real) fica para uma sessão com o dono.
- Falha intermitente dos testes com PTYs reais a piorar (11 timeouts numa corrida) → [[bugs]] com os nomes e passou ao ToDo.
- Files: `backend/src/{common/processTree,preview/*,terminals/{spawnClaude,terminalsService},telegram/*,keybindings/catalog,config,app}.ts`, `backend/test/{processTree,listeningPorts,tailscale,previewService,preview.routes,telegramPreview}.test.ts`, `backend/scripts/preview-spike.ts`, `frontend/src/{types/terminal,services/terminalService,hooks/useTerminals,pages/TerminalsPage,components/terminals/{TerminalPane,PreviewPortsModal},errors/errorMessages}.ts*`, `scripts/verify/cdp.mjs`, docs (`adr/0018`, `features/pre-visualizacao`, `api`, `security`, `environment`, `database`, `code-map`, `commands`, `operations`, `skills/references/design/drawers-and-modals`)
- Item original do ToDo: "Implementar a spec [[../docs/features/pre-visualizacao|pré-visualização remota]] (8 passos, começa por um spike) — ver no meu PC, fora de casa, a UI do projeto que está a correr num terminal: link `tailscale serve` só da minha tailnet, pedido por atalho ou `/preview`, entregue no Telegram e na app ([[../docs/adr/0018-pre-visualizacao-por-tailscale-serve|ADR 0018]]). **Antes: instalar o Tailscale** no desktop e no PC, mesma conta, MagicDNS + HTTPS ligados. `/implement-todo` → "Implementar a partir de uma spec"." (o item continua no ToDo, reescrito para o passo 8)

## 2026-10-25 — Falhas intermitentes do `npm test` do backend

- Causa medida: cada fecho de um PTY real custa ~1,6 s no Windows (powershell 0,35 s + o node-pty reporta a saída ~1 s tarde — `FLUSH_DATA_INTERVAL`), os hooks fecham vários, o `hookTimeout` era o de omissão (10 s) e ~7 ficheiros com processos corriam em paralelo. Reproduzido a pedido com 6 processos de CPU em ciclo (1 falha na base). **Encurtar a graça foi experimentado e revertido**: não poupava nada e punha o teste do "exit 130" a correr contra o `taskkill`.
- Correção: `hookTimeout` 30 s; projeto Vitest `processes` (os 9 ficheiros com processos reais, `maxWorkers: 3`, corre depois do `unit`); `removeDir` com retries para o EPERM das pastas temporárias; o teste de MAX_TERMINALS espera pelo `ready`. E, com aprovação do dono a meio (era "só testes"), um bug de produção: `killProcessTree` caía no `kill()` do node-pty depois de o `taskkill` falhar num processo **já morto** — o helper do node-pty liga-se à consola desse PID (que o Windows reutiliza) e mata os processos de lá; teste novo que falhava antes.
- Prova: 5/5 corridas seguidas com 6 processos de carga (66-68 s, 356/356), e 1/1 com 9 (antes: 2 falhas). Fica no [[bugs]] um `Worker exited unexpectedly` raro (1 em 22 corridas depois da correção) sem causa provada — o diagnóstico de "sem evento exit" não servia (nenhum worker emite `exit`). A carga foi simulada, não com o browser do dono aberto.
- Files: `backend/vitest.config.ts`, `backend/src/terminals/spawnClaude.ts`, `backend/test/{helpers,terminalManager,terminalsService,telegramBot,terminals.routes,terminals.gateway,preview.routes,folders.sessions.routes}.test.ts` (+ `helpers.ts`), `docs/{commands,backend-conventions}.md`
- Item original do ToDo: "Acabar com as falhas intermitentes do `npm test` do backend — timeouts de testes/hooks com PTYs reais sob carga, cada vez mais frequentes (11 numa corrida a 2026-10-23); nomes, durações e hipóteses (`hookTimeout`, `closeGraceMs` curto nos testes) em [[bugs]]. Feito quando 5 corridas seguidas da suite passarem com o browser aberto."

## 2026-10-25 — Importar para a biblioteca (spec fechada, 11/11)

- Na Biblioteca, **Importar**: skill, design ou stack, a partir de ficheiros/pasta, URL, projeto local ou descrição. A app escreve o pedido num ficheiro e lança a skill `/import` **do Workflow** num terminal escondido (prompt inicial + `--add-dir` + `--settings` com hooks; nada do cliente na linha de comando); segue-a por `result.json` e pelo último hook; no fim, revisão do diff → Aceitar (commit no Workflow com `GIT_BIN`) ou Descartar. **Porquê assim**: o dono quis a lógica "no vault, não na app" — as skills do Workflow já fazem a triagem, a forma fixa, o contraste, o registo e a proveniência. Saiu o upload direto (ADR 0014 → ADR 0019); no Workflow, ADR 0010, `/import`, contrato `docs/import-contract.md`, "Modo importação" nas três skills e allowlist.
- Verificado: spike (o prompt posicional corre como 1.ª mensagem; o `--add-dir` é variádico, vai primeiro); 407→363 testes (+novos, −os do upload); HTTP real em instâncias de `scripts/verify/` (`--git-workflow`, `--real-claude` novos); browser 32/32 com a skill simulada; **ponta a ponta com o `claude` e o Workflow reais pela UI, 23/23**, tudo descartado e o Workflow limpo.
- Achados: uma importação corrigiu sozinha o `tools/audit-library.mjs` do Workflow, aprovada pelo **auto mode** do dono → o `/import` e o contrato só deixam escrever em `library/**` e `docs/provenance.md`, e a revisão assinala o resto; o bug que a skill viu era real (a auditoria tratava `library/external/*/skill-*.md` como skill) e ficou corrigido no Workflow; um `result.json` inválido passa a dizer o campo.
- Files: `backend/src/imports/*`, `backend/src/terminals/{claudeArgs,terminalsService}.ts`, `backend/src/{state/state.schema,usage/usageFiles,config,app,common/errors}.ts`, `backend/src/library/*` (sai o upload), `backend/test/{imports.routes,importService,importFiles,stagingFiles,workflowGit,claudeArgs,terminalsService,stateStore,library}.test.ts`, `backend/scripts/import-spike.ts`, `frontend/src/components/library/{ImportDrawer,ImportBanner,ImportPanel,ImportReviewDrawer,importFormSchema}.ts*`, `frontend/src/{hooks/useCurrentImport,services/importService,types/imports}.ts`, `frontend/src/pages/{LibraryPage,TerminalsPage}.tsx`, `frontend/src/index.css`, `scripts/verify/instance.mjs`, docs (ADR 0019, api, database, security, architecture, code-map, environment, commands, use-cases, vocabulário, design/*). Workflow: `2ab86d6`, `1cb3b7b`, `bf2b5cd`, `a3bb5a3`.
- Item original do ToDo: "Spec [[../docs/features/importar-para-a-biblioteca|importar para a biblioteca]] (11 passos, nada feito) — botão **Importar** na Biblioteca: skills, designs e stacks (backend/frontend/…) a partir de ficheiros, URL, projeto local ou descrição; a app corre a skill nova `/import` **do Workflow** num terminal escondido e no fim mostra o diff para Aceitar (commit no Workflow) ou Descartar. Substitui o upload direto (ADR 0014 → ADR 0019 novo). Começa por um spike (prompt inicial + hooks). `/implement-todo` → "Implementar a partir de uma spec". (veio de `ideas.md`: "Acrescentar uma skill ou um design à biblioteca sem mexer no terminal")"

## 2026-10-26 — Novo projeto guiado: passos 1-9 (passo 10 por fazer, com o dono)

- Ecrã **Novo projeto**: o dono escreve a ideia e o `/create` **real** do Workflow corre numa sessão escondida; cada `AskUserQuestion` vira cartões, cada permissão Permitir/Recusar, as perguntas abertas uma caixa de texto, a conversa (do `.jsonl`) mensagens e linhas curtas, e no fim **Abrir projeto**. **Porquê assim**: o dono quis o mesmo `/create`, sem terminal, e sem duplicar a entrevista na app — por isso hooks **bloqueantes** (`PreToolUse` com `updatedInput.answers`, `PermissionRequest`) e nada lido do ecrã (ADR 0020). No Workflow, "Modo app" do `/create` (brief por ficheiro, escolhas sempre por `AskUserQuestion`, `result.json`), ADR 0011.
- Achados: (1) o modo por omissão desta conta é `auto`, que aprova tudo — sem `--permission-mode default` o `PermissionRequest` nunca chega (a mesma raiz do `audit-library.mjs` editado na importação); (2) no Windows o Claude correu o renderizador pela ferramenta **PowerShell**, fora da allowlist `Bash(…)` → o modo app manda usar a `Bash`; (3) ler o destino pedia permissão → o `--settings` guiado permite ler nas `ALLOWED_ROOTS` e escrever em `DATA_DIR/guided/`; (4) um `ESC[201~` no texto do dono fecharia o paste → o texto perde os caracteres de controlo.
- Verificado: spike com o `claude` real (incluindo 10 min bloqueado); 413 testes (+50); o motor de produção com o `claude` real (`guided-engine-check.ts`); o `/create` real por HTTP até à proposta (2×); browser `/_guided` 30/30 e `/new-project` 30/30 (com a skill simulada). **Não verificado ainda**: uma criação completa com o `/create` real pela UI (passo 10).
- Files: `backend/src/guided/*`, `backend/src/creation/*`, `backend/src/terminals/{claudeArgs,terminalsService,paste}.ts`, `backend/src/{state/state.schema,common/errors,app}.ts`, `backend/test/{guidedHook,guidedService,guided.routes,transcriptFeed,creation.routes,claudeArgs}.test.ts` + `fixtures/guided-transcript.jsonl`, `backend/scripts/{guided-spike,guided-engine-check,create-app-dry-run}.ts`, `frontend/src/{components/guided/*,components/common/Markdown.tsx,hooks/useGuidedSession.ts,services/{guided,creation}Service.ts,types/guided.ts,pages/NewProjectPage.tsx,pages/dev/GuidedPreviewPage.tsx,layouts/AppLayout.tsx,components/terminals/ProjectTabs.tsx,errors/errorMessages.ts,index.css,main.tsx}`, `frontend/package.json` (react-markdown, remark-gfm), docs (ADR 0020, api, database, security, architecture, code-map, use-cases, overview, domain-brief, vocabulário, design/guided-session + router + tokens + app-shell). Workflow: `b8097ad`, `70fc43c`.
- Item original do ToDo: "Spec [[../docs/features/novo-projeto-guiado|novo projeto guiado]] (10 passos, nada feito) — ecrã **Novo projeto**: escreves a ideia e o `/create` do Workflow corre numa sessão escondida; as escolhas aparecem como cartões, as perguntas abertas como mensagens com caixa de resposta, as permissões como Permitir/Recusar, e o progresso legível — sem terminal. A base (terminais escondidos, prompt inicial, `--settings` com hooks) **já está feita** pela spec de importação (✅ 2026-10-25). Começa por um spike dos hooks. `/implement-todo` → "Implementar a partir de uma spec". (veio de `ideas.md`: "Lançar o `/create` por formulário")" — continua no ToDo, com o passo 10.

## 2026-10-26 — Novo projeto guiado: passo 10 com o dono (spec ✅ 10/10)

- O `/create` real gerou a **Estante** de ponta a ponta só pela UI, numa instância de `scripts/verify/` com o Workflow e o `claude` reais: 46 min do Começar ao fim (com ~10 min de espera a meio), 18 min de geração. **Todas** as escolhas chegaram como cartões (incluindo o E5); texto livre só no bloco A. **Porquê importa**: era a única coisa que não tinha corrido com o `/create` real — a geração, as permissões e o fim.
- Achados: (1) `"error": null` num resultado `done` dava "result.json inválido" — o contrato diz `error?` e o Claude escreveu `null`; corrigido nos dois contratos (criação e importação), `f2e2acf`. (2) **53 permissões**, quase todas leituras/edições no destino — as permissões do `--settings` fixam-se antes de o destino existir → seguimento no ToDo, com o modo Automático que o dono pediu. (3) Texto colado com bocados em falta: o mesmo texto colado no `claude` real pelo caminho da app chegou intacto 2/2 → causa provável: a cópia do terminal. (4) O destino em `projetos/` ficou fora das roots da instância de teste, por isso o Abrir projeto recusou — esperado ali.
- Também nesta sessão: **Novo projeto** passou para a direita do header (pedido do dono; `e9cf3d9`).
- Limpo: a Estante apagada, o Workflow sem alterações (os achados da biblioteca ficaram no `notes/ToDo.md` do Workflow, a pedido do dono, dentro da sessão), a instância parada.
- Item original do ToDo: "Spec novo projeto guiado — 9/10 passos feitos… falta só o passo 10, comigo" — saiu; entrou o seguimento "menos permissões e modo Automático".

## 2026-10-26 — Sessões guiadas: menos permissões e modo Perguntar / Automático (ADR 0021)

- **Porquê**: a primeira criação real (Estante) pediu 53 permissões, 45 delas ferramentas de ficheiros dentro do destino que o próprio `/create` gerava — o `--settings` fixa-se antes de o destino existir. O dono pediu um seletor como o Shift+Tab do terminal.
- **O quê**: (1) o `/create` em modo app escreve `destination.json` logo a seguir ao "Gerar" (Workflow, `skill-create.md`); o hook aprova sozinho `Read`/`Glob`/`Grep`/`Edit`/`Write`/`MultiEdit`/`NotebookEdit` lá dentro, só se o destino estiver dentro de uma `ALLOWED_ROOTS` sem ser uma, longe do Workflow e do `DATA_DIR`, e for **novo** (não existe ou nasceu depois do início da sessão) — um `destination.json` a apontar para um projeto antigo continua a pedir. (2) Seletor **Permissões: Perguntar / Automático** no cabeçalho da sessão (`PUT /api/guided/:id/mode`); Automático aprova também as permissões já à espera; as perguntas continuam cartões. (3) O modo e o início vivem em `DATA_DIR/guided-control/<id>.json`, que só o backend escreve — fora de `guided/**`, onde o Claude escreve sem perguntar.
- **Porque não o auto mode do Claude Code** (Shift+Tab no PTY): percorre modos às cegas — a app não saberia em que modo ficou. Fica registado no ADR 0021.
- Verificado: 420 testes (+7: o hook real com modo/destino/proteções, `setMode`, a rota); browser 14/14 (seletor, permissão à espera aprovada pela troca, o hook real em `auto`, Fechar apaga o controlo). **Não verificado**: a contagem numa criação real — em [[verificacao-browser-pendente]].
- Files: `backend/src/guided/{guidedFiles,guidedService,guided.routes,guided.schemas}.ts`, `backend/src/app.ts`, `backend/test/{guidedHook,guidedService,guided.routes}.test.ts`, `frontend/src/{pages/NewProjectPage.tsx,services/guidedService.ts,types/guided.ts}`, docs (ADR 0021, api, database, security, code-map, design/guided-session). Workflow: `docs/skills/skill-create.md`.
- Item original do ToDo: "Novo projeto guiado — menos permissões e modo Automático (pedido do dono no passo 10…)" — saiu.

## 2026-10-26 — Upwork: passos 1-3 (ADRs, skill `/upwork-proposal`, propósito guiado `upwork`)

- **Passo 1**: ADR 0022 (app) e ADR 0012 (Workflow). Dois desvios à spec, registados no ADR: o URL do job **não vai para o `job.md`** (a skill não precisa dele — a forma mais simples de não o abrir) e o hook **recusa `WebFetch` a `upwork.com`** nas sessões `upwork` (a allowlist do Workflow aprova `WebFetch`, nunca haveria cartão). O dono decidiu: perfil com as secções propostas, Connects/Boost só qualitativo, **Upwork à esquerda de "Novo projeto"** no header.
- **Passo 2**: `/upwork-proposal` no Workflow (`033d2dc`): modo app (contrato `job.md`/`profile.md`/`package.json` por último, sem `result.json`) e modo terminal; regras (nunca abrir a Upwork, nunca inventar, sem preço). Verificado **seguindo a skill à mão** numa pasta de teste — a passagem apanhou uma afirmação inventada ("two production projects"), e a skill ganhou o passo de reler cada afirmação contra o perfil. **Não verificado**: invocada de verdade num terminal — passo 11, com o dono.
- **Passo 3**: propósito `upwork` no `GuidedService` (sem fim por `result.json`, `suspend`, ficheiros extra no arranque), o propósito no `guided-control` e a regra do hook. Testes: 48/48 nos três ficheiros tocados (+9); `npm test` completo 428/428 quando o worker não morre — o `Worker exited unexpectedly` conhecido apareceu 3 em 4 corridas, e **1 em 3 também no `HEAD` sem as alterações** (anotado em `notes/bugs.md`). `tsc` só com o erro conhecido de `test/auth.test.ts:40`; lint limpo.
- Files: `docs/adr/{0022-seccao-upwork,README}.md`, `docs/features/upwork.md`, `docs/{api,database,security}.md`, `docs/skills/references/project-vocabulary.md`, `backend/src/guided/{guided.schemas,guidedFiles,guidedService}.ts`, `backend/src/terminals/{claudeArgs,terminalsService}.ts`, `backend/test/{claudeArgs,guidedHook,guidedService}.test.ts`, `frontend/src/types/guided.ts`. Workflow: `docs/adr/0012-upwork-proposal.md`, `docs/skills/skill-upwork-proposal.md`, ponteiro, índices.
- Item original do ToDo: "Spec [[../docs/features/upwork|Upwork]] (11 passos, nada feito) — …" — fica no ToDo (spec em curso, 3/11).

## 2026-10-26 — Upwork: passo 4 (módulo `upwork` no backend: perfil e registo)

- `backend/src/upwork/`: perfil em `DATA_DIR/upwork/profile.md` (GET devolve o modelo inicial com as secções decididas pelo dono enquanto não há perfil), candidaturas em `applications/<id>/application.json` (zod, escrita atómica, só o backend). POST cria o registo **e** a sessão guiada `upwork` (`job.md` sem o URL + cópia do perfil); sem perfil → `UPWORK_002`; URL só `https://www.upwork.com/…`. PATCH livre, com histórico só quando o estado muda.
- Verificado: `upwork.routes.test.ts` 8/8 com o `GuidedService` real e o `claude` falso; as rotas chamadas por HTTP numa instância de verificação (`instance.mjs --git-workflow`, `claude` sem login — sem quota). `npm test` 42/42 numa corrida; o `Worker exited unexpectedly` conhecido noutra. `tsc` só com o erro conhecido; lint limpo.
- Ficou para o passo 5 (como na spec): pausar ao enviar, `/pause`, `/message` com retoma, `/archive`, `DELETE`, ler o pacote.
- Files: `backend/src/upwork/*`, `backend/src/app.ts`, `backend/src/common/errors.ts`, `backend/test/upwork.routes.test.ts`, `frontend/src/errors/errorMessages.ts`, docs `api`, `database`, `code-map`, `features/upwork`.
- Item original do ToDo: "Spec [[../docs/features/upwork|Upwork]] …" — fica (4/11).

## 2026-10-26 — Upwork: passo 5 (pacote, pausa, retomar ao escrever, arquivo)

- **Porquê o desenho da retoma**: o `GuidedService.resume` escreve um `Stop` sintético logo, mas medido com o `claude` real um paste nessa altura **perde-se** — tanto logo após o spawn como no instante do `SessionStart`. O que funciona é `SessionStart` + 1 s de ecrã quieto (4/4). Por isso: hook `SessionStart` nas sessões guiadas, `TerminalsService.waitForQuiet`, e `GuidedService.message` acorda sozinho as sessões `upwork` paradas (`wake`); a rota da candidatura só delega. Provado depois pelo caminho de produção com o `claude` real (3/3, 2,7–5,5 s).
- Pacote: `packageReader.ts` lê o `package.json` (zod; nomes `.md` sem pastas — um `../../secret.md` dá `packageError`, nada lido). `PATCH sent` e `/pause` pausam; `/archive` copia o pacote para `applications/<id>/package/` e apaga a sessão; `DELETE` apaga tudo.
- Verificado: 447/447 numa corrida completa; o `Worker exited` conhecido noutras; uma falha única no teste do destino do hook (ADR 0021), não reproduzida em 9 corridas — anotada em `notes/bugs.md`. `tsc` só o erro conhecido; lint limpo.
- Files: `backend/src/guided/{guidedFiles,guidedService}.ts`, `backend/src/terminals/terminalsService.ts`, `backend/src/upwork/{packageReader,upworkService,upwork.routes}.ts`, `backend/test/{guidedHook,guidedService,terminalsService,upwork.routes}.test.ts`, docs `api`, `database`, `code-map`, `features/upwork`.
- Item original do ToDo: "Spec [[../docs/features/upwork|Upwork]] …" — fica (5/11).

## 2026-10-26 — Upwork: passo 6 (criar projeto a partir de uma candidatura ganha)

- `POST /api/upwork/applications/:id/project`: só `won` (`UPWORK_003`); o acordo colado fica no registo; o brief (anúncio + carta enviada + plano + acordo, por esta ordem) começa uma criação à parte no Novo projeto, pelo `CreationService` por dentro — `CREATE_001` se já há uma. O `projectPath` da criação passa para a candidatura ao lê-la.
- **Porque o corte do brief não é no fim**: cortar no fim cortava o acordo, que é o que foi combinado com o cliente. Acima de 60 000 cedem a carta e o plano (os únicos sem teto baixo); o anúncio e o acordo (≤ 20 000 cada) ficam inteiros.
- **Lacuna fechada**: o anúncio só existia no `job.md` da sessão, que se apaga ao arquivar — agora há uma cópia em `applications/<id>/job.md`.
- Verificado: 455/455 na suite completa; +4 testes de rota e `upworkFiles.test.ts`; as rotas por HTTP numa instância de verificação. `tsc` só o erro conhecido; lint limpo.
- Files: `backend/src/upwork/{upworkFiles,upworkService,upwork.routes,upwork.schemas}.ts`, `backend/src/creation/creationService.ts`, `backend/src/app.ts`, `backend/test/{upwork.routes,upworkFiles}.test.ts`, docs `api`, `database`, `features/upwork`.
- Item original do ToDo: "Spec [[../docs/features/upwork|Upwork]] …" — fica (6/11).

## 2026-10-26 — Upwork: passo 7 (frontend: página, lista e navegação)

- Página `/upwork` em mestre-detalhe, com o item **Upwork** à esquerda de Novo projeto; lista de candidaturas em cards (estado e veredicto como tags), filtro por estado e chip **Arquivadas**, e os dois estados vazios (sem perfil / sem candidaturas). Serviço já com todas as rotas do backend para os passos 8-9. Verificado em Chrome headless (16/16).
- Files: frontend/src/{types/upwork.ts, services/upworkService.ts, hooks/useUpworkApplications.ts, pages/UpworkPage.tsx, components/upwork/ApplicationList.tsx, components/upwork/upworkFormat.ts, main.tsx, layouts/AppLayout.tsx}; docs/{features/upwork.md, code-map.md, skills/references/design/app-shell-and-auth.md, skills/references/design/tables-and-lists.md}
- Item original do ToDo: "Spec [[../docs/features/upwork|Upwork]] (11 passos, …) — passo 7. Frontend: tipos, serviço, hook, página e navegação"

## 2026-10-26 — Upwork: passo 8 (drawers Perfil e Nova candidatura)

- Drawer **Perfil** (edita o `profile.md`, com o modelo inicial na primeira vez) e drawer **Nova candidatura** (anúncio, perguntas de triagem uma por linha, link da Upwork só guardado). Sem perfil, Nova candidatura leva ao Perfil. Texto colado sem lista branca de caracteres (um anúncio traz "$", "{}") — exceção agora escrita em forms-and-validation §4.2. Chrome headless 18/18 + 4/4 (UPWORK_002 real).
- Files: frontend/src/components/upwork/{ProfileDrawer,NewApplicationDrawer}.tsx, frontend/src/components/upwork/upworkFormSchemas.ts, frontend/src/pages/UpworkPage.tsx; docs/{features/upwork.md, code-map.md, skills/references/design/forms-and-validation.md}
- Item original do ToDo: "Spec [[../docs/features/upwork|Upwork]] (11 passos, …) — passo 8. Perfil e Nova candidatura"

## 2026-10-26 — Upwork: passo 9 (detalhe da candidatura: Pacote, Conversa, Dados)

- A candidatura aberta à direita da lista: Pacote (cartões com Copiar; a gerar, cartões em espera e a conversa por baixo), Conversa (a mesma do Novo projeto, extraída para `GuidedConversation`, com Copiar nas mensagens do Claude; pausada, escrever retoma), Dados (estado com histórico, cliente, Connects, link, notas), e Pausar / Criar projeto / Abrir projeto / Arquivar / Apagar. Chrome headless 34/34 com a skill simulada. Um falso positivo no primeiro cenário (o "Apagar" passava sem `DELETE`) levou a confirmar cada ação na API.
- Files: frontend/src/components/upwork/{ApplicationDetail,PackageCards,ApplicationDataForm,CreateProjectModal}.tsx, upworkFormSchemas.ts, upworkFormat.ts; frontend/src/components/guided/{GuidedConversation,GuidedFeed}.tsx; frontend/src/components/common/CopyButton.tsx; frontend/src/hooks/useGuidedAct.ts; frontend/src/pages/{UpworkPage,NewProjectPage}.tsx; docs/{features/upwork.md, code-map.md, skills/references/design/guided-session.md, skills/references/design/drawers-and-modals.md}
- Item original do ToDo: "Spec [[../docs/features/upwork|Upwork]] (11 passos, …) — passo 9. Detalhe: Pacote, Conversa, Dados"

## 2026-10-26 — Upwork: passo 10 (cenário versionado + docs)

- `scripts/verify/upwork.mjs`: a secção Upwork de ponta a ponta, com a skill simulada pelos ficheiros que ela e o hook escreveriam — 34/34, smoke 6/6. Docs de produto e arquitetura atualizados; api/database/security já estavam desde o backend.
- Files: scripts/verify/upwork.mjs; docs/{commands.md, architecture.md, product/use-cases.md, product/overview.md, features/upwork.md}
- Item original do ToDo: "Spec [[../docs/features/upwork|Upwork]] (11 passos, …) — passo 10. Verificação no browser com a skill simulada + docs"

## 2026-10-27 — Upwork: menu de contexto na lista + o projeto nasce da candidatura inteira (ADR 0023)

- Pedido do dono a meio do passo 11: botão direito numa candidatura → **só o passo seguinte** do estado (e as saídas
  Perdida/Retirada; um rascunho só se retira), com confirmação que diz o efeito; numa ganha, **Novo projeto** com "o
  contexto todo". Decidido com ele: o limite "só o seguinte" vale **só no menu** (os Dados continuam livres, ADR 0022
  ponto 6); o brief passa a levar **a candidatura inteira** — anúncio, carta, plano, perguntas ao cliente, **a conversa**
  (onde está a negociação), notas — e o **acordo fica opcional**; extras: Copiar carta, Abrir anúncio, Arquivar/Apagar.
  Confirmação com `useConfirm` e não `Popconfirm` (convenção; o menu fecha e o Popconfirm ficava sem âncora).
- Porquê o ADR 0023: o ponto 7 do 0022 fixava o brief em anúncio + carta + plano + acordo obrigatório.
- As ações (estado, arquivar, apagar, abrir projeto, copiar) saíram do `ApplicationDetail` para
  `hooks/useApplicationActions.ts`, usado pelo menu e pelo detalhe; o detalhe aberto relê-se quando o menu o altera.
- Verificado: backend 457/457 (brief: ordem, a conversa cede primeiro das mais antigas, depois carta/plano/perguntas);
  Chrome headless `upwork-menu.mjs` 26/26 (clique direito real, Shift+F10, brief lido do disco), `upwork.mjs` 34/34,
  `smoke.mjs` 6/6. De caminho: reposta a spec da Upwork, que o passo 8 tinha duplicado (`String.replace` com `` $` ``).
- Files: backend/src/upwork/{upworkFiles,upworkService,upwork.schemas}.ts; backend/test/{upworkFiles,upwork.routes}.test.ts;
  frontend/src/components/upwork/{ApplicationContextMenu,ApplicationList,ApplicationDetail,CreateProjectModal,upworkFormat,upworkFormSchemas}.{ts,tsx};
  frontend/src/hooks/useApplicationActions.ts; frontend/src/pages/UpworkPage.tsx; scripts/verify/{upwork-menu,upwork}.mjs;
  docs/{adr/0023-brief-com-a-candidatura-inteira.md, adr/0022-seccao-upwork.md, adr/README.md, api.md, code-map.md,
  commands.md, features/upwork.md, skills/references/design/tables-and-lists.md}
- Item original: pedido direto do dono (não estava no ToDo).

## 2026-10-27 — Prints a anexar nas candidaturas Upwork (ADR 0024)

- O `/upwork-proposal` (Workflow `927afe9`) escolhe 3-6 prints dos catálogos `screenshots.json` do portfólio e escreve
  `attachments.json` ao lado do pacote (o `package.json` fica na `version: 1`). A app lê-o, mostra o cartão **Prints a
  anexar** a seguir à carta (miniaturas, Copiar legenda/legendas, Descarregar com o nome para a Upwork, projetos sem
  prints) e serve cada imagem **por posição**, só de `PORTFOLIO_PATH/public/images/projects/` (opcional), com
  `realpath` dentro da pasta. Arquivar guarda a lista.
- Testado: backend 47/47 nos ficheiros tocados (+ suite inteira), `typecheck` só com o erro antigo de
  `test/auth.test.ts:40`; `upwork-attachments.mjs` 17/17 (novo, com prints reais do SIGA), `upwork.mjs` 34/34,
  `upwork-menu.mjs` 26/26, `smoke.mjs` 6/6. **Nunca corrido com uma candidatura real** (a skill nunca escreveu um
  `attachments.json` a sério).
- Files: `backend/src/upwork/{attachmentsReader,upworkService,upwork.routes,upwork.schemas}.ts`, `backend/src/{config,app}.ts`,
  `backend/src/common/errors.ts`, `backend/test/{upwork.routes,config}.test.ts`, `backend/.env.example`,
  `frontend/src/components/upwork/{AttachmentsCard,PackageCards,ApplicationDetail}.tsx`, `frontend/src/{types/upwork,services/upworkService,errors/errorMessages}.ts`,
  `scripts/verify/{instance,upwork-attachments}.mjs`, `docs/adr/{0024-prints-do-portfolio-nas-candidaturas,README}.md`,
  `docs/{api,environment,code-map,security,commands}.md`
- Item original do ToDo: — (pedido do dono: "gostava nessa mesma cover letter que fosse selecionado certos projetos
  que eu já fiz e que ficasse lá colocado as várias prints")

## 2026-10-27 — Upwork: o "Atualizado" do pacote passa a vir do disco

- No passo 11 o dono pediu "tira os links" à carta: reescrita bem, mas o `package.json` ficou com `updatedAt` 12:10 para
  uma escrita às 16:40 — o modelo não tem relógio. `readPackage` usa agora o mtime mais recente do manifesto e das
  partes; `archive` preserva os mtimes na cópia. +1 teste; backend 467/467.
- Files: backend/src/upwork/{packageReader,upworkService}.ts; backend/test/upwork.routes.test.ts; docs/{api.md,features/upwork.md}

## 2026-11-01 — Aviso de limite da quota (modal só com OK)

- Três avisos, em qualquer página da app: janela de 5 h aos 90% e aos 100%, semanal aos 90%. Só fecha com OK (sem ✕,
  clique fora ou Esc). O OK fica no `localStorage` com o `resetsAt` da janela e vale até essa hora passar — não se
  compara por igualdade, porque o `resets_at` pode oscilar segundos entre leituras; o OK dos 100% cobre também o dos 90%.
  Uma janela já reposta nunca avisa. A sondagem de `/api/usage` passou para um `UsageProvider` único (lateral + aviso),
  o que prepara o `AccountsContext` da spec de contas. Verificado em Chrome headless: `usage-warning.mjs` 27/27, smoke 6/6.
- Decidido com o dono: OK no browser (não no servidor); semanal e 100% também; "mesma janela" = até a reposição passar.
- Files: frontend/src/{contexts/UsageContext.tsx,contexts/usageContextValue.ts,hooks/useUsage.ts,components/usage/{UsageLimitModal.tsx,usageLimits.ts},components/terminals/QuotaMeter.tsx,layouts/AppLayout.tsx}; scripts/verify/usage-warning.mjs; docs/{database,code-map,commands}.md; docs/skills/references/design/drawers-and-modals.md; docs/features/contas-do-claude.md
- Item original do ToDo: "- [ ] ⚠️ **Aviso aos 90% do limite da sessão** — quando a janela de 5 h (`fiveHour.usedPct` do `/api/usage`, já sondado a 60 s pelo `useUsage`) chega aos **90%**, aparece um modal em qualquer página da app que **só fecha com "OK"** (sem ✕, sem clicar fora, sem Esc). Mostra a percentagem e a hora a que a janela renova (`resetsAt`). Depois do OK não volta a aparecer **na mesma janela** (guardar o `resetsAt` já avisado); na janela seguinte volta a avisar. Não depende da spec [[../docs/features/contas-do-claude|Várias contas do Claude]]; quando essa existir, o aviso é da conta ativa e ganha o botão "Mudar para <outra conta>" (a 2.ª fase dessa spec). ⚠️ Por decidir: também avisar no limite semanal? O OK vale para todos os dispositivos (servidor) ou só para o browser (`localStorage`)? Um 2.º aviso aos 100%? (pedido direto do dono, 2026-11-01)"

## 2026-11-01 — Várias contas do Claude: spike (passo 1) e estado (passo 2)

- Spike `backend/scripts/accounts-spike.ts` com o dono (login da 2.ª conta, Claude Pro, `claude` 2.1.316). Todos os
  pressupostos do ADR 0027 confirmados: login por `CLAUDE_CONFIG_DIR`, `.jsonl` gravado através da junction de
  `projects/`, `--resume` de uma conversa da principal, skills/plugins/mods ligados, `mcpServers` copiado e preservado,
  status line com a quota da conta, `/login` como 1.ª mensagem, remoção por `unlink` + `rm` sem tocar no alvo. ADR → `aceite`.
- Descobertas (na spec §6/§7): servidores MCP com OAuth autenticam-se por conta; cada conta nova mostra os diálogos de
  primeira vez → decidido com o dono que o terminal de login fica aberto para os responder (sem copiar flags internas);
  `CLAUDE_CODE_CHILD_SESSION` herdado desliga as transcrições (a app já o filtra — só confundiu o spike).
- Passo 2: contas no `state.json` (`accounts`, `activeAccountId`, `primaryAccountLabel`, `accountId` nos terminais), com
  `.default()` e sem migração. Backend 470/470.
- Files: backend/scripts/accounts-spike.ts; backend/src/state/state.schema.ts; backend/src/terminals/terminalsService.ts; backend/test/{stateStore,terminalsService}.test.ts; docs/{database.md,features/contas-do-claude.md,adr/0027-varias-contas-do-claude.md}
- Item original do ToDo: "Spec [[../docs/features/contas-do-claude|Várias contas do Claude]] (10 passos, **0 feitos — 2026-11-01**) — …" (continua no ToDo)

## 2026-11-01 — Várias contas do Claude: pastas das contas (passo 3)

- `backend/src/accounts/accountDirs.ts`: cria a pasta da conta extra com as 6 junctions para a principal, copia os 3
  ficheiros e só a chave `mcpServers` antes de cada arranque, lê o login sem tokens, e remove com segurança (verifica
  que cada partilhada é link **e** que não há links escondidos mais fundo, só então `unlink` + `rm`). Um id que não é
  UUID nunca chega a um caminho. `ACCOUNT_001..005` adiantados do passo 6 (backend + frontend 1:1).
- Testes numa principal falsa: 11/11, incluindo "remover deixa `projects/` e `skills/` da principal intactos".
  Suite: 480/481 — a falha é intermitente e anterior (`guidedHook.test.ts`, um `.tmp` lido a meio do rename), 15/15 isolado.
- Files: backend/src/accounts/accountDirs.ts; backend/test/accountDirs.test.ts; backend/src/common/errors.ts; frontend/src/errors/errorMessages.ts; docs/{code-map.md,features/contas-do-claude.md}
- Item original do ToDo: a spec "Várias contas do Claude" (continua no ToDo)

## 2026-11-01 — Várias contas do Claude: lançar o claude na pasta da conta (passo 4)

- `AccountsService` mínimo (`resolve`/`activeAccountId`/`require`/`prepareLaunch`) e o `TerminalsService` a decidir a conta
  de cada lançamento: `create` (ativa ou `accountId`), importações e guiadas (ativa), `reopen` (a do terminal ou
  `accountId`, gravada — "Continuar noutra conta"). Confiança lida no `.claude.json` da conta. `launchEnv()` substitui o
  `CLAUDE_CONFIG_DIR` herdado só para as extra. O `prepareForLaunch` recria a pasta de uma conta que a perdeu.
- Testes: backend 491/491 (duas corridas). Por HTTP numa instância de teste: o `claude` da conta extra escreveu na pasta
  dela; conta inexistente → 404 `ACCOUNT_001`. O crash intermitente do worker também acontece no commit anterior (registado no ToDo).
- Files: backend/src/accounts/{accountsService,accountDirs}.ts; backend/src/terminals/{terminalsService,spawnClaude,terminalManager,terminal.schemas}.ts; backend/src/app.ts; backend/test/{terminalsService,spawnClaude,accountDirs,telegramPreview}.test.ts; frontend/src/types/terminal.ts; docs/{api,security,environment}.md; docs/features/contas-do-claude.md
- Item original do ToDo: a spec "Várias contas do Claude" (continua no ToDo)

## 2026-11-01 — Várias contas do Claude: quota por conta (passo 5)

- O `statusline.cjs` grava `usage-<id>.json` para um `claude` cujo `CLAUDE_CONFIG_DIR` é `DATA_DIR/accounts/<uuid>`, e
  `usage.json` para tudo o resto; `GET /api/usage` lê o da conta ativa (a lateral não muda de chamada).
- Testes: backend 495/495 (duas corridas); por HTTP numa instância de teste com a extra ativa → a quota dela.
- Files: backend/src/usage/{usageFiles,usage.routes}.ts; backend/src/app.ts; backend/test/usage.test.ts; docs/{api,database,code-map}.md; docs/features/contas-do-claude.md
- Item original do ToDo: a spec "Várias contas do Claude" (continua no ToDo)

## 2026-11-01 — Várias contas do Claude: API de contas (passo 6)

- `/api/accounts` (listar, criar, renomear, ativar, remover) e `POST /api/accounts/:id/login`, que abre um terminal
  visível na conta com `/login` como 1.ª mensagem (fica aberto para os diálogos de primeira vez, como decidido).
  Remover é recusado com um terminal da conta a correr; os terminais dela passam para a principal.
- Testes: backend 505/505 (`accounts.routes.test.ts` 8/8); por HTTP numa instância de teste 16/16.
- Files: backend/src/accounts/{accounts.routes,accounts.schemas,accountsService}.ts; backend/src/terminals/{claudeArgs,terminalsService,terminal.schemas}.ts; backend/src/app.ts; backend/test/{accounts.routes,claudeArgs,stateStore}.test.ts; docs/{api,code-map}.md; docs/features/contas-do-claude.md
- Item original do ToDo: a spec "Várias contas do Claude" (continua no ToDo)

## 2026-11-01 — Várias contas do Claude: tamanho do contexto (passo 7) — backend completo

- `contextTokens` lido do fim do `.jsonl` (último `usage` do assistente: input + cache creation + cache read, sem
  sidechains nem sintéticos); `GET /api/terminals/:id/context`; `/api/sessions` com `contextTokens` e `accountId`.
- Num `.jsonl` real de 29.9 MB: 396216 tokens, igual ao `usage`, em 2-6 ms. Backend 508/508; HTTP numa instância 5/5.
- Files: backend/src/sessions/{claudeSessions,sessions.routes}.ts; backend/src/terminals/{terminalsService,terminals.routes}.ts; backend/test/{claudeSessions,folders.sessions.routes,terminals.routes}.test.ts; frontend/src/types/session.ts; docs/api.md; docs/features/contas-do-claude.md
- Item original do ToDo: a spec "Várias contas do Claude" (continua no ToDo)

## 2026-11-03 — Várias contas do Claude: drawer "Escolher conta" (passo 8)

- Item "Conta: <nome>" por cima de Definições, drawer com a ativa, a quota de cada conta, adicionar (abre o terminal de login, com uma faixa), renomear e remover; a quota da lateral muda logo com a ativa.
- Porquê o desvio no `TerminalsPage`: o drawer vive no cabeçalho, e com `/terminals` aberto a página não monta de novo, por isso o `focusTerminalId` nunca era lido e o terminal de login não ganhava o foco. Passou a ser tratado num só sítio; `upwork.mjs` 34/34 confirma que os outros fluxos continuam bem.
- Verificado: `accounts.mjs` 37/37 (Chrome headless, `ACCOUNT_004` real), `smoke` 6/6, `usage-warning` 27/27, `tsc -b` e lint limpos. Sem login real: fica para o passo 10.
- Encontrado e deixado no ToDo: o OK do aviso de limite não distingue contas. No passo 10, confirmar o ecrã de tema antes do login.
- Files: frontend/src/{types/account.ts,services/accountService.ts,hooks/useAccounts.ts,contexts/{AccountsContext.tsx,accountsContextValue.ts,UsageContext.tsx,usageContextValue.ts},components/accounts/*,components/usage/usageLimits.ts,components/terminals/QuotaMeter.tsx,layouts/AppLayout.tsx,pages/TerminalsPage.tsx}; scripts/verify/accounts.mjs; docs/{commands.md,code-map.md,frontend-conventions.md,features/contas-do-claude.md,skills/references/design/drawers-and-modals.md}
- Item original do ToDo: a spec "Várias contas do Claude" (continua no ToDo)

## 2026-11-05 — Várias contas do Claude: conta por terminal e "Continuar noutra conta" (passo 9)

- Selo da conta na lateral e no cabeçalho do terminal, setinha "Noutra conta" ao lado do "+", "Continuar noutra conta" ao lado de Reabrir com o custo em tokens antes de confirmar, e seletor de conta em Retomar. Com uma só conta, nada disto aparece.
- Porquê `useConfirm()` e não um modal próprio, como a spec dizia: já traz o teclado e o loading, e o custo é só o conteúdo. Uma conta sem login aparece desativada (decisão do dono): abrir um terminal só para pedir o login deixava a conversa à espera.
- Bug do passo 4 apanhado aqui: a rota `/reopen` aceitava o `accountId` mas não o passava ao serviço, por isso a conversa reabria na conta antiga. O teste só chamava o serviço diretamente; acrescentei um teste da rota.
- Verificado: `accounts-terminals.mjs` 41/41 (Chrome headless, `--resume` confirmado na linha de comando do processo, login falso escrito à mão), `accounts` 37/37, `smoke` 6/6, backend 509/509, `tsc -b` e lint limpos. O `tsc` do backend só tem o erro já conhecido de `test/auth.test.ts`. Sem login real: fica para o passo 10.
- Encontrado e deixado no ToDo: num projeto vazio, os ícones da lateral também abrem um terminal (o "+" abre dois).
- Files: backend/src/terminals/terminals.routes.ts; backend/test/accounts.routes.test.ts; frontend/src/{types/terminal.ts,services/terminalService.ts,hooks/useTerminals.ts,pages/TerminalsPage.tsx,components/accounts/{AccountTag,AccountPicker}.tsx,components/accounts/accountLabel.ts,components/terminals/{TerminalSidebar,TerminalPane,ContextSizeNotice}.tsx,components/terminals/new/ResumeSessionModal.tsx}; scripts/verify/accounts-terminals.mjs; docs/{commands.md,code-map.md,product/use-cases.md,features/contas-do-claude.md,skills/references/design/drawers-and-modals.md}
- Item original do ToDo: a spec "Várias contas do Claude" (continua no ToDo)

## 2026-11-05 — Várias contas do Claude: o login passa a ser uma janela, não um separador

- Pedido do dono a meio do passo 10: adicionar uma conta abria um separador "projetos" (a pasta de `DEFAULT_CWD`), como se fosse um projeto. O terminal de login passa a ser escondido e aparece numa janela por cima da página, sem navegar.
- Porquê fechar o terminal no fim, ao contrário da decisão de 2026-11-01: escondido, ninguém o voltava a encontrar. Os diálogos de primeira vez respondem-se na janela, antes do Concluir.
- Porquê um terminal de login não conta como "a correr": o dono não o vê, por isso um esquecido (browser fechado a meio) impedia remover a conta sem haver nada para fechar. É substituído no login seguinte e termina ao remover a conta.
- Verificado: `accounts.mjs` 53/53 (reescrito), `accounts-terminals.mjs` 41/41, `smoke` 6/6, backend 512/512. A captura de ecrã apanhou o foco no ✕ em vez do terminal, corrigido com `autoFocus` no `TerminalView`. Sem login real: é o passo 10, que continua.
- Files: backend/src/terminals/terminalsService.ts; backend/src/accounts/accountsService.ts; backend/test/accounts.routes.test.ts; frontend/src/components/accounts/{AccountLoginModal,AccountsDrawer}.tsx; frontend/src/components/terminals/TerminalView.tsx; frontend/src/pages/TerminalsPage.tsx; scripts/verify/{accounts,accounts-terminals}.mjs; docs/{api.md,commands.md,code-map.md,features/contas-do-claude.md,skills/references/design/drawers-and-modals.md}
- Item original do ToDo: a spec "Várias contas do Claude" (continua no ToDo); pedido direto do dono

## 2026-11-05 — Menu de contexto nos terminais

- Botão direito num terminal da lateral ou no cabeçalho dele: Renomear, Dividir/Juntar (na grelha, Ampliar/Voltar), Pré-visualizar, Fechar; parado ou terminado, também Reabrir e Continuar noutra conta. Pedido pelo dono a meio do passo 10 da spec de contas, que continua por acabar.
- Porquê fora da área de texto: aí o botão direito é o do browser, para copiar e colar. Só ações que já existiam: o dono não quis Copiar caminho, Copiar comando de retomar, Parar sem fechar nem Abrir pasta (propostas, a resposta foi nenhuma).
- O menu age sobre o terminal clicado, não sobre o focado, por isso `toggleSplit` passou a `toggleSplitFor(id)`; o `Alt+\` usa-o com o principal e continua igual (verificado). Renomear um terminal fora do ecrã traz-o primeiro e abre o campo na volta seguinte, porque o foco do xterm.js fechava-o.
- Verificado: `terminal-menu.mjs` 42/42 (botão direito real por CDP), regressões na mesma passagem. Shift+F10 não foi testado: vem do padrão da lista Upwork, onde o browser dispara o mesmo `contextmenu`. Sem alterações no backend.
- Files: frontend/src/components/terminals/{TerminalContextMenu.tsx,terminalMenu.ts,TerminalSidebar.tsx,TerminalPane.tsx}; frontend/src/components/accounts/{accountLabel.ts,AccountPicker.tsx}; frontend/src/pages/TerminalsPage.tsx; scripts/verify/terminal-menu.mjs; docs/{commands.md,features/terminais.md,product/use-cases.md,skills/references/design/tables-and-lists.md}
- Item original do ToDo: nenhum; pedido direto do dono

## 2026-11-05 — Definições passam de drawer a página

- Rota `/settings` (`SettingsPage`): um índice fixo à esquerda e as secções seguidas, com a marca (`aria-current`) a acompanhar o scroll do `<main>` e o salto ao clicar. As secções saem de uma só lista, `settingsSections.ts` (`{ id, title, component }`): uma definição nova é uma linha, com título e entrada no índice. O `SettingsDrawer` e o `settingsOpen` saíram; o item do menu de utilizador navega.
- Porquê o título passou para a página: `ShortcutsSection` e `PasskeysSection` tinham o seu, e ficava repetido; agora só mantêm os botões. O layout dos terminais foi extraído para `LayoutSection`.
- Armadilha: o `<main>` do `AppLayout` é o mesmo em todas as rotas e guarda o scroll da anterior, por isso as Definições abriam a meio. A página põe-no a 0 ao montar. No cenário, esperar só pelo `pathname` não chega para saber que a página saiu: espera-se que as secções desapareçam.
- Verificado: `settings.mjs` 21/21 em Chrome headless (menu, índice, salto, scroll, layout no `localStorage`, captura de `Alt+Y` lida do servidor, voltar às Definições), `tsc -b` e build limpos. Sem backend.
- Files: frontend/src/pages/SettingsPage.tsx; frontend/src/components/settings/{settingsSections.ts,LayoutSection.tsx,ShortcutsSection.tsx,PasskeysSection.tsx}; frontend/src/{main.tsx,layouts/AppLayout.tsx,hooks/useLayoutMode.ts}; scripts/verify/settings.mjs; docs/{code-map.md,commands.md,skills/references/design/app-shell-and-auth.md,features/{terminais,atalhos-editaveis,contas-do-claude}.md}
- Item original do ToDo: "As Definições passam de drawer a página, separada por títulos, com um índice para distinguir o layout, os atalhos, as passkeys e o que vier a seguir: cada definição nova traz o seu título e a sua entrada no índice."

## 2026-11-05 — Esconder a lista de candidaturas na Upwork

- A lista da página Upwork esconde-se a pedido, com um botão no topo dela e o `AltGr+.` (a ação `toggleSidebar`, tratada na página com `useShortcuts`, sem atalho novo). Escondida, fica uma barra de 44 px com o botão para a mostrar, e o detalhe ocupa o espaço. Abrir uma candidatura não a esconde.
- A escolha vive no `localStorage`, na chave `workflow-app.upwork-list-collapsed`, à parte da da lateral dos Terminais (`workflow-app.sidebar-collapsed`): esconder uma não esconde a outra. Com o Perfil ou a Nova candidatura abertos o atalho não faz nada. O rótulo do catálogo passou a "Esconder / mostrar a lateral (Terminais e Upwork)". `docs/database.md` ganhou as duas chaves (a dos Terminais não estava lá).
- Verificado: `upwork.mjs` 47/47 (13 novos: 380 px → barra de 44 px, detalhe mais largo, chaves separadas, continua escondida após recarregar, atalho — com um `KeyboardEvent` sintético com `modifierAltGraph`, porque o CDP não simula AltGr —, atalho parado com um drawer aberto), `tsc -b` limpo, 14/14 nos testes de atalhos do backend. O `tsc --noEmit` do backend dá 1 erro numa rota de WebSocket que já existia sem estas alterações.
- Files: frontend/src/pages/UpworkPage.tsx; backend/src/keybindings/catalog.ts; scripts/verify/upwork.mjs; docs/{database.md,skills/references/design/buttons-and-icons.md}
- Item original do ToDo: "Esconder a lista de candidaturas na página Upwork, como a lateral dos Terminais, para ver uma candidatura com mais espaço."

## 2026-11-07 — Várias contas do Claude: passo 10, verificação na app real

- Passo 10 e último da spec, feito com o dono (o login da app). Backend e frontend arrancados pelo `/run`; Chrome com a extensão. Um terminal em cada conta mostra o email certo no `/status`; as quotas vêm separadas; uma conversa real da Principal continua na Secundária (mesmo Session ID, aviso de ~46 mil tokens antes); depois de reiniciar o backend as duas contas mantêm o login; remover uma conta de teste deixa os 133 `.jsonl` de `~/.claude/projects` (e `skills`, `plugins`, `dev-mods`) iguais.
- Porquê assim: o critério de aceitação pede prova na app real, não no cenário com login falso. Os terminais e a pasta descartável (`_wfa-verify-scratch`) foram criados e apagados por mim; o `.jsonl` dessa sessão fica em `~/.claude/projects` (conta no 133) por ser teste e não o apagar sem perguntar.
- Armadilha: depois de reiniciar o backend o cookie da app cai (401) e é preciso novo login da app; os logins do Claude não. Um `type` dado logo a seguir a abrir um terminal perde-se se o `claude` ainda estiver a carregar.
- Não verificado: o ecrã de tema antes do login de uma conta nova (o login da Secundária já existia).
- Files: docs/features/contas-do-claude.md (§5 passo 10, §6), docs/architecture.md, docs/features/terminais.md, docs/code-map.md
- Item original do ToDo: "Spec Várias contas do Claude (10 passos, 9 feitos — 2026-11-05; falta o 10, comigo: login real da 2.ª conta) — uma pasta de configuração por conta, login feito uma vez pela app, conta ativa no menu do cabeçalho ..."

## 2026-11-07 — O OK do aviso de limite passa a ser por conta

- O OK do aviso (90%/100% da janela de 5 h, 90% da semanal) guarda-se por conta no `localStorage`: `{<accountId>: {fiveHour90?, …}}`. Antes, um OK na conta A calava o aviso da B a 92% até a janela da A repor.
- Decisões do dono: o formato antigo, sem conta, lê-se como o da `primary` (era a única conta antes da feature); ao guardar um OK, poda-se os expirados de qualquer conta, sem depender da lista de contas; sem conta ativa ainda, o modal não avisa.
- Porquê `active.usage`: o modal lê a conta e a quota da mesma resposta (`/api/accounts`). Com `useUsage().usage` e a chave da conta ativa haveria um render com a conta nova e a quota da antiga. As duas rotas leem a mesma `readUsage`, por isso o valor é o mesmo.
- Verificado: `tsc -b` e lint limpos; `usage-warning.mjs` 40/40 em Chrome headless (14 novos: formato por conta, formato antigo, duas contas com o mesmo 92%, OK de uma conta que não cala a outra, poda de uma conta que já não existe); regressões `smoke` 6/6 e `accounts` 53/53.
- Armadilha de ferramenta: a instância de `scripts/verify/instance.mjs start` morria 4-8 s depois de arrancar quando o comando levava um pipe (`| tail`); lançada como tarefa em background, vive. Pareceu uma regressão do aviso (o backend morto fazia os checks "sem aviso" passar de graça e os "com aviso" falhar).
- Files: frontend/src/components/usage/{UsageLimitModal.tsx,usageLimits.ts}; scripts/verify/usage-warning.mjs; docs/{database.md,code-map.md,frontend-conventions.md,features/contas-do-claude.md}
- Item original do ToDo: "O OK do aviso de limite não distingue contas: `workflow-app.usage-warnings` guarda só `{fiveHour90: resetsAt, …}` (`components/usage/UsageLimitModal.tsx`), por isso, depois de dar OK na conta A, mudar para a conta B a 92% não avisa até a janela da A repor. [...]"

## 2026-11-07 — Os ícones de um projeto vazio já não abrem terminais

- Na lateral dos Terminais, com o filtro "a correr" desligado, a estrela, o "Retomar" e o "+" de um projeto **vazio** também ativavam o projeto, que abre um terminal: a estrela abria 1, o "Retomar" abria 1 além do modal e o "+" abria 2. O `IconButton` de `TerminalSidebar.tsx` agora para o clique e o Enter/Espaço (o `keydown` também chegava ao cabeçalho, que é um `role="button"`); o Esc continua a subir, como no `AccountPicker`.
- Porquê no `IconButton` e não num wrapper: cobre os três ícones de uma vez, e o botão de esconder a lateral, que não está no cabeçalho, não é afetado.
- Verificado: cenário novo `sidebar-empty-project.mjs` 16/16 em Chrome headless, confirmado pela API (nº de terminais) e por um Enter real (`keyDown` com `text`). **Com o código antigo falha 6 dos checks**, com os números do ToDo (estrela 1, "Retomar" 2, "+" 4 no total). Regressões: `smoke` 6/6, `terminal-menu` 42/42, `accounts-terminals` 41/41; `tsc -b` e lint limpos.
- Armadilha de ferramenta: a instância de `scripts/verify` voltou a ser morta por fora a meio de cenários (log sem erro, a acabar em pedidos 200), o que fez falhar `accounts-terminals` duas vezes (37/39 e 7/14). Repetido numa instância nova deu 41/41. Ver `notes/learning.md`.
- Files: frontend/src/components/terminals/TerminalSidebar.tsx; scripts/verify/sidebar-empty-project.mjs; docs/commands.md
- Item original do ToDo: "Os ícones do cabeçalho de um projeto **vazio** na lateral também ativam o projeto, que abre um terminal. [...] Causa: o `IconButton` de `TerminalSidebar.tsx` não para a propagação do clique, e o `<header>` chama `onSelectProject` [...]"

## 2026-11-07 — O `guidedHook.test.ts` já não lê o `.tmp` a meio do rename

- O `pendingFiles` do teste filtrava por `startsWith('pending-')`, e o hook escreve `pending-<id>.json.<pid>.tmp` antes do rename: um `waitFor(... length === 1)` podia ver só o temporário, e a leitura seguinte dava `ENOENT`. O filtro passa a `/^pending-.+.json$/`, que serve os 8 sítios que o usam.
- Só se corrigiu a parte do `.tmp` do item. O "Worker exited unexpectedly" ficou no ToDo (decisão do dono), com os dados de hoje: 2 de 4 corridas da suite, 508/512, ficheiro não identificado.
- Verificado: o filtro novo e o antigo sobre uma listagem a meio do rename (antigo devolve o `.tmp`, novo não); `guidedHook.test.ts` 8/8 corridas isoladas (15/15 testes cada); suite inteira 4 corridas sem nenhum `ENOENT`. Não reproduzi o `ENOENT` antes da correção (isolado passava sempre), por isso a prova é a do filtro, não a de uma falha que desaparece.
- Files: backend/test/guidedHook.test.ts
- Item original do ToDo: "Testes intermitentes no backend (vistos 2× em 3 corridas da suite inteira, 2026-11-01): `test/guidedHook.test.ts` → \"a destination the app does not accept keeps asking\" lê `pending-*.json` e apanha o `.tmp` a meio do rename [...] e um \"Worker exited unexpectedly\" do pool de forks [...]"

## 2026-11-08 — "Worker exited unexpectedly": causa apurada (segfault do node-pty), por resolver

- O worker que morre é um **segfault nativo do node-pty 1.1.0 (ConPTY) em Node v24.16.0 / Windows**: com `--pool=threads` o vitest sai com 139 (SIGSEGV) em 4 de 8 corridas do projeto `processes`. O pool de forks esconde o código e mostra só "Worker exited unexpectedly".
- Hipóteses afastadas com medição: carga/interferência entre workers (`--maxWorkers=1` também morre, 2/6, sem timeouts); `taskkill` por PID reutilizado a atingir o worker (instrumentação temporária ×8, nenhum alvo era um worker; revertida). Não é um ficheiro só: acontece em qualquer um que abra e feche PTYs.
- O `Cannot create process, error code: 87` (ConPTY) é o mesmo componente a falhar sem matar o processo (2/10 isolado, 1/5 na suite).
- `node-pty@1.2.0-beta.18` testada e revertida: sem segfault em 8 corridas, mas 2 testes de `terminalManager` falham sempre (timeout no Ctrl+C duplo e no kill após a graça). Não é substituto direto; levaria código novo e um ADR. Decisão fica com o dono.
- Nada de código ficou alterado (dependência e `spawnClaude.ts` repostos, `terminalManager.test.ts` 9/9 depois). Item **mantido** no ToDo, com a causa.
- Files: nenhum alterado; notes/ToDo.md; notes/roadmap/plans/2026-11-08-teste-worker-intermitente.md
- Item original do ToDo: "Teste intermitente no backend: um \"Worker exited unexpectedly\" do pool de forks (`[vitest-pool]: Worker forks emitted error`) [...] Sem causa conhecida [...]"

## 2026-11-08 — Informação dos projetos, passo 1: schema `projectInfos`

- Coleção `projectInfos` no `state.json` (`.default([])`, sem subir `STATE_VERSION`): URLs só `http(s)`, máx. 5 ambientes, 20 deploys por ambiente, `projectPath` único. 4 testes novos (ficheiro antigo lê-se sem migração, `javascript:`/21 deploys/6 ambientes/path repetido rejeitados).
- Files: backend/src/state/state.schema.ts, backend/test/stateStore.test.ts, docs/features/informacao-dos-projetos.md
- Item original do ToDo: "Spec informação dos projetos (7 passos, 0 feitos — planeada 2026-11-08) — página Projetos com a ficha de cada app…"

## 2026-11-08 — Informação dos projetos, passo 2: serviço, rotas e erros

- `backend/src/projectInfo/` com as 5 rotas `/api/project-infos` (listar, `PUT` que preserva os deploys dos ambientes com o mesmo `id`, apagar ficha, registar e apagar deploy), `PROJECT_001-003` e montagem em `app.ts`. Só projetos que o `GET /api/projects` devolve; `at` omitido = agora; o 21.º deploy empurra o mais antigo. 11 testes novos; suite do backend 527/527. `docs/api.md`, `docs/database.md` e `docs/code-map.md` atualizados.
- Files: backend/src/projectInfo/*, backend/src/common/errors.ts, backend/src/app.ts, backend/test/projectInfo.routes.test.ts, docs/{api,database,code-map}.md, docs/features/informacao-dos-projetos.md
- Item original do ToDo: "Spec informação dos projetos (7 passos, 1 feito — 2026-11-08) — página Projetos com a ficha de cada app…"

## 2026-11-08 — Informação dos projetos, passo 3: tipos, serviço, hook e erros no frontend

- `types/projectInfo.ts` (espelho do backend), `services/projectInfoService.ts` (5 chamadas), `hooks/useProjectInfos.ts` (busca uma vez; `save`/`remove`/`registerDeploy`/`removeDeploy` com `ErrorHandler.handle` e a lista atualizada sem refresh) e `PROJECT_001-003` em `errorMessages.ts`. `tsc -b` e `eslint .` limpos. Sem UI ainda, por isso nada a verificar no browser.
- Files: frontend/src/{types/projectInfo.ts,services/projectInfoService.ts,hooks/useProjectInfos.ts,errors/errorMessages.ts}, docs/features/informacao-dos-projetos.md
- Item original do ToDo: "Spec informação dos projetos (7 passos, 2 feitos — 2026-11-08) — página Projetos com a ficha de cada app…"

## 2026-11-08 — Informação dos projetos, passo 4: página `/projects`

- Página com um cartão por projeto do registo juntado à ficha por `path` (nome, tag de ciclo de vida, URL de produção como link `_blank` `noopener noreferrer`, hosting, último deploy relativo), chips de ciclo de vida com contagens, pesquisa por nome, estados vazio/erro/"Sem informação". Item "Projetos" na nav e ação `goProjects` (sem tecla) no catálogo. Verificado no browser (instância descartável, `scripts/verify/projects-page.mjs`, 27/27, sem erros na consola, screenshot conferido); `tsc -b`, `eslint .` e o teste dos atalhos limpos. O cartão ainda não abre o drawer (passo 5).
- Files: frontend/src/{pages/ProjectsPage.tsx,components/projects/*,main.tsx,layouts/AppLayout.tsx}, backend/src/keybindings/catalog.ts, backend/test/keybindings.test.ts, scripts/verify/projects-page.mjs, docs/{code-map.md,skills/references/design/app-shell-and-auth.md,features/informacao-dos-projetos.md}
- Item original do ToDo: "Spec informação dos projetos (7 passos, 3 feitos — 2026-11-08) — página Projetos com a ficha de cada app…"

## 2026-11-08 — Informação dos projetos, passo 5: drawer de detalhe e formulário de edição

- Drawer de 900 px com a ficha em leitura e **Editar** a trocar o corpo pelo formulário (RHF + Zod, `useForm` no drawer): ciclo de vida, até 5 ambientes (`useFieldArray`; URL, hosting com `AutoComplete`, painel, logs, health, custo), código e infra, domínio, links (≤ 10) e notas com o aviso de segredos. URLs que não `http(s)` dão erro por campo; Guardar só com mudanças válidas; Apagar ficha com confirmação. O cartão abre o drawer (rato no cartão, teclado no nome), "Adicionar informação" abre-o já em edição, e a página aceita `location.state.projectPath`. Padrão novo documentado em `design/drawers-and-modals.md`.
- Verificado no browser (instância descartável, `scripts/verify/project-drawer.mjs`, 33/33, cada passo lido de volta na API, sem erros na consola); `tsc -b` e `eslint src` limpos.
- Files: frontend/src/components/projects/{ProjectInfoDrawer,ProjectInfoDetails,ProjectInfoForm,EnvironmentFields,FormField,projectInfoFormSchema,ProjectCard,projectInfoFormat}, frontend/src/pages/ProjectsPage.tsx, scripts/verify/project-drawer.mjs, docs/{code-map.md,skills/references/design/drawers-and-modals.md,features/informacao-dos-projetos.md}
- Item original do ToDo: "Spec informação dos projetos (7 passos, 4 feitos — 2026-11-08) — página Projetos com a ficha de cada app…"

## 2026-11-08 — Informação dos projetos, passo 6: registar e apagar deploys

- Cada ambiente do drawer lista os seus deploys (data e hora, "há 3 dias", versão, nota; mais recente primeiro) com **Registar deploy**: um modal por cima do drawer com "agora" pré-preenchido e editável (`datetime-local`, guardado em ISO), versão e nota opcionais; no limite de 20 avisa que o mais antigo sai. Apagar um deploy pede confirmação. A lista e o "último deploy" do cartão atualizam sem recarregar.
- Verificado no browser (instância descartável, `scripts/verify/project-deploys.mjs`, 30/30, cada passo lido de volta na API, sem erros na consola); os cenários dos passos 4 e 5 continuam a passar (27/27, 33/33); `tsc -b` e `eslint src` limpos.
- Files: frontend/src/components/projects/{DeployList,RegisterDeployModal,ProjectInfoDetails,ProjectInfoDrawer,projectInfoFormat,projectInfoFormSchema}, frontend/src/pages/ProjectsPage.tsx, scripts/verify/project-deploys.mjs, docs/{code-map.md,features/informacao-dos-projetos.md}
- Item original do ToDo: "Spec informação dos projetos (7 passos, 5 feitos — 2026-11-08) — página Projetos com a ficha de cada app…"

## 2026-11-08 — Informação dos projetos, passo 7: verificação ponta a ponta e fecho (spec concluída)

- Rotas `/api/project-infos` por HTTP real com cookie de sessão (`project-info-http.mjs`, 20/20) e o fluxo completo pela UI (`project-info-e2e.mjs`, 21/21: produção + staging, dois deploys, recarga, edição, `javascript:` recusado, apagar). Os cenários `projects-page`, `project-drawer` e `project-deploys` re-corridos depois de extrair o `formDriver.mjs` (27/27, 33/33, 30/30). Backend 527/527; `tsc -b` e `eslint .` limpos. Docs: ecrã Projetos em `use-cases.md`, §4.3 em `forms-and-validation.md`, `api.md`/`code-map.md` a ✅, spec ✅. Fica de fora (segunda fase): o ícone ⓘ nos separadores, o ping dos URLs (ADR de segurança), o aviso de renovação do domínio.
- Files: scripts/verify/{formDriver,project-info-http,project-info-e2e,project-drawer,project-deploys}.mjs, docs/{product/use-cases.md,skills/references/design/forms-and-validation.md,api.md,code-map.md,features/informacao-dos-projetos.md}, notes/ToDo.md
- Item original do ToDo: "Spec informação dos projetos (7 passos, 6 feitos — 2026-11-08) — página Projetos com a ficha de cada app: ciclo de vida, ambientes (URL, hosting, deploys manuais), código/infra, notas; guardada no `state.json` (ADR 0028). Depois: ícone ⓘ nos separadores dos Terminais que abre a ficha."

## 2026-11-12 — node-pty 1.2.0-beta.18 contra o segfault do ConPTY

- Subido o node-pty para a beta (a 1.1.0 fazia segfault em Node 24 / Windows). Descoberto que a 1.2 devolve `pty.pid` = 0 após o spawn e após a saída: o `Terminal` guarda o último pid real, `isAlive` recusa `pid <= 0` e `closeGracefully` ignora pid 0 (era também o que fazia falhar 2 testes do `terminalManager`).
- Medido: suite por omissão 4/4 (527/527); `--pool=threads` 15/16, com 1 exit 134 (SIGABRT) não reproduzido nas 8 corridas seguintes com saída completa. Residual fica no ToDo.
- Files: backend/package.json, package-lock.json, src/terminals/spawnClaude.ts, src/terminals/terminalManager.ts, test/fakeClaude.ts, test/terminalManager.test.ts, docs/adr/0029-node-pty-beta-1-2.md, docs/adr/README.md, docs/backend-conventions.md, docs/commands.md
- Item original do ToDo: "Teste intermitente no backend: um "Worker exited unexpectedly" do pool de forks ..." (mantido no ToDo pelo residual)

## 2026-11-12 — Atualizado do Workflow `eff6838` → `15c58e8`

- `/upgrade-project` (corrido no Workflow): **tier de modelo por item do ToDo**. Cada item passa a começar por `opus` ou `sonnet` (critérios em [[ai-workflow]] → "Tiers de modelo"); o `/refine-idea` escreve-o, o `/implement-todo` confirma-o depois de investigar e avisa quando a sessão corre no modelo errado. Itens antigos sem tier continuam válidos (por decidir). Também o `plan-feature` e o template da spec (linha **Sessões**).

## 2026-11-12 — Correr e parar a app, passo 3 a meio: o terminal do `/run`

- Parcial, a pedido do dono (parou a meio): o terminal escondido que corre o `/run` de um projeto (`appRun` no estado, arranque `run`, `createAppRun`, `dropAppRuns`, códigos `APPRUN_001-003`). Falta o `AppRunService`, as rotas e tudo o resto; retoma-se pela secção 6 da spec. Passos 1-2 (`opus`) por fazer.
- Files: backend/src/{common/errors,state/state.schema,terminals/claudeArgs,terminals/terminalsService}.ts, backend/test/{stateStore,telegramPreview,terminalsService}.test.ts, docs/features/correr-a-app.md
- Item original do ToDo: "Spec correr e parar a app (8 passos, 0 feitos — 2026-11-12) — botões Correr/Parar no cabeçalho comum da página Terminais…" (mantido no ToDo)

## 2026-11-12 — Teste intermitente fechado: o exit 134 é uma asserção do Node, não do node-pty

- Repetida a suite ×8 em `--pool=threads` com a saída completa: 7/8 limpas (527/527), 1 exit 134 (total da beta.18: 22/24). O SIGABRT é `Assertion failed: uv_fs_close` em `fs.readFileSync` (`node_file.cc`), sem frames do node-pty: outro código no processo fechou o handle que o `fs` tinha aberto. A origem não está provada (o `conpty.cc` da beta não mostra fecho duplo); como em forks passa 4/4, o dono escolheu fechar e vigiar. O item do ToDo passou a "Vigiar o node-pty" (1.2 estável → ADR 0029 `aceite`; uso real). A 1.2 estável ainda não saiu (`latest` = 1.1.0).
- Files: docs/backend-conventions.md, notes/ToDo.md, notes/roadmap/plans/archive/2026-11-08-teste-worker-intermitente.md, notes/roadmap/backlog.md
- Item original do ToDo: "Teste intermitente no backend: um "Worker exited unexpectedly" do pool de forks (`[vitest-pool]: Worker forks emitted error`) — … **Resta**: 1 corrida em threads com exit 134 (SIGABRT) nunca reproduzida em 8 corridas seguintes com saída completa — vigiar; quando sair a 1.2 estável, subir e passar o ADR a `aceite`; confirmar no uso real (dias) que o backend não crasha. …"

## 2026-11-12 — Correr e parar a app: ADR 0030 e o backend (passos 3-4)

- ADR **0030** da app (`aceite`): terceiro terminal escondido com `/run`, "a correr" = portas abaixo do PTY, `/stop` no PTY + rede de 20 s, limite de 3 min, só com as skills run e stop, nunca a própria app, **conta para o `MAX_TERMINALS`** (decidido com o dono hoje). O ADR 0013 do Workflow fica com o passo 2. Backend: `AppRunService` (fases em memória, atualizadas pelo GET) e as 4 rotas `/api/app-runs`; código novo `APPRUN_004` para recusar a própria app (o `APPRUN_002` diria "falta a skill"). Ao parar, espera-se o fim do turno do `/stop` antes de fechar, para não matar um `docker compose down` a meio. O teste de rota apanhou uma corrida: a execução esquecia-se antes de o `close` acabar, e um Correr nesse intervalo abria um segundo terminal — agora só se esquece depois. Suite 548/548 (21 testes novos) + HTTP real numa instância de verificação.
- Files: backend/src/appRuns/{appRunService,appRun.routes,appRun.schemas}.ts, backend/src/{app,common/errors}.ts, backend/test/{appRunService,appRun.routes,terminalsService}.test.ts, frontend/src/errors/errorMessages.ts, docs/adr/{0030-correr-e-parar-a-app-de-um-projeto,README}.md, docs/{api,database,code-map,backend-conventions}.md, docs/features/{correr-a-app,pre-visualizacao}.md, notes/ToDo.md
- Item original do ToDo: "Spec correr e parar a app (8 passos, 0 fechados, passo 3 a meio — 2026-11-12) — botões **Correr**/**Parar** no cabeçalho comum da página Terminais …" (mantido no ToDo)

## 2026-11-13 — Atualizado do Workflow `15c58e8` → `b55f327`

- `/upgrade-project` (feito no Workflow): o que se aplicou e o que ficou de fora está em [[../docs/provenance]] → "Atualizações do Workflow".

## 2026-11-13 — Correr e parar a app: a skill `/stop` no Workflow (passo 2) e o ADR 0013

- Skill de biblioteca `stop` (`applies-when: always`, `prospective` até o botão Parar a provar): na conversa do `/run` para pelos IDs e o que arrancou à parte, sem perguntas; confirma sempre as portas por fora; pelas portas só mata com o caminho do projeto na linha de comando do PID ou dos pais, senão pergunta; `docker compose down` noutra conversa só depois de perguntar. O "Parar" da `skill-run` aponta para ela. Commit `6904f56` no Workflow (sem push). Decisões do dono no plano `2026-11-13-correr-a-app-stop-e-frontend`.
- Provado: `audit-library` e `dry-run` sem erros; o `dry-run --out` gera o ponteiro e a skill; o `upgrade-report` contra esta app oferece o `stop`. Ainda não aplicado aqui (passo 7).
- Files (Workflow): library/skills/process/skill-stop.md, library/skills/process/skill-run.md, library/skills/README.md, docs/placeholders.md, docs/skills/skill-create.md, docs/skills/skill-adopt-project.md, docs/skills/skill-upgrade-project.md, docs/provenance.md, docs/adr/0013-skill-stop-obrigatoria.md, docs/adr/README.md · (app) docs/features/correr-a-app.md
- Item original do ToDo: "Spec [[../docs/features/correr-a-app|correr e parar a app]] (8 passos, …) — passo 2"

## 2026-11-13 — Correr e parar a app: cabeçalho comum e o controlo Correr/Parar (passos 5-6)

- O cabeçalho "Terminais · N abertos" passa a `TerminalsHeader`, desenhado pela página por cima da grelha e do foco; à direita o `AppRunControl` (os 6 estados da spec, portas como links, tempo a subir, Ver terminal) e o seletor de grelha (só na grelha). Parar também a arrancar. A sondagem por fase passou a `setInterval`: o `setTimeout` por resposta morria com a janela escondida — o cenário apanhou-o.
- Verificado no browser: `scripts/verify/app-run-ui.mjs` (novo, 26/26; estados em movimento repetidos por `Fetch.requestPaused`, porque o `claude` da instância não corre `/run`) e `terminal-menu.mjs` 42/42. O `/run` → `/stop` real fica para o passo 8.
- Files: frontend/src/components/terminals/{TerminalsHeader,AppRunControl,TerminalGrid}.tsx, frontend/src/pages/TerminalsPage.tsx, frontend/src/hooks/useAppRun.ts, frontend/src/services/appRunService.ts, frontend/src/types/appRun.ts, scripts/verify/app-run-ui.mjs, docs/commands.md, docs/code-map.md, docs/skills/references/design/grid-styles.md, docs/features/correr-a-app.md
- Item original do ToDo: "Spec [[../docs/features/correr-a-app|correr e parar a app]] (8 passos, …) — passos 5 e 6"

## 2026-11-13 — Estado de cada sessão por hooks (backend) e o ADR 0031

- Spike com o `claude` real (2.1.323): o hook herda `WFA_TERMINAL_ID` (também depois do `/clear`); a permissão chega por `PermissionRequest` e o regresso por `PostToolUse`; a espera de 60 s é `Notification` `idle_prompt` (distingue-se sem heurística); os agentes são todos assíncronos e o id casa entre `PostToolUse(Agent)`, `SubagentStart` e `SubagentStop`. Daí o ADR **0031** (altera o "só `statusLine`" do 0012): `session-hook.cjs` não bloqueante no `claude-settings.json` comum, só os terminais normais levam a variável, `TerminalView.activity` working/needs-you/waiting (o `status` não muda) e o contrato `agents[]` já fixado. Decidido com o dono: variável por terminal, `PostToolUse` para voltar a "a trabalhar", só os normais, "À tua espera" ao abrir.
- Provado: `test/sessionState.test.ts` (10, o hook com stdin real) e a suite 559/559; `scripts/session-state-check.ts` com o `claude` real passou pelos 4 estados (permissão do Bash e AskUserQuestion). `protocol.ts` não mudou: o estado vai pelo REST, não pelo WebSocket. Ainda sem UI (ícones: design por escolher).
- Files: backend/src/terminals/{sessionState,spawnClaude,terminalManager,terminalsService}.ts, backend/src/{app,usage/usageFiles}.ts, backend/test/{sessionState,telegramPreview}.test.ts, backend/scripts/session-state-{spike,check}.ts, frontend/src/types/terminal.ts, docs/adr/{0031-estado-das-sessoes-por-hooks,0012-argumentos-do-claude-e-status-line,README}.md, docs/{api,code-map,database,security}.md, docs/features/terminais.md
- Item original do ToDo: "Estado de cada sessão à vista (a trabalhar / à espera de input / terminada) sem abrir o terminal — backend: hooks no `--settings` dos terminais normais e o estado na API — hoje só há `running | exited` e não se sabe que sessão precisa de mim sem a abrir."

## 2026-11-13 — Agentes de cada terminal (backend)

- O mesmo `session-hook.cjs` grava um ficheiro por evento e por agente (`SubagentStart` → tipo, `PostToolUse(Agent)` → descrição cortada a 120 e modelo resolvido, `SubagentStop` → fim) em `DATA_DIR/session-state/<id>/agents/`, para que hooks em paralelo nunca escrevam no mesmo ficheiro; o `TerminalView` ganha `agents[]`. A mensagem seguinte do dono apaga os `done` e deixa os que ainda correm; o acordar de um agente (`<task-notification>`) não conta como mensagem (desvio ao bullet, ADR 0031 ponto 6: os agentes são todos assíncronos). Sem ler transcripts nem chamar modelos.
- Provado: 5 testes novos (hook com os payloads do spike, nada do prompt nem do resultado gravado) e a suite 563/563; `scripts/session-state-check.ts` com o `claude` real: 3 agentes em paralelo vistos a correr ao mesmo tempo com descrição/tipo/modelo, todos `done`, lista vazia depois da mensagem seguinte. A UI fica no ToDo (⚠️ o dono decide o desenho).
- Files: backend/src/terminals/{sessionState,terminalsService}.ts, backend/test/{sessionState,telegramPreview}.test.ts, backend/scripts/session-state-check.ts, frontend/src/types/terminal.ts, docs/{api,database,code-map}.md, docs/features/terminais.md
- Item original do ToDo: "`sonnet` Agentes de cada terminal à vista, muito resumido — quantos estão a correr e o que cada um faz (descrição, tipo, modelo, há quanto tempo), sem abrir o terminal. Backend primeiro; o frontend decido depois. (…) (pedido direto do dono, 2026-11-13; partido pelo implement-todo a 2026-11-13 …)"

## 2026-11-13 — Terminal novo no primeiro lugar vazio da grelha

- Num estilo com lugares (2×2, Colunas, Principal + laterais), o `handleCreate` ("+" da lateral, "Noutra conta", Novo terminal, Retomar sessão, atalho) põe o terminal no primeiro lugar livre (`firstFreeSlot`: `null`, um id que já não existe, ou para lá do fim), sem ampliar, com o teclado, e grava a preferência; com a grelha cheia, Grelha 3×2 ou Foco dividido fica como antes. Os que chegam de outras páginas (`focusTerminalId`) continuam a ampliar (decidido com o dono). Se estava um terminal ampliado, a ampliação fecha, para o novo se ver.
- Verificado no browser: `scripts/verify/grid-slots.mjs` (novo) 13/13 e `terminal-menu.mjs` 42/42.
- Files: frontend/src/pages/TerminalsPage.tsx, frontend/src/components/terminals/gridStyle.ts, scripts/verify/grid-slots.mjs, docs/features/estilos-de-grelha.md, docs/commands.md
- Item original do ToDo: "Terminal novo ocupa o primeiro lugar vazio da grelha — hoje, num estilo com lugares (2×2, Colunas, Principal + laterais), um terminal aberto fora do "+" do próprio lugar (o "+" do projeto na lateral, "Noutra conta", `Novo terminal`, "Retomar sessão", atalho) só é ampliado e, ao sair da ampliação, fica de fora mesmo com um "+" à vista."
