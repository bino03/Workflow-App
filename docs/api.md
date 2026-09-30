# 📡 Referência da API

> 🚧 Implementado: **Auth e saúde** (✅, no fim). O resto são as rotas **propostas** na criação do projeto.
> Cada endpoint entra (ou é corrigido) aqui no mesmo commit; o hook avisa quando um ficheiro de rotas muda.

Base: `http://localhost:7400/api`. Todas as rotas exigem sessão, exceto as listadas
como públicas em [[security]].

## Formato de erro

```json
{ "errorCode": "MODULE_NNN", "message": "…", "fieldErrors": [ { "field": "…", "message": "…" } ] }
```

Ver [[error-model]]. Um só handler (`backend/src/common/errors.ts`) formata todos os erros, incluindo os do
próprio Fastify (JSON mal formado, content-type errado → `COMMON_001`) e as rotas inexistentes.

### Códigos de erro

| Código | HTTP | Quando |
|---|---|---|
| `COMMON_001` | 400 | Validação falhou (`fieldErrors` por campo) ou pedido mal formado |
| `COMMON_002` | 500 | Erro inesperado — o `message` é sempre genérico, o detalhe só vai para o log |
| `COMMON_003` | 404 | Rota inexistente |
| `AUTH_001` | 401 | Nome de utilizador ou password errados — nunca diz qual |
| `AUTH_002` | 401 | Sem sessão, ou sessão expirada |
| `AUTH_003` | 403 | `Origin` fora de `CORS_ALLOWED_ORIGINS` (upgrade do WebSocket) |
| `AUTH_004` | 429 | Demasiadas tentativas de login |
| `LIBRARY_001` | 500 | A pasta `WORKFLOW_PATH/library` não existe |
| `LIBRARY_002` | 400 | O ficheiro enviado não é uma skill válida — `fieldErrors` com o que falha no frontmatter |
| `LIBRARY_003` | 409 | Já existe uma skill com esse nome nessa stack (nunca sobrescreve) |
| `LIBRARY_004` | 404 | A stack não existe na biblioteca |
| `LIBRARY_005` | 400 | Ficheiro em falta, vazio, ou acima de 256 KiB |
| `TERMINAL_001` | 404 | O terminal não existe |
| `TERMINAL_002` | 409 | `MAX_TERMINALS` atingido (só contam os vivos) |
| `TERMINAL_003` | 409 | A sessão já está aberta noutro terminal |
| `TERMINAL_004` | 404 | A sessão gravada (`.jsonl`) já não existe |
| `TERMINAL_005` | 503 | O binário `claude` (`CLAUDE_BIN`) não foi encontrado |
| `TERMINAL_006` | 409 | Reabrir um terminal que já está a correr |
| `FOLDER_001` | 403 | Pasta inexistente, não é pasta, relativa, ou fora de `ALLOWED_ROOTS` (depois de resolver `..`, symlinks e junctions) — nunca diz qual |
| `SESSION_001` | 404 | "Continuar a última" numa pasta sem sessões gravadas |

O frontend espelha esta tabela em `frontend/src/errors/errorMessages.ts`, pela mesma ordem — os dois
mudam no mesmo commit.

## Paginação

Sem paginação no MVP — as listas (terminais abertos, sessões de uma pasta, entradas da biblioteca) são
pequenas e vêm inteiras. Se uma lista crescer, a forma decide-se com [[api-design]] e entra aqui.

---

## Terminais (`terminals/`, `/api/terminals`) — ✅

Todas com sessão (`AUTH_002`). Corpos validados com zod (`terminals/terminal.schemas.ts`); um id que não é
UUID dá o mesmo `TERMINAL_001` que um id desconhecido.

