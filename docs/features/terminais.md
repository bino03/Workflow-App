# Feature: Terminais

| | |
|---|---|
| **Estado** | ✅ Concluída (2026-09-28) |
| **Criada** | 2026-09-28 |
| **Última sessão** | 2026-09-28 |
| **Passos** | 17 / 17 concluídos |

> Escrita para uma sessão que **não viu a conversa que a originou**. Se algo só faz sentido com contexto
> externo, falta escrevê-lo.

Inclui, numa só feature, o que o backlog tinha em seis itens: **Terminais**, **Terminais guardados**,
**Pastas recentes/favoritas**, **Retomar sessões**, **Definições (modo de layout)** e **Indicador de
quota**. Fonte das decisões: o plano `notes/roadmap/plans/2026-09-28-modelo-dados-biblioteca-terminais.md`
(pessoal, não versionado — tudo o que importa está copiado aqui), [[../database]] e o protótipo
`docs/design/handoff-2026-09-27/Terminais.dc.html` (ecrãs 1g foco · 1h foco dividido · 1i grelha · 1j
drawer Novo terminal · 1k confirmar fechar).

---

## 1. O que é e porquê

Hoje, para trabalhar com várias sessões do Claude Code ao mesmo tempo, abrem-se vários terminais do
sistema, perde-se a noção de qual está a fazer o quê, e retomar uma conversa antiga obriga a saber o
UUID. Esta feature põe as sessões do `claude` (o CLI interativo, num PTY — nunca a API,
[[../adr/0002-motor-via-pty-sobre-subscricao]]) numa página só: abrir numa pasta autorizada, ver e
escrever em tempo real, vários em paralelo, retomar sessões gravadas, e reabrir tudo depois de o backend
reiniciar. Mostra também quanto da quota da subscrição já foi gasto.

