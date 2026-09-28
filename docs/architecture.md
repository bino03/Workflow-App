# 🏗️ Arquitetura

> 🚧 Gerado a 2026-09-27 a partir das escolhas da entrevista — descreve a intenção até haver código.
> Porquê de cada escolha: [[adr/README]].

## O que é

Hoje o trabalho com o Claude Code faz-se em várias janelas de terminal soltas, cada uma com uma sessão
do `claude`, e com o Obsidian aberto ao lado para consultar a biblioteca do Workflow. Com várias sessões
em paralelo perde-se a noção de qual está a fazer o quê, e não há um sítio que mostre quanto da quota
da subscrição já foi gasto. O Workflow App junta isso numa só interface: abrir e fechar sessões do
Claude Code, vê-las e escrever nelas em tempo real, retomá-las, escolher a pasta de cada uma, ver a
quota usada e navegar a biblioteca do Workflow — tudo o que hoje se faz no terminal, mas mais fácil de
acompanhar. O motor é o próprio Claude Code interativo, a correr num pseudo-terminal (PTY) gerido pelo
backend, com a subscrição Pro/Max já paga — nunca a API nem a Agent SDK ([[adr/0002-motor-via-pty-sobre-subscricao]]).

## As peças

| Peça | Pasta | Stack | Porta |
|---|---|---|---|
| Backend (API REST + WebSocket + gestor de PTYs) | `backend/` | `node-fastify` 📋 | 7400 |
| Frontend (SPA) | `frontend/` | `react-vite-antd` ✅ + xterm.js | 7401 (dev, Vite com proxy de `/api`) — em produção o **backend serve o `frontend/dist`** na 7400, mesma origem (✅ 2026-09-28, `common/spa.ts`) |
| Claude Code (`claude`) | — (binário instalado na máquina) | processo filho, um por terminal | — |
| Biblioteca do Workflow | `WORKFLOW_PATH/library` | ficheiros Markdown, só leitura | — |
| Sessões gravadas do Claude Code | `~/.claude/projects/` | ficheiros `.jsonl`, só leitura | — |

## Diagrama de comunicação

```
 Browser (SPA)                         Backend (Node, 127.0.0.1:7400)                Máquina
┌──────────────────┐   REST /api/*    ┌──────────────────────────────┐
│ Ecrãs + xterm.js │ ───────────────▶ │ auth · library · sessions ·  │ ──lê──▶ WORKFLOW_PATH/library/
│ (um por terminal)│  cookie HttpOnly │ usage                        │ ──lê──▶ ~/.claude/projects/
│                  │                  │                              │
│                  │  WS /api/terminals/:id/ws                       │  spawn (ConPTY no Windows)
│                  │ ◀══════════════▶ │ TerminalManager ─────────────┼──────▶ PTY ─▶ claude  (sessão 1)
│                  │  bytes ⇄ stdin/  │   (buffer, resize, kill)     │──────▶ PTY ─▶ claude  (sessão 2)
└──────────────────┘  stdout + resize └──────────────────────────────┘          …
                                                                       claude ─▶ Anthropic
                                                                       (login da subscrição —
                                                                        nunca uma API key da app)
```

## A regra que sustenta a arquitetura

**O backend é a única fonte de verdade da lógica de negócio.** O frontend fala só com o backend. Nunca
implementar regras de negócio em SQL, RLS ou funções da plataforma, mesmo que seja mais rápido. Ver
[[security]] → "Modelo de confiança na base de dados" e [[adr/0001-stack-tecnologica]].

## Backend — `node-fastify` (📋)

> Estrutura confirmada no scaffold (2026-09-28) até `common/`; os domínios abaixo dele nascem com as
> features. Convenções em [[backend-conventions]].

```
backend/
├── package.json  tsconfig.json  tsconfig.build.json  .env.example
├── scripts/                 ← utilitários de linha de comando (hash-password)
├── test/                    ← Vitest (app.inject, sem rede)
└── src/
    ├── server.ts            ← ponto de entrada: .env, config, listen, sinais → graceful shutdown
    ├── app.ts               ← buildApp({config, terminalManager, stateStore}): plugins, handler de erros, serviços e rotas, onClose mata os PTYs e esvazia a fila do state.json
    ├── config.ts            ← variáveis de ambiente validadas com zod — falha no arranque
    ├── common/              ← errors (ErrorCode, AppError, error handler único), validation (parseWith), health, auth guard, spa (servir o frontend/dist)
    ├── state/               ← StateStore: DATA_DIR/state.json (ADR 0009) — schema zod v1, limites, fila de escrita atómica
    ├── auth/                ← login / logout / me, sessão em cookie HttpOnly
    ├── terminals/           ← ✅ TerminalManager (PTYs, scrollback), TerminalsService (ciclo de vida com o state.json), claudeArgs (ADR 0012), rotas REST, gateway WebSocket
    ├── folders/             ← ✅ política de pastas (cwdPolicy: só dentro de ALLOWED_ROOTS), favoritas/recentes, browse
    ├── sessions/            ← ✅ ler as sessões gravadas do Claude Code (.jsonl, só leitura): lista, a mais recente, resumo
    ├── library/             ← ✅ registo da biblioteca do Workflow: frontmatter dos manifestos com yaml + zod, lido a cada pedido
    └── usage/               ← ✅ quota pela status line injetada (claude-settings.json + statusline.cjs → usage.json)
```

