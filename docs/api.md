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
| `AUTH_004` | 429 | Demasiadas tentativas de login (password, passkey e password pedida ao registar uma passkey partilham o contador) |
| `AUTH_005` | 401 | Login com passkey recusado — passkey desconhecida, assinatura errada, origem/`rpID` errados, challenge expirado ou repetido; nunca diz qual |
| `AUTH_006` | 403 | Password errada ao pedir para registar uma passkey (403, não 401: a sessão continua válida) |
| `AUTH_007` | 409 | Já há 20 passkeys registadas |
| `AUTH_008` | 400 | O registo da passkey não verificou (challenge de outra sessão ou expirado, origem/`rpID` errados, sem verificação do utilizador, passkey já registada) |
| `AUTH_009` | 404 | A passkey a revogar não existe |
| `LIBRARY_001` | 500 | A pasta `WORKFLOW_PATH/library` não existe |
| `TERMINAL_001` | 404 | O terminal não existe |
| `TERMINAL_002` | 409 | `MAX_TERMINALS` atingido (só contam os vivos) |
| `TERMINAL_003` | 409 | A sessão já está aberta noutro terminal |
| `TERMINAL_004` | 404 | A sessão gravada (`.jsonl`) já não existe |
| `TERMINAL_005` | 503 | O binário `claude` (`CLAUDE_BIN`) não foi encontrado |
| `TERMINAL_006` | 409 | Reabrir um terminal que já está a correr |
| `TERMINAL_007` | 409 | Lançar com Remote Control (ou uma importação, no Workflow) numa pasta que o Claude Code ainda não aceitou como de confiança (nem ela nem uma pasta-mãe, em `.claude.json`) — [[adr/0017-bot-telegram-e-remote-control]], [[adr/0019-importar-pelas-skills-do-workflow]] |
| `FOLDER_001` | 403 | Pasta inexistente, não é pasta, relativa, ou fora de `ALLOWED_ROOTS` (depois de resolver `..`, symlinks e junctions) — nunca diz qual |
| `SESSION_001` | 404 | "Continuar a última" numa pasta sem sessões gravadas |
| `KEYBIND_001` | 400 | Tecla não permitida para esse modificador (Esc, setas, F-keys, AltGr sem ser com `.`, código não canónico) |
| `KEYBIND_002` | 409 | A combinação já é a bind em vigor de outra ação (o frontend mostra qual antes de enviar) |
| `KEYBIND_003` | 404 | Id de ação que o catálogo não tem |
| `IMPORT_001` | 404 | A importação não existe (ou o id nem é um UUID) |
| `IMPORT_002` | 409 | Já há uma importação aberta (a correr ou por rever) |
| `IMPORT_003` | 409 | O repositório do Workflow tem alterações por gravar |
| `IMPORT_004` | 400 | Ficheiros a mais (> 200), grandes demais (> 10 MiB no total), que não batem com `source.paths`, ou com um caminho que o Windows não guarda tal como vem |
| `IMPORT_005` | 409 | A importação não está no estado que a ação pede (ex. aceitar enquanto corre) |
| `IMPORT_006` | 500 | O git do Workflow falhou ou recusou — o `message` traz o fim do stderr |
| `GUIDED_001` | 404 | A sessão guiada não existe (ou o id nem é um UUID) |
| `GUIDED_002` | 409 | O `requestId` não é o da pergunta/permissão que está à espera (já respondida, de outro tipo, ou o hook morreu) — a UI recarrega |
| `GUIDED_003` | 409 | Escrever numa sessão guiada parada ou terminada — retomar primeiro |
| `GUIDED_004` | 409 | Escrever enquanto o Claude trabalha ou espera um cartão (só em `waiting-text`/`needs-you`) |
| `CREATE_001` | 409 | Já há uma criação aberta (a correr, ou terminada e ainda não fechada) |
| `CREATE_002` | 409 | "Abrir projeto" sem `result.json` `done`, sem `projectPath`, ou com uma pasta que não existe |
| `UPWORK_001` | 404 | A candidatura não existe (ou o id nem é um UUID) |
| `UPWORK_002` | 409 | Nova candidatura sem perfil de freelancer guardado |
| `UPWORK_003` | 409 | Criar projeto a partir de uma candidatura que não está `won` |
| `UPWORK_004` | 409 | Alterar uma candidatura arquivada |
| `UPWORK_005` | 409 | Escrever na conversa de uma candidatura sem sessão (arquivada) |

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
| GET | `/api/terminals` | — | `TerminalView[]` (os gravados, por `createdAt`, sem os `hidden`) | — |
| POST | `/api/terminals` | `{cwd, mode: 'new'\|'resume'\|'continue', sessionId?, label?, cols, rows}` — `sessionId` (UUID) obrigatório em `resume` | `201 TerminalView` | `COMMON_001` · `FOLDER_001` · `TERMINAL_002` · `TERMINAL_003` · `TERMINAL_004` · `TERMINAL_005` · `SESSION_001` |
| POST | `/api/terminals/:id/reopen` | `{cols, rows}` | `200 TerminalView & {freshSession}` — `--resume` da sessão; sem `.jsonl` (o `claude` não grava sessões sem mensagens) começa uma conversa nova no mesmo terminal e `freshSession: true`. Um terminal com `remoteControl` volta com `--remote-control` | `TERMINAL_001` · `TERMINAL_002` · `TERMINAL_005` · `TERMINAL_006` · `TERMINAL_007` · `FOLDER_001` |
| PATCH | `/api/terminals/:id` | `{label: string \| null}` | `200 TerminalView` | `COMMON_001` · `TERMINAL_001` |
| DELETE | `/api/terminals/:id` | — | `204` | `TERMINAL_001` |
| POST | `/api/terminals/:id/preview` | `{devPort?}` (inteiro 1-65535; nenhum outro campo) | `200 {preview}` — a porta de dev foi servida (ou já estava); `200 {ports: DevPort[]}` — há várias, escolher uma e repetir com `devPort` | `TERMINAL_001` · `COMMON_001` · `PREVIEW_001`–`007` |
| DELETE | `/api/terminals/:id/preview` | — | `204` (idempotente) | `TERMINAL_001` · `PREVIEW_005` · `PREVIEW_006` |