**Como sei que está bem feito:** abro a app de manhã, vejo os terminais de ontem como *parados*, carrego
em **Reabrir todos** e cada um volta à conversa onde estava. Abro um novo em `D:\projetos\api-faturas`
escolhendo a pasta nas recentes, alterno entre eles com `Alt+1…9`, divido o ecrã com `Alt+\`, fecho um
com `Alt+W`, e no dia seguinte encontro a conversa fechada na lista **Retomar** daquela pasta, com o
resumo.

## 2. Âmbito

### Dentro
- **Terminais**: abrir (pasta dentro de `ALLOWED_ROOTS`), ver e escrever em tempo real (xterm.js ↔
  WebSocket ↔ PTY), resize, renomear, fechar (com confirmação); vários em paralelo até `MAX_TERMINALS`
  (8, só os **vivos** contam); religar com scrollback.
- **Guardados** (`state.json` → `terminals`): cada terminal novo arranca com `claude --session-id <uuid>`
  gerado pelo backend e fica gravado; depois de o backend reiniciar aparece **parado**, com **Reabrir** e
  **Reabrir todos** (`--resume <claudeSessionId>`). Nada reabre sozinho.
- **Fechados** (`closedTerminals`): ao fechar, entra no histórico com `summary` tirado do `.jsonl`
  (`ai-title`, senão a última mensagem do assistente cortada a 600; tolerante a formato — **nunca falha o
  fecho**). Mostrado na lista **Retomar** do drawer (não tem ecrã próprio).
- **Pastas** (`folders`): abrir um terminal atualiza `lastUsedAt`; favoritas + 10 recentes no drawer;
  marcar/desmarcar favorita.
- **Retomar sessões**: listar as sessões gravadas de uma pasta (`~/.claude/projects/`, ou
  `CLAUDE_CONFIG_DIR/projects/`) e abrir com `--resume <uuid>`; **Continuar a última** = o backend descobre
  a mais recente e usa `--resume` (nunca `--continue`).
- **Layouts** ([[../adr/0008-identidade-visual]]): **foco dividido** (por omissão: um terminal em foco;
  `Alt+\` divide em dois lado a lado e junta) · **grelha** (3 colunas, scroll depois de 6; clicar amplia
  temporariamente).
- **Definições**: drawer "Definições" (Small, 540) no menu de utilizador, com a escolha **foco dividido**
  (por omissão) / **grelha**; persiste no `localStorage`.
- **Atalhos** `Alt+1…9` saltar · `Alt+N` novo · `Alt+\` dividir/juntar · `Alt+W` fechar · `Alt+R`
  renomear — intercetados **antes** do PTY.
- **Quota** (se o spike do passo 1 a confirmar): janela de 5 h e semanal, com hora de reposição.

### ⛔ Fora — não implementar nesta feature
- **Estados "a trabalhar" / "à tua espera"** (arco, losango, alerta na lateral) — o protótipo mostra-os,
  mas no MVP só há **a correr / terminado / parado**. Está em `notes/ideas.md`.
- **Estado "Desligado" separado** (✕, "Reiniciar") — um `claude` que sai com código ≠ 0 é **terminado**, e o
  banner mostra o código. Não há "Reiniciar"; há **Reabrir** (`--resume`).
- **Resumo feito pelo Claude** (escrever um prompt no PTY) — recusado ([[../adr/0009-estado-em-ficheiro-json]]);
  ideia "Resumir" em `ideas.md`.
- **Ecrã de histórico** dos fechados, apagar entradas do histórico, pesquisa no histórico.
- **Scrollback em disco** ou a sobreviver ao reinício do backend — de propósito (conteúdo sensível).
- **`claude --continue`**, `claude -p`, Agent SDK, `ANTHROPIC_API_KEY` — nunca ([[../adr/0002-motor-via-pty-sobre-subscricao]]).
- **Qualquer comando/argumento vindo do cliente** além de pasta, UUID validado, rótulo e tamanho.
- **Exposição fora de `127.0.0.1`** — em `ideas.md`, vem depois desta feature.
- **Mobile / layouts estreitos** — só desktop ([[../adr/0008-identidade-visual]]).
- **Arrastar para reordenar** terminais, abas, temas do terminal, tamanho de letra configurável.

> Esta lista impede uma sessão futura de expandir o âmbito sozinha.

### Segunda fase (se houver)
- Estados "a trabalhar"/"à tua espera" (precisa de uma fonte fiável — talvez hooks do Claude Code).
- Botão **Resumir** (ideia em `ideas.md`).
- Ecrã de histórico, se a lista Retomar deixar de chegar.

## 3. Decisões tomadas

| Decisão | Escolha | Porquê | Alternativa rejeitada |
|---|---|---|---|
| Vida dos PTYs sem browser | Continuam até **Fechar** ou reinício do backend | Fechar o browser não pode matar trabalho a meio | Matar ao desligar o último WebSocket |
| `MAX_TERMINALS` | 8 (omissão atual); só os vivos contam; parados do `state.json` não | A quota é partilhada; 8 cobre o uso real | Sem limite |
| Scrollback ao religar | 1 MiB cru em memória (`SCROLLBACK_BYTES`); o cliente faz `term.reset()` ao receber `ready`, e um resize ±1 força a TUI a redesenhar | O `claude` redesenha por cima; bytes crus reproduzem o ecrã sem interpretar ANSI no servidor | `@xterm/headless` no servidor com snapshot (mais fiel, mais peso — reabrir se o redesenho falhar) |
| Terminal cujo `claude` saiu sozinho | Fica **terminado** em memória e em `terminals`; banner no próprio painel com **Reabrir** (`--resume`) | Não se perde a posição nem o rótulo | Removê-lo sozinho |
| ~~Reabrir com o `.jsonl` em falta~~ | ~~Erro próprio `TERMINAL_004`~~ — **substituída a 2026-09-28** (linha seguinte) | | |
| Reabrir com o `.jsonl` em falta (mudado a 2026-09-28, depois da verificação no browser) | Reabrir lança uma **sessão nova no mesmo terminal** (`--session-id` com o mesmo UUID, mesma pasta e rótulo) e a resposta traz `freshSession: true`; a UI avisa com uma linha | O `claude` **não grava sessões sem mensagens** (confirmado: abrir e fechar sem conversa não deixa `.jsonl`), e reabrir um terminal assim dava sempre `TERMINAL_004`. Não havia conversa a perder; no caso raro de uma sessão apagada ao fim de 30 dias, o aviso diz que a anterior já não estava gravada | Manter o erro `TERMINAL_004` (o terminal ficava inútil). `TERMINAL_004` continua em **retomar** uma sessão escolhida na lista |
| Organização da lateral (pedido do dono a 2026-09-28, a meio do passo 12) | **Por projetos**: um projeto = **uma pasta** (nada novo a gravar). A lateral agrupa os terminais pela pasta; cada projeto tem um **+** que abre logo um terminal nessa pasta (sessão nova, sem drawer). Projetos listados = pastas com terminais ∪ favoritas | O dono trabalha por projeto; vários terminais do mesmo projeto abrem sempre na mesma pasta | Entidade `Project` própria com nome (schema v2 + ADR) — fica para quando fizer falta mais do que a pasta; escolher o projeto primeiro e ver só os terminais dele |
| Continuar a última | O backend descobre a sessão mais recente da pasta e usa `--resume <uuid>` | Um só caminho de arranque, e o `claudeSessionId` fica sempre conhecido | `claude --continue` (não se saberia o UUID) |
| Retomar uma sessão já aberta noutro terminal | Recusado (`TERMINAL_003`) | Dois processos a escrever o mesmo `.jsonl` corrompem a conversa | Permitir |
| Terminais fora do ecrã (layout) | xterm.js e WebSocket ficam **montados** (escondidos) | Trocar de terminal é instantâneo e não há replay | Desmontar e religar |
| Histórico dos fechados | Só na lista **Retomar** do drawer: a sessão gravada mostra o rótulo e o `summary` do terminal fechado que a usou | Sem ecrã novo no MVP; é onde se procura uma conversa antiga | Secção "Fechados recentemente"; só guardar |
| Favoritas e recentes | Lista "Favoritas · Recentes" **por cima** do navegador de pastas no drawer; estrela em cada linha | É o atalho mais usado; o navegador é o recurso | Chips junto às raízes |
| Clicar na grelha | **Amplia temporariamente** (foco sem mudar a preferência; `Esc` ou "Voltar à grelha") | Olhar para um terminal não é mudar de modo | Mudar para foco dividido; só dar o teclado |
| Fonte da quota | Status line injetada: `claude --settings <DATA_DIR>/claude-settings.json` com um `statusLine` fixo que grava o JSON recebido (`rate_limits.five_hour` / `seven_day`) em `DATA_DIR/usage.json` — **confirmado no spike (passo 1)**, formato em §4.3 | É a única fonte sem API ([[../adr/0002-motor-via-pty-sobre-subscricao]]) | Ler `~/.claude` (não tem a quota); chamar a API |
| Se o spike não confirmar a quota | O indicador **sai da spec** e volta a `ideas.md` com o que se encontrou; o resto segue | Não bloquear os terminais por causa do indicador | Mostrar custo/tokens da sessão no lugar |
| Quota sem valor fresco | Último valor a cinzento + "há X min"; "—" depois da hora de reposição | Um valor velho não pode parecer atual | Esconder |
| Pastas fora de `ALLOWED_ROOTS` | Escondidas (favoritas/recentes que já não cabem nas raízes não aparecem) | As raízes podem mudar no `.env` | Mostrar desativadas |
| Diálogo de *trust* do `claude` numa pasta nova | Aparece no próprio terminal e responde-se lá | É do `claude`; a app não escreve no PTY | Aceitar automaticamente |
| Atalhos `Alt+…` | Intercetados no `attachCustomKeyEventHandler` do xterm.js antes de chegarem ao PTY | `Ctrl+…` é do Claude Code/browser; `Ctrl+Alt` é AltGr em teclado PT | `Ctrl+Shift+…` |
| Tamanho do PTY com o mesmo terminal em dois separadores | O último `resize` ganha | Um PTY tem um só tamanho | Tamanho mínimo entre clientes |
| Fechar | Sempre com confirmação (1k): "O processo do Claude Code termina. A conversa fica gravada e podes retomá-la em Novo terminal → Retomar." | Fechar mata o processo | Sem confirmação |
| Terminal a sair enquanto não está visível | Toast "`<nome>` terminou · A sessão ficou gravada" com **Reabrir** | Sem estados de trabalho, é o único aviso | Nada |
| Pastas escondidas no navegador | Nomes começados por `.` não aparecem | Ruído (`.git`, `.vscode`) | Mostrar tudo |

**ADRs gerados:** [[../adr/0012-argumentos-do-claude-e-status-line]] — os argumentos que o backend passa ao
`claude` (`--session-id`, `--resume`, `--settings`) e a status line da quota.

## 4. Desenho técnico

### 4.1 Dados

Nada novo no schema — `terminals`, `closedTerminals` e `folders` já estão em
`backend/src/state/state.schema.ts` (v1) e descritos em [[../database]]. O `StateStore`
(`backend/src/state/stateStore.ts`) já valida, aplica limites (200 fechados, 10 recentes) e escreve em fila.

Estado **em memória** (não persistido): o `TerminalManager` (`backend/src/terminals/terminalManager.ts`) —
PTY, `status: 'running' | 'exited'`, `exitCode`, scrollback. O **estado visível** calcula-se ao listar:

| Em `terminals` (state.json) | Em memória | Estado mostrado |
|---|---|---|
| ✅ | `running` | **a correr** |
| ✅ | `exited` | **terminado** (banner com o código e Reabrir) |
| ✅ | ausente | **parado** (reinício do backend; Reabrir / Reabrir todos) |

Ficheiros novos em `DATA_DIR` (escritos pelo backend, nunca pelo cliente):
- `claude-settings.json` — `{ "statusLine": { "type": "command", "command": "\"<node>\" \"<DATA_DIR>/statusline.cjs\"" } }`
  (`<node>` = `process.execPath`, absoluto).
- `statusline.cjs` — lê o JSON do stdin, grava-o atómico em `DATA_DIR/usage.json`, imprime uma linha
  curta (modelo + pasta) para a status line continuar útil.
- `usage.json` — o último JSON recebido (só se lê `rate_limits`).

Sessões gravadas do Claude Code: `<CLAUDE_CONFIG_DIR ou ~/.claude>/projects/<cwd codificado>/<uuid>.jsonl`,
onde o `cwd` codificado troca cada carácter não alfanumérico por `-` (`C:\dev\app` → `C--dev-app`) —
**confirmado no spike do passo 1**: `C:\Users\jlalv\Desktop\utad\projetos\WorkFlow App` →
`C--Users-jlalv-Desktop-utad-projetos-WorkFlow-App` (`:`, `\` e espaço → `-`). Linhas que o leitor usa (Claude Code 2.1.283):
`{type:"ai-title", aiTitle}` (repete-se; conta a última), `{type:"user"|"assistant", message:{content}, timestamp,
isMeta?, isSidechain?}` — `content` é texto ou blocos; um `user` com blocos `tool_result` é resultado de ferramenta, e um
prompt que começa por `<` é eco de um comando do CLI (`<command-name>…`); nenhum destes conta como mensagem. Com `--session-id <uuid>` o
ficheiro chama-se `<uuid>.jsonl` e existe logo depois do arranque, mesmo sem mensagens. O JSON da status
line também traz o `transcript_path` — confirma o caminho sem o codificar.

### 4.2 Endpoints

Todos com sessão (`AUTH_002` sem ela). Documentar em [[../api]] ao implementar (substitui a proposta 🚧).

| Método | Rota | Corpo / query | Resposta | Erros |
|---|---|---|---|---|
| GET | `/api/terminals` | — | `TerminalView[]` (guardados, por `createdAt`) | — |
| POST | `/api/terminals` | `{cwd, mode: 'new'\|'resume'\|'continue', sessionId?, label?, cols, rows}` | `201 TerminalView` | `COMMON_001` · `FOLDER_001` · `TERMINAL_002` · `TERMINAL_003` · `TERMINAL_004` · `TERMINAL_005` · `SESSION_001` |
| POST | `/api/terminals/:id/reopen` | `{cols, rows}` | `200 TerminalView & {freshSession}` (sem `.jsonl` → sessão nova no mesmo terminal, §3) | `TERMINAL_001` · `TERMINAL_002` · `TERMINAL_005` · `TERMINAL_006` · `FOLDER_001` (a pasta saiu das raízes) |
| PATCH | `/api/terminals/:id` | `{label: string \| null}` (≤ 80, lista branca) | `200 TerminalView` | `COMMON_001` · `TERMINAL_001` |
| DELETE | `/api/terminals/:id` | — | `204` — mata a árvore se vivo, grava em `closedTerminals` com `summary` | `TERMINAL_001` |
| WS | `/api/terminals/:id/ws` | protocolo em [[../api]] → "Protocolo do WebSocket" (já fixado) | — | `AUTH_002` · `AUTH_003` · fecha com `4404` se o terminal não está em memória |
| GET | `/api/sessions?cwd=` | `cwd` dentro das raízes | `SavedSession[]` (mais recente primeiro) | `FOLDER_001` |
| GET | `/api/folders` | — | `{roots: string[], favorites: FolderView[], recents: FolderView[]}` | — |
| GET | `/api/folders/browse?path=` | `path` dentro das raízes | `{path, parent: string \| null, entries: {name, path, sessionCount}[]}` | `FOLDER_001` |
| PUT | `/api/folders/favorite` | `{path, favorite: boolean}` | `204` | `COMMON_001` · `FOLDER_001` |
| GET | `/api/usage` | — | `UsageView` | — (sem dados → campos `null`) |

- `mode: 'new'` → o backend gera o UUID e lança `claude --session-id <uuid>`; `'resume'` → `sessionId`
  obrigatório (UUID), `claude --resume <sessionId>`; `'continue'` → a sessão mais recente da pasta, como
  `'resume'`; sem nenhuma → `SESSION_001`.
- Criar e reabrir atualizam `folders` (`lastUsedAt`) e `lastOpenedAt`.
- `parent` do browse é `null` na raiz (nunca se sobe acima de uma raiz).
- O WebSocket fecha-se quando a sessão de login acaba (`sessionStore.onEnd`, já existe) e quando o
  terminal é fechado.

### 4.3 Tipos / DTOs

```ts
// backend/src/terminals/terminal.schemas.ts  ↔  frontend/src/types/terminal.ts
type TerminalStatus = 'running' | 'exited' | 'stopped';
type TerminalView = {
  id: string; label: string | null; cwd: string; claudeSessionId: string;
  status: TerminalStatus; exitCode: number | null;
  createdAt: string; lastOpenedAt: string;
};
type CreateTerminalBody = { cwd: string; mode: 'new' | 'resume' | 'continue'; sessionId?: string; label?: string; cols: number; rows: number };