| Método | Rota | Corpo | Resposta | Erros |
|---|---|---|---|---|
| GET | `/api/terminals` | — | `TerminalView[]` (os gravados, por `createdAt`) | — |
| POST | `/api/terminals` | `{cwd, mode: 'new'\|'resume'\|'continue', sessionId?, label?, cols, rows}` — `sessionId` (UUID) obrigatório em `resume` | `201 TerminalView` | `COMMON_001` · `FOLDER_001` · `TERMINAL_002` · `TERMINAL_003` · `TERMINAL_004` · `TERMINAL_005` · `SESSION_001` |
| POST | `/api/terminals/:id/reopen` | `{cols, rows}` | `200 TerminalView & {freshSession}` — `--resume` da sessão; sem `.jsonl` (o `claude` não grava sessões sem mensagens) começa uma conversa nova no mesmo terminal e `freshSession: true` | `TERMINAL_001` · `TERMINAL_002` · `TERMINAL_005` · `TERMINAL_006` · `FOLDER_001` |
| PATCH | `/api/terminals/:id` | `{label: string \| null}` | `200 TerminalView` | `COMMON_001` · `TERMINAL_001` |
| DELETE | `/api/terminals/:id` | — | `204` | `TERMINAL_001` |

- `TerminalView = {id, label, cwd, claudeSessionId, status: 'running'|'exited'|'stopped', exitCode, createdAt, lastOpenedAt}`.
  `stopped` = gravado no `state.json` mas sem processo (o backend reiniciou) → só `reopen` ou `DELETE`.
- `mode: 'new'` → `claude --session-id <uuid do backend>`; `'resume'` → `--resume <sessionId>`; `'continue'` →
  `--resume` da sessão mais recente da pasta ([[adr/0012-argumentos-do-claude-e-status-line]]).
- `label`: ≤ 80, só letras, dígitos, espaço e `. _ - ( )`; vazio ou `null` → a UI mostra o nome da pasta.
- `DELETE` fecha o `claude` como uma pessoa (Ctrl+C ×2; `taskkill /T /F` só se não sair em 3 s), mata o resto
  da árvore, e passa o terminal a `closedTerminals` com o resumo do `.jsonl`. Demora ~1-3 s (ver
  [[backend-conventions]] → Armadilhas: o canary do fullscreen)
  ([[database]]); o resumo nunca faz o fecho falhar.
- Só os terminais **a correr** contam para `MAX_TERMINALS`.

### Protocolo do WebSocket

> ✅ Fixado no spike do PTY (2026-09-28); gateway em `backend/src/terminals/terminals.gateway.ts` (2026-09-28).
> Tipos e schemas em `backend/src/terminals/protocol.ts`, espelhados em `frontend/src/types/terminal.ts`.
> `WS /api/terminals/:id/ws` — sessão **e** `Origin` verificados pela guarda antes do upgrade (401 / 403).

**A regra: o tipo do frame diz o que é.** Frames **binários** são bytes do terminal (nos dois sentidos);
frames de **texto** são sempre JSON de controlo. Assim uma colagem que por acaso seja JSON nunca é
confundida com uma mensagem de controlo.

| Direção | Frame | Mensagem | Nota |
|---|---|---|---|
| servidor → cliente | texto | `{"type":"ready","status":"running"\|"exited","exitCode":N\|null}` | Sempre a primeira, ao ligar. O cliente faz `term.reset()` — evita o scrollback duplicado ao religar |
| servidor → cliente | binário | output do PTY, UTF-8 | Primeiro o scrollback guardado (até `SCROLLBACK_BYTES`), depois em tempo real |
| servidor → cliente | texto | `{"type":"exit","code":N}` | O processo terminou; o terminal fica listado como `exited` |
| cliente → servidor | binário | input (teclado, colagens), UTF-8 | Escrito tal e qual no PTY. Ctrl+C = `0x03` (dois seguidos fecham o `claude`) |
| cliente → servidor | texto | `{"type":"resize","cols":N,"rows":M}` | Validado com zod: `cols` 2–1000, `rows` 1–500. Fora disso → a mensagem é ignorada |