### Onde vive cada coisa

| Coisa | Caminho |
|---|---|
| Configuração e validação do ambiente | `src/config.ts` |
| Criar / fechar / listar PTYs | `src/terminals/terminalManager.ts` |
| Protocolo do WebSocket (tipos das mensagens) | `src/terminals/protocol.ts` |
| Resolver o binário `claude` e o ambiente do processo filho | `src/terminals/spawnClaude.ts` |
| Os argumentos do `claude` (`--session-id`, `--resume`, `--settings`) | `src/terminals/claudeArgs.ts` |
| Ciclo de vida (criar, reabrir, renomear, fechar; running/exited/stopped) | `src/terminals/terminalsService.ts` |
| Gateway WebSocket | `src/terminals/terminals.gateway.ts` |
| Pastas permitidas (`ALLOWED_ROOTS`) | `src/folders/cwdPolicy.ts` |
| Códigos de erro | `src/common/errors.ts` |
| Guarda de autenticação (REST e upgrade do WS) | `src/common/authGuard.ts` |

### Ciclo de vida de um terminal

```
POST /api/terminals {cwd, mode, sessionId?}  → valida cwd ∈ ALLOWED_ROOTS; escolhe a sessão
  → spawn(CLAUDE_BIN, [--session-id <novo> | --resume <uuid>, --settings <DATA_DIR>/claude-settings.json],
          {cwd, env sem ANTHROPIC_*/CLAUDE_CODE_*/config da app, cols, rows})
  → grava em state.json (terminals) e a pasta nas recentes → 201 TerminalView
WS  /api/terminals/:id/ws  (cookie + Origin verificados no upgrade)
  → servidor envia {type:"ready"}, o scrollback guardado (binário), depois o output em tempo real
  ← cliente envia input (frames binários) e {type:"resize", cols, rows} (frames de texto)
PTY termina → {type:"exit", code} → terminal fica "terminado" até ser fechado
POST /api/terminals/:id/reopen → --resume da mesma sessão, mesmo id (de terminado ou parado)
DELETE /api/terminals/:id → taskkill /T /F (a árvore toda) → closedTerminals com o resumo do .jsonl → 204
Backend pára → kill de todos; ao voltar, os gravados aparecem como "parados"
```

## Frontend — `react-vite-antd` (✅) + xterm.js

React 19 · Vite 7 · antd 6 · Tailwind 4 · TypeScript 6 (versões e porquê: [[frontend-conventions]] →
"Específico deste projeto"). Estrutura confirmada no scaffold (2026-09-28); `library/` ✅ desde 2026-09-28, `terminals/` nasce
com a feature:

```
frontend/
├── index.html  package.json  vite.config.ts  tsconfig*.json  .env.example
└── src/
    ├── main.tsx  api.ts  theme.ts  index.css
    ├── config/               ← apiBase.ts (único sítio com o endereço do backend, HTTP e ws://), drawer.ts (DRAWER_WIDTH)
    ├── layouts/AppLayout.tsx
    ├── contexts/  hooks/  services/  errors/  types/  terminal/xtermTheme.ts
    ├── pages/                ← login/, TerminalsPage, LibraryPage, dev/ (só em dev)
    └── components/
        ├── PrivateRoute.tsx
        ├── common/           ← ListActions, SectionCard, FieldError, Wordmark, PagePlaceholder
        ├── terminals/        ← 🚧 TerminalView (xterm.js + fit addon + WebSocket), lista/separadores
        └── library/          ← ✅ LibraryEntryDrawer, MaturityTag, libraryFormat (a página é pages/LibraryPage)
```

O terminal é um componente à parte das convenções de formulários/drawers: um `TerminalView` por terminal
aberto, que monta o xterm.js, liga o WebSocket e envia `resize` quando o contentor muda de tamanho. O
xterm.js desenha em canvas — **o conteúdo do terminal não é DOM**.

## Autenticação entre peças

Ver [[security]] → "Fluxo de autenticação".

## Relacionado

[[database]] · [[security]] · [[code-map]] · [[commands]]