- `TerminalView = {id, label, cwd, claudeSessionId, status: 'running'|'exited'|'stopped', exitCode, createdAt, lastOpenedAt, remoteControl, preview, importId, hidden}`.
  `importId`/`hidden` — o terminal escondido de uma importação ([[adr/0019-importar-pelas-skills-do-workflow]]): não
  aparece no `GET` (nem no bot) até ser revelado; reaberto, mantém o `--settings` das importações e as `--add-dir`.
  `preview: {url, devPort, httpsPort, startedAt} | null` — pré-visualização viva na tailnet
  ([[adr/0018-pre-visualizacao-por-tailscale-serve]], `preview/preview.routes.ts`). `DevPort = {port, pid, process}`.
  As portas vêm do sistema operativo (descendentes do `claude` do terminal, só loopback/*any*, sem a `PORT` do backend
  nem `9229`); o cliente só escolhe uma das oferecidas. Desliga-se sozinha quando o terminal sai/fecha/é reaberto ou a
  porta deixa de escutar (verificação a cada 15 s). Sem `TAILSCALE_BIN` as rotas existem e dão `404 PREVIEW_006`.
  `PREVIEW_007` (Serve por ativar na tailnet) traz o link de ativação na `message`.
  `remoteControl: true` = lançado com `--remote-control` (só o bot de Telegram o liga; o `POST` não tem esse campo —
  [[adr/0017-bot-telegram-e-remote-control]]).
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

## Atalhos (`keybindings/`, `/api/keybindings`) — ✅

Todas com sessão (`AUTH_002`); todas devolvem a vista inteira, `KeybindingsView`
([[adr/0016-atalhos-editaveis-no-state]], [[features/atalhos-editaveis]]).

| Método | Rota | Corpo | Resposta | Erros |
|---|---|---|---|---|
| GET | `/api/keybindings` | — | `KeybindingsView` | — |
| PUT | `/api/keybindings/:actionId` | `{binding: {modifier: 'alt'\|'altGraph', code} \| null}` | `KeybindingsView` | `COMMON_001` (ex.: `modifier: 'ctrl'`) · `KEYBIND_001` · `KEYBIND_002` · `KEYBIND_003` |
| DELETE | `/api/keybindings/:actionId` | — | `KeybindingsView` (essa ação no predefinido) | `KEYBIND_003` |
| POST | `/api/keybindings/reset` | — | `KeybindingsView` (todas no predefinido) | — |

- `KeybindingsView = {actions: [{id, label, group, default, binding}], warnings: [{modifier, code, reason}]}`.
  `binding` é a bind em vigor (alteração ou predefinido), `null` = sem atalho. `group` é
  `terminals`/`jump`/`projects`/`navigation`. O catálogo (rótulos, predefinidos, teclas permitidas, avisos) só
  existe em `backend/src/keybindings/catalog.ts` — o frontend lê-o daqui.
- `code` canónico: o frontend converte o teclado numérico e o `\` do teclado PT (`Backquote`/`IntlBackslash` →
  `Backslash`) antes de enviar.
- `warnings`: combinações que funcionam mas tiram a tecla ao shell ou ao browser — o servidor aceita-as; a UI
  avisa e pede confirmação.
- Gravar o predefinido de volta apaga a alteração do `state.json` (fica só o que mudou).

## Biblioteca (`library/`, `/api/library`) — ✅

Lida do disco a cada pedido, só leitura ([[adr/0005-biblioteca-lida-do-disco]]). As três rotas `GET` devolvem
`{entries, invalid}`, com `entries` ordenadas por `name`:

| Método | Rota | Acesso | Lê | Cada entrada | Erros |
|---|---|---|---|---|---|
| GET | `/api/library/stacks` | sessão | `library/stacks/<id>/STACK.md` | `{id, name, layer, technologies, pairsWith, providesSkills, …comum}` | `AUTH_002` · `LIBRARY_001` |
| GET | `/api/library/themes` | sessão | `library/frontend/themes/<id>/THEME.md` | `{id, name, mode, density, suits, frontendStacks, fonts, …comum}` | `AUTH_002` · `LIBRARY_001` |
| GET | `/api/library/skills` | sessão | `library/skills/**` e `library/stacks/<id>/skills/**` | `{name, category, appliesWhen, description, stack, …comum}` | `AUTH_002` · `LIBRARY_001` |

- **Comum**: `maturity` (`proven`/`partial`/`draft`: os três chips do ecrã), `maturityRaw` (o valor escrito
  no manifesto, mostrado na tag), `updated` (string ou `null`), `path` (caminho absoluto do manifesto).
- **Maturidade normalizada**: stacks `proven`/`partial`/`planned`, designs `proven`/`adapted`/`draft`,
  skills `proven`/`adapted`/`prospective` → `adapted` conta como `partial`; `planned`/`prospective` como
  `draft`.
- `technologies` são as chaves de `versions`; `stack` só vem preenchido nas skills de dentro de uma stack.
- Pastas começadas por `_` ou `.` são ignoradas; agentes não entram.
- **Um manifesto inválido nunca é fatal**: vai para `invalid[]` como `{path, message}` (caminho relativo +
  razão do zod/YAML), e o resto da lista vem na mesma. Só a falta da pasta `library/` dá `500 LIBRARY_001`.

`LIBRARY_002`–`LIBRARY_005` eram do upload direto de uma skill ([[adr/0014-escrita-controlada-biblioteca]]),
que saiu com o [[adr/0019-importar-pelas-skills-do-workflow]] — retirados, não se reutilizam. Acrescentar à
biblioteca é pelas **Importações**, abaixo.

## Importações (`imports/`, `/api/library/imports`) — 🚧

[[adr/0019-importar-pelas-skills-do-workflow]] · spec [[features/importar-para-a-biblioteca]]. A app não escreve
na biblioteca: lança o `/import` do Workflow num terminal escondido e segue-o; no fim o dono revê o diff e aceita
(commit no Workflow) ou descarta. Uma importação de cada vez.

| Método | Rota | Corpo | Resposta | Erros |
|---|---|---|---|---|
| POST | `/api/library/imports` | `multipart/form-data`: um campo `request` (JSON, abaixo) e, com `source.type: 'files'`, uma parte `files` por entrada de `source.paths`, **pela mesma ordem** (o nome do ficheiro enviado é ignorado) | `201 ImportView` | `COMMON_001` · `AUTH_002` · `FOLDER_001` · `IMPORT_002` · `IMPORT_003` · `IMPORT_004` · `IMPORT_006` · `TERMINAL_002` · `TERMINAL_005` · `TERMINAL_007` |
| GET | `/api/library/imports/current` | — | `200 ImportView \| null` | `AUTH_002` · `IMPORT_006` |
| POST | `/api/library/imports/:id/reveal` | — | `200 TerminalView` (agora `hidden: false`) | `AUTH_002` · `IMPORT_001` |
| GET | `/api/library/imports/:id/diff` | — | `200 {files: [{path, change: 'added'\|'modified'\|'deleted', diff, truncated}]}` — `git diff` para o que o HEAD tem, o ficheiro inteiro (linhas `+`) para o que é novo; binário → `(ficheiro binário, N bytes)`; acima de 200 KB por ficheiro, cortado | `AUTH_002` · `IMPORT_001` · `IMPORT_005` (não está em `review`) · `IMPORT_006` |
| POST | `/api/library/imports/:id/accept` | — | `200 {commit}` (sha) — `git add -- <os caminhos do git status>` + `git commit`, com o `commitMessage` do `result.json` se for uma linha `feat\|docs\|fix\|chore: …` (≤ 100), senão `feat: importa <kind> <id> para a biblioteca`; os hooks do Workflow correm; depois fecha o terminal e apaga a importação | `AUTH_002` · `IMPORT_001` · `IMPORT_005` · `IMPORT_006` (commit recusado — nada fica staged, a importação continua em `review`) |
| POST | `/api/library/imports/:id/discard` | — | `204` — fecha o terminal **primeiro**, `git checkout --` dos modificados/apagados, apaga os novos (e as pastas que ficam vazias), apaga a importação. Qualquer estado | `AUTH_002` · `IMPORT_001` · `IMPORT_006` |
| DELETE | `/api/library/imports/:id` | — | `204` — o mesmo que `discard` ("Cancelar" enquanto corre) | `AUTH_002` · `IMPORT_001` · `IMPORT_006` |

- **`request`** = `{kind: 'skill'|'design'|'stack'|'auto', source, answers}`. `source`: `{type: 'files', paths}` (1–200
  caminhos relativos com `/`) · `{type: 'url', url}` (só `http`/`https`) · `{type: 'project', path}` (dentro de
  `ALLOWED_ROOTS`) · `{type: 'text', text}` (até 8000). `answers` por `kind` — `stack`: `technology`, `layer`,
  `pairsWith[]`, `conflictsWith[]`, `whenToChoose`, `whenNot`, `versions` · `design`: `name`, `character`, `suits`,
  `notSuits` · `skill`: `target` (`'process'` ou o id de uma stack), `whenToUse` · `auto`: `notes`. Texto até 2000;
  um campo a mais é `COMMON_001`. Tudo isto vai **só** para o `request.json` — nada do cliente entra na linha de comando.
- **`ImportView`** = `{id, kind, sourceLabel, status, terminalId, createdAt, result, changedFiles, error}`. `status`:
  `running` · `needs-you` (o último hook foi `Stop`/`Notification` sem `result.json` — a skill parou à espera) ·
  `review` (há `result.json` e alterações no Workflow) · `rejected` (a triagem recusou, sem alterações) · `failed`
  (`result.json` inválido ou `status: failed`, ou o terminal acabou sem resultado — `error` diz qual). `result` é o
  `result.json` validado (contrato v1, `WORKFLOW_PATH/docs/import-contract.md`). `changedFiles` vem do `git status`
  e só se conta quando há resultado.
- Pré-condições, pela ordem: nenhuma importação aberta (`IMPORT_002`); os ficheiros batem com `source.paths` e a
  pasta do projeto está dentro de `ALLOWED_ROOTS`; o `git status` do Workflow vazio (`IMPORT_003`); o Workflow é de
  confiança para o Claude Code (`TERMINAL_007` — o diálogo de confiança tem "No, exit" por omissão e ninguém o vê).
- Nada fica a meio: um erro depois de criar a pasta apaga-a.
- **O git** (`imports/workflowGit.ts`, `GIT_BIN`, `cwd` = `WORKFLOW_PATH`, sem shell) só recebe caminhos tirados do
  próprio `git status`, e cada um é resolvido (com symlinks e junctions) e confirmado dentro do repo antes de ser lido,
  reposto ou apagado. Como a importação só começa com o repo limpo, "o que mudou" é "o que a importação fez" — mas
  se o dono mexer no Workflow à mão enquanto uma importação está aberta, isso entra no diff (e no commit).

## Novo projeto (`creation/`, `/api/creations`) — 🚧

Spec [[features/novo-projeto-guiado]]. Lança o `/create` do Workflow em modo app como uma sessão guiada (abaixo);
tudo o que vem depois do arranque passa por `/api/guided`. Uma criação de cada vez.

| Método | Rota | Corpo | Resposta | Erros |
|---|---|---|---|---|
| POST | `/api/creations` | `{description}` (1–8000, sem espaços nas pontas) — vai **só** para `DATA_DIR/guided/<id>/brief.md` | `201 GuidedView` | `AUTH_002` · `COMMON_001` · `CREATE_001` · `LIBRARY_001` · `FOLDER_001` · `TERMINAL_002` · `TERMINAL_005` · `TERMINAL_007` (o Workflow ainda não é de confiança) |
| GET | `/api/creations/current` | — | `200 GuidedView \| null` — a mais recente aberta | `AUTH_002` |
| POST | `/api/creations/:id/open` | — | `201 TerminalView` — um terminal **visível**, novo, em `result.projectPath` | `AUTH_002` · `GUIDED_001` · `CREATE_002` · `FOLDER_001` (fora de `ALLOWED_ROOTS`) · `TERMINAL_*` |

Fechar uma criação terminada, ou cancelar uma a correr, é o `DELETE /api/guided/:id`.

## Upwork (`upwork/`, `/api/upwork`) — 🚧

[[adr/0022-seccao-upwork]] · spec [[features/upwork]]. O perfil de freelancer e as candidaturas; cada candidatura é um
registo em `DATA_DIR/upwork/applications/<id>/` mais uma sessão guiada `upwork` (o `/upwork-proposal` do Workflow).
A conversa (perguntas, permissões, feed, modo) passa por `/api/guided`. **Nenhuma rota fala com a Upwork.**

| Método | Rota | Corpo | Resposta | Erros |
|---|---|---|---|---|
| GET | `/api/upwork/profile` | — | `200 {markdown, updatedAt \| null}` — o modelo inicial (`updatedAt: null`) enquanto não há perfil | `AUTH_002` |
| PUT | `/api/upwork/profile` | `{markdown}` (1–20 000, sem espaços nas pontas) | `200 {markdown, updatedAt}` | `AUTH_002` · `COMMON_001` |
| GET | `/api/upwork/applications?archived=true\|false` | — | `200 ApplicationView[]`, mais recente primeiro (omissão `false`) | `AUTH_002` · `COMMON_001` |
| POST | `/api/upwork/applications` | `{job (1–20 000), screeningQuestions?: string[] (≤ 15, cada 1–1000), url?}` — `url` só `https://www.upwork.com/…`, guardado como link e **fora** do `job.md` | `201 ApplicationView` — o registo e a sessão guiada (`job.md` + cópia do `profile.md`) | `AUTH_002` · `COMMON_001` · `UPWORK_002` · `LIBRARY_001` · `TERMINAL_002` · `TERMINAL_005` · `TERMINAL_007` |
| GET | `/api/upwork/applications/:id` | — | `200 ApplicationView` | `AUTH_002` · `UPWORK_001` |
| PATCH | `/api/upwork/applications/:id` | `{status?, clientName?, connectsSpent? (0–500), notes? (≤ 8000), url?}` — pelo menos um | `200 ApplicationView` — um `status` diferente junta-se ao `history`; passar a `sent` **pausa** a sessão | `AUTH_002` · `COMMON_001` · `UPWORK_001` · `UPWORK_004` |
| POST | `/api/upwork/applications/:id/pause` | — | `200 ApplicationView` — fecha o terminal, a sessão fica (`stopped`); já parada não é erro | `AUTH_002` · `UPWORK_001` · `UPWORK_004` · `UPWORK_005` (sem sessão) |
| POST | `/api/upwork/applications/:id/message` | `{text}` (1–8000) | `204` — numa sessão `stopped` **acorda-a** primeiro (`--resume`, espera pelo `SessionStart` e por 1 s de ecrã quieto — 3–6 s) e só depois cola; senão igual a `/api/guided/:id/message` | `AUTH_002` · `COMMON_001` · `UPWORK_001` · `UPWORK_005` · `GUIDED_004` (a trabalhar, ou não ficou pronta em 60 s — tentar de novo) · `TERMINAL_*` |
| POST | `/api/upwork/applications/:id/archive` | — | `200 ApplicationView` — copia o pacote para `applications/<id>/package/`, fecha e apaga a sessão (`guidedId: null`), sai da lista por omissão | `AUTH_002` · `UPWORK_001` · `UPWORK_004` |
| POST | `/api/upwork/applications/:id/project` | `{agreement}` (1–20 000) — o acordo final colado pelo dono | `201 GuidedView` (a **criação**, no ecrã Novo projeto) — só com `status: 'won'`; grava `agreement` e `creationGuidedId`; o brief do `/create` é anúncio + carta enviada + plano técnico + acordo, por esta ordem (≤ 60 000: a carta e o plano cedem, o acordo nunca) | `AUTH_002` · `COMMON_001` · `UPWORK_001` · `UPWORK_003` · `UPWORK_004` · `CREATE_001` · `LIBRARY_001` · `TERMINAL_*` |
| DELETE | `/api/upwork/applications/:id` | — | `204` — o registo, o pacote arquivado e a sessão | `AUTH_002` · `UPWORK_001` |

- **`ApplicationView`** = o registo (`{id, title, url, clientName, status, history: {status, at}[], connectsSpent,
  notes, guidedId, agreement, creationGuidedId, projectPath, archived, createdAt, updatedAt}`) + `guided: GuidedView
  | null` (`null` depois de arquivada, ou se a sessão foi fechada à mão) + `package` + `packageError`. `title` é o do
  `package.json` assim que existe (até lá, a 1.ª linha do anúncio). `status`: `draft` · `sent` · `interview` ·
  `offer` · `won` · `lost` · `withdrawn`, livre (qualquer para qualquer).
- **`PackageView`** = `{title, language, verdict: 'apply'|'maybe'|'skip', updatedAt, analysis, coverLetter, screening,
  plan, clientQuestions}` — cada parte o Markdown do ficheiro (≤ 50 000; em falta → `null`), lido do `package.json` da
  sessão (ou da cópia arquivada). Um `package.json` inválido, ou que nomeie um ficheiro com pasta → `package: null` e
  `packageError` com o campo.
- **`projectPath`**: quando a criação começada por `/project` acaba com `result.projectPath`, a candidatura copia-o ao
  ser lida (GET de uma ou da lista) — antes de o dono fechar a criação. Fechada antes de alguém ler a candidatura, o
  caminho perde-se (a UI lê-a enquanto a criação corre).

## Sessões guiadas (`guided/`, `/api/guided`) — 🚧

[[adr/0020-sessoes-guiadas]] · spec [[features/novo-projeto-guiado]]. Um terminal escondido cujas perguntas
(`AskUserQuestion`) e permissões chegam à app por hooks bloqueantes, e a quem o dono responde sem ver o TUI.
Genérico: estas rotas **não começam** sessões — quem começa é a rota do propósito (`/api/creations`, passo 6).

| Método | Rota | Corpo | Resposta | Erros |
|---|---|---|---|---|
| GET | `/api/guided/:id` | — | `200 GuidedView` | `AUTH_002` · `GUIDED_001` |
| GET | `/api/guided/:id/feed?after=<n>` | — | `200 {entries: FeedEntry[], cursor}` — a conversa, do `.jsonl` da sessão, com o brief como 1.ª entrada. `after` = quantas entradas o cliente já tem (omissão 0 = todas); a última dessas vem **outra vez** (só ela pode ainda mudar — uma atividade que cresce, uma pergunta que recebe a resposta) e o cliente substitui-a pelo `id`. `cursor` = o total | `AUTH_002` · `COMMON_001` · `GUIDED_001` |
| POST | `/api/guided/:id/answer` | `{requestId, answers: {<texto da pergunta>: <label \| labels separados por ", " \| texto do "Outro">}}` — uma resposta por pergunta, nenhuma a mais | `204` | `AUTH_002` · `COMMON_001` · `GUIDED_001` · `GUIDED_002` |
| POST | `/api/guided/:id/permission` | `{requestId, decision: 'allow'\|'deny'}` | `204` | `AUTH_002` · `COMMON_001` · `GUIDED_001` · `GUIDED_002` |
| PUT | `/api/guided/:id/mode` | `{mode: 'ask'\|'auto'}` — Perguntar / Automático ([[adr/0021-permissoes-das-sessoes-guiadas]]); `auto` aprova também as permissões já à espera; as perguntas nunca | `200 GuidedView` | `AUTH_002` · `COMMON_001` · `GUIDED_001` |
| POST | `/api/guided/:id/message` | `{text}` (1–8000, sem espaços nas pontas) | `204` — escrito no PTY como **um** bracketed paste, sem caracteres de controlo (exceto `\n`, `\t`; `\r\n` → `\n`), e Enter à parte | `AUTH_002` · `COMMON_001` · `GUIDED_001` · `GUIDED_003` · `GUIDED_004` |
| POST | `/api/guided/:id/resume` | `{cols, rows}` | `200 GuidedView` — o `reopen` do terminal (`--resume`, com os mesmos `--settings`, `--add-dir` e `--permission-mode default`); fica `waiting-text` | `AUTH_002` · `COMMON_001` · `GUIDED_001` · `TERMINAL_*` (`TERMINAL_006` se ainda corre) |
| POST | `/api/guided/:id/reveal` | — | `200 TerminalView` (`hidden: false`) | `AUTH_002` · `GUIDED_001` |
| DELETE | `/api/guided/:id` | — | `204` — fecha o terminal (vai para o histórico), apaga a pasta e o índice; um hook à espera acaba sem decisão | `AUTH_002` · `GUIDED_001` |

- **`GuidedView`** = `{id, purpose: 'create' | 'upwork', status, terminalId, createdAt, pending, result, error}`. `pending`:
  `{requestId, type: 'question', questions: [{question, header, multiSelect, options: [{label, description}]}]}` ·
  `{requestId, type: 'permission', tool, summary}` (o comando, ou o caminho — nunca o conteúdo a escrever) · `null`.
  `result`: o `result.json` validado (contrato do Workflow, `skill-create.md` → "Modo app").
- **`FeedEntry`** (`guided/transcriptFeed.ts`): `{id, type: 'assistant-text', markdown, at}` ·
  `{id, type: 'user-text', text, at}` · `{id, type: 'question', questions, answers | null, at}` ·
  `{id, type: 'permission', summary, decision: 'allow'|'deny', at}` (`summary` = `<ferramenta>: <comando ou caminho>`) ·
  `{id, type: 'activity', summary, count, at}` (chamadas seguidas agrupadas: "Leu 2 ficheiros · Correu 1 comando").
  Não aparecem: linhas de sistema, o corpo das skills, resultados de ferramentas, pensamento, sub-agentes, o slash
  command inicial. Uma permissão ainda por decidir aparece como atividade até ter decisão.
- **`status`** deriva-se, por esta ordem: `done`/`failed` (há `result.json`; inválido → `failed` com o campo em
  `error`) · `stopped` (o terminal não corre) · `question`/`permission` (um pedido à espera cujo hook está vivo —
  o mais antigo) · `needs-you` (um pedido cujo hook morreu, ou o último evento é `Notification`) · `waiting-text`
  (o último evento é `Stop`) · `working`.
- **Lançamento** (`terminals/claudeArgs.ts`, `kind: 'guided'`): `--add-dir <DATA_DIR/guided/<id>>`, `--session-id`,
  `--settings <DATA_DIR/claude-guided-settings.json>`, `--permission-mode default`, e por último o comando do
  propósito — `/create --app <DATA_DIR/guided/<id>/brief.md>`, caminho validado (`<…>/<uuid>/brief.md`). `cwd` de
  confiança (`TERMINAL_007`).

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
| POST | `/api/auth/passkeys/login/options` | **público**, 30/min por IP (limite próprio — só emite um challenge) | — | `PublicKeyCredentialRequestOptionsJSON` (sem `allowCredentials`: passkeys descobríveis; `userVerification: required`) | `AUTH_004` 429 |
| POST | `/api/auth/passkeys/login` | **público**, no contador partilhado de 5/min | `{response}` (o `AuthenticationResponseJSON` do `startAuthentication()`) | `204` + `Set-Cookie: session` (igual ao login com password) | `COMMON_001` · `AUTH_005` · `AUTH_004` 429 |
| POST | `/api/auth/passkeys/registration/options` | sessão, no contador partilhado de 5/min | `{password}` | `PublicKeyCredentialCreationOptionsJSON` (`residentKey`/`userVerification: required`, `excludeCredentials` = as já registadas); challenge preso a esta sessão | `COMMON_001` · `AUTH_006` · `AUTH_007` · `AUTH_004` 429 |
| POST | `/api/auth/passkeys` | sessão | `{name, response}` (nome 1–64 depois de `trim`; o `RegistrationResponseJSON` do `startRegistration()`) | `201` + `PasskeySummary` | `COMMON_001` · `AUTH_007` · `AUTH_008` |
| GET | `/api/auth/passkeys` | sessão | — | `{passkeys: PasskeySummary[]}` | `AUTH_002` |
| DELETE | `/api/auth/passkeys/:id` | sessão | — | `204` — e **termina as sessões abertas com essa passkey** | `AUTH_009` |
| POST | `/api/auth/logout` | sessão | — | `204` + cookie limpo | `AUTH_002` |
| GET | `/api/auth/me` | sessão | — | `{authenticated:true, username}` — `username` = `APP_USERNAME` (mostrado no cabeçalho, junto ao ícone; só com sessão, por isso não ajuda a adivinhar o nome) | `AUTH_002` |
| GET | `/api/health` | **público** | — | `{status:"ok"}` | — |

- **Sem sessão, qualquer rota não pública dá `401 AUTH_002`** — incluindo rotas que não existem (só com
  sessão é que uma rota inexistente dá `404 COMMON_003`); a API não revela que rotas tem.
- Um login com sucesso termina a sessão anterior que o browser trazia (id novo a cada login).
- `PasskeySummary` = `{id, name, deviceType: "singleDevice"|"multiDevice", backedUp, createdAt, lastUsedAt|null, current}` — `current` diz que a sessão deste pedido foi aberta com essa passkey (revogá-la termina-a). A chave pública e o contador nunca saem do backend. Passkeys: [[adr/0015-passkeys-webauthn]], fluxo em [[security]].

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