Os tamanhos iniciais vão no `POST` de criação (`cols`, `rows`), para a TUI não arrancar em 80×24 e
redesenhar logo a seguir.

- **Códigos de fecho**: `4404` — o terminal não está a correr em memória (parado, fechado, ou reaberto:
  o cliente liga um socket novo); `4401` — a sessão de login acabou (logout, expiração, novo login).
- Vários clientes no mesmo terminal recebem todos o output; o último `resize` ganha.
- Um frame tem no máximo **1 MiB** (`maxPayload`).
- O conteúdo do terminal **nunca** vai para os logs — só ids e eventos (testado em `terminals.gateway.test.ts`).

## Sessões gravadas e pastas (`sessions/`, `folders/`) — ✅

Todas com sessão (`AUTH_002`). Qualquer pasta passa por `resolveAllowedPath` (`FOLDER_001` fora de `ALLOWED_ROOTS`).

| Método | Rota | Corpo / query | Resposta | Erros |
|---|---|---|---|---|
| GET | `/api/sessions?cwd=` | `cwd` | `SavedSession[]`, a mais recente primeiro | `COMMON_001` · `FOLDER_001` |
| GET | `/api/folders` | — | `{roots, favorites: FolderView[], recents: FolderView[]}` | — |
| GET | `/api/folders/browse?path=` | `path` | `{path, parent, entries: [{name, path, sessionCount}]}` | `COMMON_001` · `FOLDER_001` |
| PUT | `/api/folders/favorite` | `{path, favorite: boolean}` | `204` | `COMMON_001` · `FOLDER_001` |

- `SavedSession = {id, startedAt, updatedAt, messageCount, preview, closed, openIn}` — lido de
  `<CLAUDE_CONFIG_DIR ou ~/.claude>/projects/<pasta codificada>/<uuid>.jsonl` (formato em [[features/terminais]] §4.1).
  `closed` = `{label, summary, closedAt}` do terminal fechado na app que usou a sessão (o histórico só aparece
  aqui); `openIn` = o terminal gravado que a usa (retomá-la dá `TERMINAL_003`).
- `FolderView = {path, favorite, lastUsedAt}`. Favoritas e recentes que já não existem ou saíram das raízes
  não aparecem. Desmarcar uma favorita nunca usada esquece-a.
- `browse`: um nível; pastas começadas por `.` e links/junctions ficam de fora; `parent` é `null` na raiz
  (nunca se sobe acima dela); `sessionCount` conta os `.jsonl` sem os ler.

## Biblioteca (`library/`, `/api/library`) — ✅

Lida do disco a cada pedido ([[adr/0005-biblioteca-lida-do-disco]]). As três rotas `GET` devolvem
`{entries, invalid}`, com `entries` ordenadas por `name`:

| Método | Rota | Acesso | Lê | Cada entrada | Erros |
|---|---|---|---|---|---|
| GET | `/api/library/stacks` | sessão | `library/stacks/<id>/STACK.md` | `{id, name, layer, technologies, pairsWith, providesSkills, …comum}` | `AUTH_002` · `LIBRARY_001` |
| GET | `/api/library/themes` | sessão | `library/frontend/themes/<id>/THEME.md` | `{id, name, mode, density, suits, frontendStacks, fonts, …comum}` | `AUTH_002` · `LIBRARY_001` |
| GET | `/api/library/skills` | sessão | `library/skills/**` e `library/stacks/<id>/skills/**` | `{name, category, appliesWhen, description, stack, …comum}` | `AUTH_002` · `LIBRARY_001` |
| POST | `/api/library/stacks/:stackId/skills` | sessão | escreve — ver abaixo | `201` com a mesma entrada do `GET /api/library/skills` | `COMMON_001` · `AUTH_002` · `LIBRARY_002` · `LIBRARY_003` · `LIBRARY_004` · `LIBRARY_005` |