// backend/src/sessions/  ↔  frontend/src/types/session.ts
type SavedSession = {
  id: string;                 // UUID do .jsonl
  startedAt: string | null; updatedAt: string;   // updatedAt = mtime do ficheiro
  messageCount: number;       // linhas user + assistant
  preview: string | null;     // ai-title, senão a 1.ª mensagem do utilizador (≤ 140)
  closed: { label: string | null; summary: string | null; closedAt: string } | null; // de closedTerminals
  openIn: string | null;      // id do terminal vivo que a usa → Retomar desativado
};

// backend/src/folders/  ↔  frontend/src/types/folder.ts
type FolderView = { path: string; favorite: boolean; lastUsedAt: string | null };

// backend/src/usage/  ↔  frontend/src/types/usage.ts
type UsageWindow = { usedPct: number; resetsAt: string };
type UsageView = { fiveHour: UsageWindow | null; weekly: UsageWindow | null; fetchedAt: string | null };
```

**Formato real** (spike do passo 1, 2026-09-28, `claude` 2.1.283, `backend/scripts/statusline-spike.ts`): o JSON
que o Claude Code entrega à status line traz, **só depois da primeira resposta da API** numa sessão:

```json
"rate_limits": {
  "five_hour": { "used_percentage": 44, "resets_at": 1790607000 },
  "seven_day": { "used_percentage": 61, "resets_at": 1790780400 }
}
```

`used_percentage` em 0–100, `resets_at` em **segundos Unix** (→ ISO no `UsageView`). O primeiro JSON de uma
sessão acabada de abrir (sem pedidos) **não** tem `rate_limits` — tem `session_id`, `transcript_path`, `cwd`,
`model`, `workspace`, `cost`, `context_window`, `version`, entre outros. Consequências para o passo 8:
- o `statusline.cjs` só reescreve `usage.json` quando o JSON traz `rate_limits` (senão cada terminal novo
  apagava o valor) e guarda também `fetchedAt` (agora);
- sem atividade em nenhum terminal o valor não se atualiza — é a regra "valor velho a cinzento + há X
  min" de §3.

### 4.4 Interface

- **Onde vive**: rota `/terminals` (já existe como placeholder em `frontend/src/pages/TerminalsPage.tsx`;
  é a rota por omissão depois do login).
- **Como se chega lá**: item "Terminais" na navegação do `AppLayout`.
- **Ficheiros** (novos, salvo indicação):
  - `pages/TerminalsPage.tsx` (substitui o placeholder) — escolhe o layout.
  - `hooks/useTerminals.ts` — lista, criar, reabrir, renomear, fechar; dono do estado da página.
  - `hooks/useLayoutMode.ts` — `useSyncExternalStore` sobre `localStorage` (`workflow-app.layout`:
    `focus` = foco dividido | `grid` = grelha; omissão `focus`), partilhado entre a página e o drawer Definições.
  - `hooks/useTerminalShortcuts.ts` — `Alt+…` (também usado pelo `TerminalView`).
  - `hooks/useUsage.ts` — `GET /api/usage` a cada 60 s.
  - `components/terminals/TerminalView.tsx` — xterm.js + `FitAddon` + WebSocket; **a instância e o socket
    não vão para Context nem para estado de React** ([[../frontend-conventions]] → Terminais).
  - `components/terminals/TerminalPane.tsx` — cabeçalho (ícone de estado, nome, tag, pasta, "⌨ TECLADO
    AQUI", ações Renomear/Dividir/Fechar) + `TerminalView` + banner (terminado/parado → Reabrir).
  - `components/terminals/TerminalSidebar.tsx` — 288 px, **agrupada por projeto (pasta)** desde 2026-09-28 (§3):
    cabeçalho do projeto (nome da pasta, caminho no title, estrela de favorita, **+** que abre um terminal nessa
    pasta) com os terminais por baixo. Por cima: kicker + "N abertos", **+ Novo terminal Alt+N** (drawer, para
    uma pasta nova ou para retomar),
    contagens por estado, lista (nome, pasta mono, estado · detalhe, `Alt+n`), **Reabrir todos** quando há
    parados, e a quota em baixo.
  - `components/terminals/TerminalGrid.tsx` — 3 colunas, cartão "Novo terminal" tracejado, scroll depois de 6.
  - `components/terminals/new/NewTerminalDrawer.tsx` (540) + `FolderPicker.tsx` (favoritas · recentes,
    chips das raízes, navegador um nível de cada vez com "N sessões gravadas") + `SessionPicker.tsx`
    (Sessão nova · Continuar a última · Retomar uma sessão gravada + lista com data, mensagens, preview ou
    rótulo+resumo do fechado) + `newTerminalFormSchema.ts`. Rodapé: resumo à esquerda ("Retoma 26 set ·
    18:42 em D:\projetos\api-faturas"), Cancelar + ação primária ("Abrir terminal" / "Retomar sessão").
  - `components/terminals/QuotaMeter.tsx` — variante lateral (barras 5 px) e variante cabeçalho (96 px),
    aviso "▲ Perto do limite" ≥ 80 %.
  - `components/settings/SettingsDrawer.tsx` (540) — aberto do menu de utilizador no `AppLayout`.
  - `services/{terminalService,sessionService,folderService,usageService}.ts`, `types/{terminal,session,folder,usage}.ts`.
- **Estado vazio**: sem terminais → no lugar do painel, "Nenhum terminal aberto" + botão **Novo terminal
  Alt+N**; a lateral mostra só o botão.
- **Visibilidade por role**: não há roles ([[../adr/0003-auth-utilizador-unico]]).
- Visual: tudo dos tokens; ícones de estado com `.state-icon.is-stop` (terminado/parado) e o arco
  `is-work` **não** se usa (fora do âmbito); "a correr" usa um ponto `accent` simples — **definir no
  passo 12 e registar em** [[../skills/references/design/tokens-and-colors]].

### 4.5 Códigos de erro novos

Em `backend/src/common/errors.ts` e espelhados 1:1 em `frontend/src/errors/errorMessages.ts`. ✅ Criados no passo 2 (2026-09-28);
a tabela de referência passou para [[../api]] → Códigos de erro.

| Código | HTTP | Mensagem no frontend |
|---|---|---|
| `TERMINAL_001` | 404 | Este terminal já não existe. |
| `TERMINAL_002` | 409 | Já tens o máximo de terminais abertos. Fecha um para abrir outro. |
| `TERMINAL_003` | 409 | Esta sessão já está aberta noutro terminal. |
| `TERMINAL_004` | 404 | A sessão gravada já não existe (o Claude Code apaga-as ao fim de 30 dias). |
| `TERMINAL_005` | 503 | O `claude` não foi encontrado no servidor. Confirma o CLAUDE_BIN. |
| `TERMINAL_006` | 409 | Este terminal já está a correr. |
| `FOLDER_001` | 403 | Esta pasta não existe ou está fora das pastas autorizadas. |
| `SESSION_001` | 404 | Não há nenhuma sessão gravada nesta pasta. |

## 5. Passos

Ordem obrigatória. Tiers: `opus` (desenho, não delegar) · `sonnet` (implementação) · `haiku` (mecânico).
**Regra 8 do `CLAUDE.md`**: nunca editar o backend a partir de um terminal servido por ele em `npm run dev`.

- [x] **1. Spike da quota pela status line** — ✅ 2026-09-28: `rate_limits` confirmado (formato em §4.3)
  - Ficheiro: `backend/scripts/statusline-spike.ts` (novo, manual, como o `pty-spike.ts`)
  - Skill: —
  - Tier: `sonnet`
  - Aceite quando: um `claude --settings <tmp>/claude-settings.json` real (via `claudeSpawner`, na pasta
    `DEFAULT_CWD`) grava o JSON da status line num ficheiro; está registado aqui em §4.3 se tem
    `rate_limits` e com que forma. **Se não tiver**: passos 8 e 16 saem, a quota volta a `notes/ideas.md`
    com o que se encontrou, e o ADR 0012 é atualizado (secção "Estado") — o resto segue.
- [x] **2. Códigos de erro + política de pastas** — ✅ 2026-09-28 (9 testes; espelho do frontend feito já aqui)
  - Ficheiro: `backend/src/common/errors.ts`, `backend/src/folders/cwdPolicy.ts` (`resolveAllowedPath`:
    `realpath`, dentro de uma raiz, existe e é pasta), `backend/test/cwdPolicy.test.ts`
  - Skill: `frontend-error-handling` (para o espelho, feito no passo 10)
  - Tier: `sonnet`
  - Aceite quando: os 8 códigos existem; testes cobrem raiz exata, subpasta, `..`, symlink/junction para
    fora, prefixo enganador (`C:\dev2` com raiz `C:\dev`), pasta inexistente, ficheiro em vez de pasta.
- [x] **3. Leitor das sessões gravadas (`.jsonl`)** — ✅ 2026-09-28 (10 testes; real: 10 sessões em 126 ms)
  - Ficheiro: `backend/src/sessions/claudeSessions.ts` (caminho do projeto a partir do `cwd`, listar,
    `latest`, `readSummary`), `backend/test/claudeSessions.test.ts` (com `.jsonl` de fixture)
  - Skill: —
  - Tier: `sonnet`
  - Aceite quando: com um `.jsonl` real confirma-se a codificação do caminho (§4.1); lista com `preview`
    e `messageCount`; `readSummary` devolve `ai-title` / última mensagem cortada a 600 / `null` e **nunca
    lança** (linhas inválidas, ficheiro vazio, ficheiro em falta).
- [x] **4. Argumentos do `claude`** — ✅ 2026-09-28 (4 testes)
  - Ficheiro: `backend/src/terminals/claudeArgs.ts` (`newSession(uuid)`, `resume(uuid)`, `+ --settings`
    quando a quota existe), `backend/test/claudeArgs.test.ts`
  - Skill: —
  - Tier: `sonnet`
  - Aceite quando: só produz `--session-id <uuid>`, `--resume <uuid>` e `--settings <DATA_DIR>/claude-settings.json`;
    um UUID inválido lança; nenhum texto do cliente entra nos argumentos (teste com `; rm`, espaços, aspas).
- [x] **5. `TerminalsService` — o ciclo de vida** — ✅ 2026-09-28 (14 testes; `TerminalManager` aceita o `id` e só conta vivos)
  - Ficheiro: `backend/src/terminals/terminalsService.ts` (liga `StateStore` + `TerminalManager` +
    sessões + pastas), `backend/test/terminalsService.test.ts` (spawn falso, `DATA_DIR` temporário);
    `app.ts`/`server.ts` passam a exigir `stateStore`
  - Skill: —
  - Tier: `opus`
  - Aceite quando: criar (new/resume/continue) grava em `terminals` e atualiza a pasta; listar dá
    running/exited/stopped pela tabela de §4.1; reabrir só de exited/stopped (`TERMINAL_006` se a correr) e
    revalida a pasta; limite conta só vivos; sessão já aberta → `TERMINAL_003`; `.jsonl` em falta →
    `TERMINAL_004`; fechar mata, grava em `closedTerminals` com `summary` e nunca falha por causa do resumo.
- [x] **6. Rotas REST dos terminais** — ✅ 2026-09-28 (7 testes; curl a uma instância de teste com o `claude` real; `api.md` já atualizado)
  - Ficheiro: `backend/src/terminals/terminal.schemas.ts`, `backend/src/terminals/terminals.routes.ts`,
    `backend/test/terminals.routes.test.ts`
  - Skill: —
  - Tier: `sonnet`
  - Aceite quando: as 5 rotas de §4.2 com zod no corpo; testes com `app.inject` para cada erro da tabela;
    `curl` real ao backend cria um terminal numa pasta de teste e fecha-o.
- [x] **7. Gateway WebSocket** — ✅ 2026-09-28 (7 testes; `claude` real na instância de teste: ready, TUI, resize, 4404 ao fechar, `Origin` alheio 403)
  - Ficheiro: `backend/src/terminals/terminals.gateway.ts`, `backend/test/terminals.gateway.test.ts`
  - Skill: —
  - Tier: `opus` (segurança: sessão + `Origin` + só bytes para o PTY)
  - Aceite quando: `ready` primeiro, depois o scrollback binário, depois tempo real; binário → PTY; texto
    só `resize` validado (o resto ignorado); `exit` ao terminar; fecha ao fim da sessão de login e ao
    fechar o terminal; sem cookie → 401, `Origin` alheio → 403 (a guarda já faz — testar); o conteúdo
    **nunca** vai para logs.
- [x] **8. Quota no backend** — ✅ 2026-09-28 (7 testes; o `claude` real arranca com `--settings` do `DATA_DIR`)
  - Ficheiro: `backend/src/usage/usageFiles.ts` (escreve `claude-settings.json` + `statusline.cjs` no
    arranque), `backend/src/usage/usage.routes.ts`, `backend/test/usage.test.ts`
  - Skill: —
  - Tier: `sonnet`
  - Aceite quando: `GET /api/usage` devolve `UsageView` a partir de `usage.json`; sem ficheiro → `null`s;
    ficheiro inválido → `null`s, nunca 500; o `statusline.cjs` testado com um JSON de exemplo no stdin —
    **com** `rate_limits` grava (com `fetchedAt`), **sem** `rate_limits` não toca no ficheiro; `resets_at`
    (segundos Unix) → ISO.
- [x] **9. Rotas de sessões e pastas + docs do backend** — ✅ 2026-09-28 (8 testes; instância de teste real)
  - Ficheiro: `backend/src/sessions/sessions.routes.ts`, `backend/src/folders/folders.routes.ts`,
    testes; `docs/api.md`, `docs/security.md`, `docs/architecture.md`, `docs/code-map.md`
  - Skill: —
  - Tier: `sonnet`
  - Aceite quando: §4.2 implementado e documentado (as secções 🚧 de Terminais/Sessões/Quota passam a ✅);
    `browse` nunca sobe acima de uma raiz e esconde `.*`; `SavedSession.closed` e `openIn` preenchidos.
- [x] **10. Frontend: tipos, serviços, erros** — ✅ 2026-09-28
  - Ficheiro: `frontend/src/types/{terminal,session,folder,usage}.ts`,
    `frontend/src/services/{terminalService,sessionService,folderService,usageService}.ts`,
    `frontend/src/errors/errorMessages.ts`
  - Skill: `frontend-design-system`, `frontend-error-handling`
  - Tier: `sonnet`
  - Aceite quando: os 8 códigos espelhados com as mensagens de §4.5; `tsc -b` e lint limpos.
- [x] **11. `TerminalView`** — ✅ 2026-09-28 (browser, `claude` real)
  - Ficheiro: `frontend/src/components/terminals/TerminalView.tsx`, `frontend/src/hooks/useTerminalShortcuts.ts`
  - Skill: `frontend-design-system`
  - Tier: `opus`
  - Aceite quando: no browser, escrever num terminal real chega ao `claude` e o output aparece; resize da
    janela chega ao PTY (`/status` ou a TUI redesenha); recarregar a página repõe o ecrã (reset + scrollback
    + resize ±1) sem duplicar; `Alt+1…9/N/\/W/R` não chegam ao PTY; desmontar faz `dispose()` e `close()`.
- [x] **12. Página em foco + lateral** — ✅ 2026-09-28, **lateral por projetos** (§3)
  - Ficheiro: `frontend/src/pages/TerminalsPage.tsx`, `hooks/useTerminals.ts`,
    `components/terminals/{TerminalSidebar,TerminalPane}.tsx`
  - Skill: `frontend-design-system`, `frontend-error-handling`
  - Tier: `sonnet`
  - Aceite quando: protótipo 1g; estado vazio; banners terminado (código) / parado com Reabrir; **Reabrir
    todos** reabre os parados até ao limite e mostra o erro do que falhar; toast quando um terminal não
    visível termina; erros `TERMINAL_*` mostrados.
- [x] **13. Drawer Novo terminal** — ✅ 2026-09-28
  - Ficheiro: `components/terminals/new/{NewTerminalDrawer,FolderPicker,SessionPicker}.tsx`,
    `newTerminalFormSchema.ts`
  - Skill: `frontend-design-system`, `frontend-error-handling`
  - Tier: `sonnet`
  - Aceite quando: protótipo 1j com a lista Favoritas · Recentes por cima; estrela marca/desmarca e
    persiste; navegador um nível de cada vez, sem subir acima da raiz; "Continuar a última" desativado sem
    sessões; sessões abertas noutro terminal desativadas; fechados mostram rótulo + resumo; rótulo com a
    pasta por omissão; `Alt+N` abre.
- [x] **14. Fechar, renomear, atalhos** — ✅ 2026-09-28 (32/32 no browser)
  - Ficheiro: `components/terminals/TerminalPane.tsx`, `hooks/useTerminalShortcuts.ts`
  - Skill: `frontend-design-system`
  - Tier: `sonnet`
  - Aceite quando: `Alt+W`/Fechar → confirmação 1k (via `useConfirm`) → o terminal sai e aparece na lista
    Retomar da pasta com o resumo; `Alt+R` renomeia no cabeçalho (Enter grava, Esc cancela, vazio = nome
    da pasta); `Alt+1…9` salta.
- [x] **15. Foco dividido, grelha, Definições** — ✅ 2026-09-28 (browser 21/21 com o 16)
  - Ficheiro: `hooks/useLayoutMode.ts`, `components/terminals/TerminalGrid.tsx`, `TerminalsPage.tsx`,
    `components/settings/SettingsDrawer.tsx`, `layouts/AppLayout.tsx` (item no menu de utilizador)
  - Skill: `frontend-design-system`
  - Tier: `sonnet`
  - Aceite quando: `Alt+\` divide (terminal em foco + o anterior) e junta; grelha 3 colunas, scroll depois
    de 6, clique amplia com "Voltar à grelha"/`Esc` sem mudar a preferência; Definições muda o modo e
    sobrevive a recarregar; terminais escondidos continuam ligados (sem replay ao voltar).
- [x] **16. Indicador de quota** — ✅ 2026-09-28
  - Ficheiro: `components/terminals/QuotaMeter.tsx`, `hooks/useUsage.ts`, `TerminalSidebar.tsx`, `layouts/AppLayout.tsx` (grelha)
  - Skill: `frontend-design-system`
  - Tier: `sonnet`
  - Aceite quando: lateral em foco, cabeçalho em grelha; ≥ 80 % a `warning` com "▲ Perto do limite"; valor
    velho a cinzento com "há X min"; "—" depois da hora de reposição.
- [x] **17. Verificação ponta a ponta + fecho** — ✅ 2026-09-28 (reinício → parados → Reabrir todos, 10/10)
  - Ficheiro: `docs/frontend-conventions.md`, `docs/skills/references/design/*.md`, esta spec
  - Skill: `run`
  - Tier: `sonnet`
  - Aceite quando: no browser com o `claude` real — abrir 2 terminais, escrever, dividir, grelha, fechar
    um (resumo na lista Retomar), reiniciar o backend → parados → Reabrir todos volta às conversas;
    padrões visuais novos registados em `design/`; `notes/ToDo.md`, `whatIveDone` e o plano atualizados.

## 6. Estado atual

> ⚠️ **Atualizar SEMPRE no fim de cada sessão.** É a secção que torna esta spec retomável.

**Feito:** **tudo** (passos 1-17, 2026-09-28). Backend: 161 testes Vitest. Frontend verificado em Chrome headless
contra uma instância de teste com o `claude` real, sem nenhum prompt ao modelo: terminais e projetos 32/32,
layouts e quota 21/21, reinício → parados → Reabrir todos 10/10 (o terminal com conversa volta com `--resume`, o
sem conversa com `--session-id` do mesmo UUID). "Fechar um → aparece na lista Retomar com o resumo" está provado
nos testes do backend e no leitor real dos `.jsonl` (passo 3); no browser, as sessões de teste não tinham
conversa e por isso não ficaram gravadas.
**Em curso:** —
**Próxima ação concreta:** nenhuma nesta spec. O que ficou em aberto está na secção 7 e no `notes/ToDo.md`.
**Desvios ao plano:**
- **2026-09-28, a meio do passo 12**: a lateral passa a ser **por projetos** (pasta) com **+** por projeto, e
  reabrir sem `.jsonl` passa a abrir sessão nova no mesmo terminal (§3). Também: a denylist do ambiente do filho
  passa a tirar todas as `CLAUDE_*` exceto `CLAUDE_CONFIG_DIR` (vazavam `CLAUDE_EFFORT` e `CLAUDE_JOB_DIR` de uma
  sessão-mãe do Claude Code).
- O espelho dos códigos no frontend foi feito no passo 2 (a regra de `errors.ts` pede o mesmo commit).
- `api.md` foi atualizado passo a passo (o `backend/CLAUDE.md` pede endpoint novo → `api.md` no mesmo commit),
  não só no passo 9.
- O `TerminalManager` passou a aceitar o `id` e a contar só os vivos (passo 5), e a avisar com `onClose` quando
  um terminal é esquecido (passo 7) — o gateway fecha o socket com `4404`.
- O `buildApp` aceita `logStream` (os testes provam que o conteúdo do terminal não vai para os logs) e limita
  cada frame do WebSocket a 1 MiB.
**O que uma sessão nova precisa de saber:**
- **O frontend liga-se assim**: REST em `/api/terminals` (`TerminalView` com `status` running/exited/stopped) e
  `WS /api/terminals/:id/ws`; fecho `4404` = o terminal já não está em memória (ex.: foi reaberto → ligar de novo),
  `4401` = a sessão de login acabou. A primeira mensagem é sempre `ready` → `term.reset()`; depois vem o
  scrollback em binário.
- **Testar com o `claude` real sem tocar no backend do dono**: arrancar uma segunda instância com
  `PORT=7498 APP_USERNAME=… APP_PASSWORD_HASH=<hash de teste> DATA_DIR=<tmp> ALLOWED_ROOTS=<tmp> FRONTEND_DIST=<inexistente>
  npx tsx src/server.ts` (o `loadEnvFile` não sobrepõe variáveis já definidas). Numa pasta nova, o `claude` para no
  diálogo de *trust* e só grava o `.jsonl` depois de aceite.
- O dono corre a app com `npm run dev` e às vezes trabalha
**dentro** de um terminal servido por ela — nunca editar o backend a partir desse terminal (regra 8). O
login é `bino03` + password (ADR 0011). Verificação no browser: se a extensão do Chrome não responder,
usar Chrome headless via CDP (ver `notes/learning.md`); nunca a password real num script.

## 7. Perguntas em aberto

| Pergunta | Bloqueia | Notas |
|---|---|---|
| O `claude` diz "fullscreen renderer has repeatedly failed to start on this machine, so it has been turned off here" — no modo inline, redimensionar (ex. dividir) deixa restos de desenho | Nada nesta spec (item no ToDo) | **Por investigar.** Pode ter sido provocado pelas corridas com o bug do `CLAUDE_CONFIG_DIR`; `/tui fullscreen` reativa. Ver se o renderer fullscreen arranca dentro do PTY da app |

## Relacionado

[[skill-plan-feature]] · [[skill-implement-todo]] · [[../adr/README]] · [[../database]] · [[../api]] ·
[[../adr/0004-exposicao-e-modelo-de-ameaca]] · [[../adr/0012-argumentos-do-claude-e-status-line]]