- **Comum**: `maturity` (`proven`/`partial`/`draft`: os três chips do ecrã), `maturityRaw` (o valor escrito
  no manifesto, mostrado na tag), `updated` (string ou `null`), `path` (caminho absoluto do manifesto).
- **Maturidade normalizada**: stacks `proven`/`partial`/`planned`, designs `proven`/`adapted`/`draft`,
  skills `proven`/`adapted`/`prospective` → `adapted` conta como `partial`; `planned`/`prospective` como
  `draft`.
- `technologies` são as chaves de `versions`; `stack` só vem preenchido nas skills de dentro de uma stack.
- Pastas começadas por `_` ou `.` são ignoradas; agentes não entram.
- **Um manifesto inválido nunca é fatal**: vai para `invalid[]` como `{path, message}` (caminho relativo +
  razão do zod/YAML), e o resto da lista vem na mesma. Só a falta da pasta `library/` dá `500 LIBRARY_001`.

### `POST /api/library/stacks/:stackId/skills` — a única escrita

A única porta de escrita da app no `WORKFLOW_PATH` ([[adr/0014-escrita-controlada-biblioteca]]).
`multipart/form-data` com **um** campo `file` (o `.md` da skill); o corpo em JSON dá `COMMON_001`.

- **`:stackId`** tem de ser um dos `id` do `GET /api/library/stacks` — caso contrário `LIBRARY_004`. Nunca
  entra num caminho: a pasta de destino vem do `STACK.md` que o serviço encontrou ao varrer `stacks/`, por
  isso um `../../etc` só pode falhar o *match*, nunca sair da biblioteca.
- **O nome do ficheiro vem do frontmatter**, não do ficheiro enviado: escreve `stacks/<pasta>/skills/skill-<name>.md`,
  com `name` validado em kebab-case (`^[a-z0-9]+(-[a-z0-9]+)*$`). O frontmatter tem de passar no mesmo
  schema de skill da leitura, mais essa regra → senão `LIBRARY_002` com `fieldErrors`.
- **Nunca sobrescreve**: destino já existente → `LIBRARY_003` (a criação usa `wx`, por isso a corrida
  também dá 409).
- **Tamanho**: vazio ou acima de **256 KiB** (constante no código, não é variável de ambiente) → `LIBRARY_005`.
- **Nada é escrito antes de tudo estar validado.** Depois de a skill ser escrita, o `provides-skills` do
  `STACK.md` dessa stack ganha o nome — em **melhor esforço**: se falhar, fica um aviso no log e a resposta
  é `201` na mesma (a listagem lê a pasta, não o manifesto). Só esse array é alterado; o resto do
  `STACK.md` fica byte-a-byte igual.
- `library/stacks/README.md` **não** é atualizado — limitação conhecida do ADR 0014.

## Projetos (`projects/`, `/api/projects`) — ✅

Só leitura, lida do disco a cada pedido ([[adr/0005-biblioteca-lida-do-disco]] — mesma postura da
Biblioteca, aplicada ao registo de projetos do Workflow). **Nunca falha por causa dos dados do
registo**: sem `projects/INDEX.md`, sem "Pasta base", ou uma linha mal formada da tabela → esse
projeto (ou a lista toda) sai, nunca 500.

| Método | Rota | Acesso | Lê | Resposta | Erros |
|---|---|---|---|---|---|
| GET | `/api/projects` | sessão | `WORKFLOW_PATH/projects/INDEX.md` | `ProjectEntry[]` | `AUTH_002` |

- `ProjectEntry = {name, path, type, stack, status}` — `path` é absoluto (`Pasta base` + a coluna
  "Caminho" da tabela) e já passou por `resolveAllowedPath`; `type`/`stack`/`status` vêm das colunas
  Tipo/Stack/Estado, `null` quando a célula está vazia ou é "—".
- Ficam de fora da lista: projetos com `Estado` a começar por "descartado", e projetos cujo caminho
  resolvido cai fora de `ALLOWED_ROOTS` ou não existe no disco (mesma regra das pastas favoritas/recentes
  fora das raízes, [[features/separadores-de-projetos]]).
- `projects/INDEX.md` é uma tabela Markdown para humanos, sem frontmatter — ao contrário dos manifestos
  da Biblioteca, é a única fonte que existe para o registo de projetos; o parser
  (`backend/src/projects/projectIndexParser.ts`) tolera linhas mal formadas, saltando-as.

## Quota (`usage/`, `/api/usage`) — ✅

| Método | Rota | Acesso | Resposta |
|---|---|---|---|
| GET | `/api/usage` | sessão | `UsageView` = `{fiveHour, weekly, fetchedAt}` — cada janela `{usedPct, resetsAt}` ou `null`; `fetchedAt` ISO ou `null` |

- Fonte: a status line injetada em todo o `claude` que a app lança ([[adr/0012-argumentos-do-claude-e-status-line]]).
  O backend escreve `DATA_DIR/claude-settings.json` e `DATA_DIR/statusline.cjs` no arranque; o script grava
  `usage.json` só quando o JSON traz `rate_limits` (a partir da 1.ª resposta de uma sessão).
- `usedPct` 0–100; `resetsAt` ISO (vem em segundos Unix); `fetchedAt` = quando foi visto. Sem ficheiro ou
  ilegível → tudo `null`, nunca erro. Um valor velho é da UI tratar (a cinzento + "há X min").

## Auth e saúde (`auth/`, `common/health.routes.ts`) — ✅

| Método | Rota | Acesso | Corpo | Resposta | Erros |
|---|---|---|---|---|---|
| POST | `/api/auth/login` | **público**, 5/min por IP | `{username, password}` (nome 1–64 depois de `trim`, password 1–1024) | `204` + `Set-Cookie: session` | `COMMON_001` corpo inválido · `AUTH_001` nome ou password errados (o mesmo para os dois, [[adr/0011-nome-de-utilizador-no-login]]) · `AUTH_004` 429 |
| POST | `/api/auth/logout` | sessão | — | `204` + cookie limpo | `AUTH_002` |
| GET | `/api/auth/me` | sessão | — | `{authenticated:true}` | `AUTH_002` |
| GET | `/api/health` | **público** | — | `{status:"ok"}` | — |

- **Sem sessão, qualquer rota não pública dá `401 AUTH_002`** — incluindo rotas que não existem (só com
  sessão é que uma rota inexistente dá `404 COMMON_003`); a API não revela que rotas tem.
- Um login com sucesso termina a sessão anterior que o browser trazia (id novo a cada login).

### Fora de `/api` — a SPA (✅)

Quando existe `FRONTEND_DIST/index.html`, o backend serve o frontend; tudo isto é **público** (a página
de login tem de carregar sem sessão):

| Pedido | Resposta |
|---|---|
| `GET` de um ficheiro do build (`/`, `/assets/*`) | o ficheiro. `/assets/*` com `Cache-Control: public, max-age=31536000, immutable`; o resto `no-cache` |
| `GET`/`HEAD` de uma rota do cliente sem extensão (`/terminals`, `/library/x`) | `index.html` (`no-cache`) |
| `GET` de um ficheiro que não existe (`/assets/velho.js`) | `404 COMMON_003` em JSON — nunca o `index.html` |
| Outro método fora de `/api` | `404 COMMON_003` |

Sem build, fora de `/api` é sempre `404 COMMON_003` (e um aviso no log do arranque). Um **WebSocket**
exige sessão em qualquer caminho, dentro ou fora de `/api`.

---

_(Uma secção por domínio — rota, acesso, corpo, resposta e **erros** (`ErrorCode`) de cada endpoint.)_

---

## Relacionado

[[architecture]] · [[database]] · [[security]]
