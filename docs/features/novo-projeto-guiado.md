# Feature: Novo projeto guiado (o `/create` do Workflow sem terminal)

| | |
|---|---|
| **Estado** | 🚧 Em curso — a dependência ([[importar-para-a-biblioteca]], passos 1 e 4) está feita |
| **Criada** | 2026-10-23 |
| **Última sessão** | 2026-10-26 |
| **Passos** | 6 / 10 concluídos |

> Escrita para uma sessão que **não viu a conversa que a originou**. Se algo só faz sentido com contexto
> externo, falta escrevê-lo.

Nasceu do pedido (2026-10-23): "no Workflow há uma skill `/create` que serve para criar aplicações. Na
Workflow App queria ter o mesmo, mas como uma espécie de formulário: clicava em criar uma nova aplicação,
escrevia a prompt inicial, e depois tudo o que viesse em forma de escolha múltipla vinha com uma UI diferente.
Não queria ter um terminal nisto, queria uma coisa mais polida." Concretiza a ideia "Lançar o `/create` por
formulário" de [[../../notes/ideas|ideas.md]] e a linha "responder à entrevista do `/create` num formulário em
vez de pergunta a pergunta" do `docs/vision.md` do Workflow.

Há **dois repositórios** envolvidos:
- **App** — este.
- **Workflow** — `WORKFLOW_PATH` (`C:\Users\jlalv\Desktop\Workflow\Workflow` nesta máquina), com o seu git,
  `CLAUDE.md`, ADRs e skills. O `/create` vive lá: `docs/skills/skill-create.md` (+ ponteiro
  `.claude/skills/create/SKILL.md`), com o renderizador `tools/render-blueprint.mjs` (ADR 0008 do Workflow).
  Ler o `CLAUDE.md` do Workflow antes de lhe mexer.

**Dependência**: esta spec usa o que a [[importar-para-a-biblioteca]] constrói nos passos 1 (spike do
prompt inicial e dos hooks) e 4 (terminais `hidden`, `ClaudeLaunch` com prompt inicial e `--add-dir`, um
`--settings` próprio com hooks). **Não começar o passo 1 desta spec antes desses dois estarem feitos.**

---

## 1. O que é e porquê

Criar um projeto hoje é abrir um terminal no Workflow, escrever `/create` e responder a uma entrevista de
20-40 minutos no TUI do Claude Code: perguntas abertas em texto, escolhas com `AskUserQuestion` (setas e
Enter), uma proposta longa em Markdown cru, e uma geração de 10-20 minutos a passar no ecrã, com pedidos de
permissão pelo meio. Funciona, mas é a parte do Workflow que mais pede uma interface.

O dono quer o **mesmo `/create`** — a entrevista, a proposta e a geração continuam a ser as da skill do
Workflow — com uma interface polida na app: escreve a ideia, e cada pergunta aparece como cartões de escolha,
cada pergunta aberta como uma mensagem com caixa de resposta, cada permissão como um cartão
Permitir/Recusar, e o progresso da geração como uma lista legível. Sem terminal à vista.

**Como sei que está bem feito:** carrego em **Novo projeto**, escrevo "uma app para gerir as reservas do meu
ginásio, só para mim e para os dois funcionários" e carrego **Começar**. Em segundos aparece a primeira
mensagem do `/create` com as perguntas do bloco A que a minha descrição não respondeu; respondo na caixa de
texto. A seguir, "Que forma tem a app?" aparece como cartões — clico em "Back-office web interno". A
proposta aparece formatada (árvore, stacks com maturidade, skills incluídas/excluídas) com os botões
**Gerar · Mudar alguma coisa · Cancelar**. Carrego Gerar; um cartão pede "Permitir: `git init` em
`C:\…\projetos\Ginasio`" e eu permito. A geração mostra "A escrever docs/…", "Verificação: 0 falhas". No
fim: "Projeto criado em `C:\…\projetos\Ginasio`" e um botão **Abrir projeto** que me leva aos Terminais,
com o projeto numa tab e um terminal aberto lá. Nunca vi um terminal — mas se quiser, **Ver terminal**
mostra a sessão real.

## 2. Âmbito

### Dentro
- **Ecrã "Novo projeto"** (`/new-project`) com entrada própria na navegação, e um botão **+ Novo projeto**
  nas tabs de projetos dos Terminais que leva lá.
- **Prompt inicial** em texto livre → a app arranca o `/create` do Workflow numa sessão **escondida** (o
  terminal `hidden` da spec de importação), com essa descrição como resposta de partida ao bloco A.
- **Sessão guiada** — a camada genérica que torna uma sessão escondida utilizável sem terminal:
  - **Escolhas** (`AskUserQuestion`) → cartões (escolha única ou múltipla, com descrição de cada opção,
    "(Recomendado)" destacado, e "Outro" com campo de texto — o "Outro" é automático no Claude Code e a UI
    reproduz isso). Várias perguntas no mesmo `AskUserQuestion` aparecem juntas, um botão **Responder**.
  - **Perguntas abertas e mensagens** do Claude → bolhas com Markdown renderizado; quando o Claude termina o
    turno à espera de texto, aparece a caixa de resposta.
  - **Pedidos de permissão** → cartão **Permitir / Recusar** com o que vai correr ou escrever (ferramenta,
    comando ou caminho).
  - **Atividade** (ferramentas que correm: ficheiros escritos, comandos) → linhas compactas, agrupadas
    ("Escreveu 14 ficheiros em `docs/`"), não o output cru.
  - **Ver terminal** sempre disponível (revela o terminal — escape para o que a UI não souber mostrar).
  - **Cancelar** (mata a sessão).
- **Fim**: o `/create` escreve um `result.json` (caminho do projeto, resumo, decisões em aberto); a app
  mostra o resumo e **Abrir projeto** (abre um terminal novo nessa pasta — o projeto já aparece nas tabs
  porque o `/create` o regista em `projects/INDEX.md` do Workflow, que a app lê).
- **Retomar**: a página mostra a criação em curso ao voltar a ela (a sessão continua a correr com o browser
  fechado). Depois de um reinício do backend, **Retomar** reabre a sessão (`--resume`) e a conversa volta a
  aparecer, lida do `.jsonl`.
- **Uma criação de cada vez.**
- **Do lado do Workflow**: o `/create` ganha um **"Modo app"** — lê a descrição de um ficheiro dado no
  arranque, só pergunta o que falta do bloco A, faz **todas as escolhas por `AskUserQuestion`** (incluindo o
  destino E1, com o caminho proposto como opção, e a confirmação da Fase 2), e termina a escrever o
  `result.json`. A allowlist do Workflow (`.claude/settings.json`, criada na spec de importação) ganha o
  que o `/create` corre sempre (`node tools/render-blueprint.mjs`, `node tools/verify-project.mjs`). ADR no
  Workflow.

### ⛔ Fora — não implementar nesta feature
- **Formulário fixo da entrevista A-E na app.** Rejeitado na entrevista: duplicava o `/create` e divergia.
  A UI mostra o que a skill pergunta, nunca o sabe de antemão.
- **Voltar atrás e mudar uma resposta já dada** (editar um cartão respondido). Corrige-se pela conversa
  ("Mudar alguma coisa" na proposta, ou uma mensagem de texto).
- **Usar a sessão guiada em terminais normais** (ver um terminal qualquer em modo "polido"), ou para
  `/adopt-project`, `/harvest-project`, `/upgrade-project`, `/design-database`. O motor serve-os — 2.ª fase.
- **Trocar o "precisa de ti → Ver terminal" da importação pelos cartões** — 2.ª fase (§2 "Segunda fase").
- **Várias criações em paralelo.**
- **Apagar a pasta de um projeto meio gerado** quando se cancela a meio da Fase 3. A app avisa e mostra o
  caminho; a pasta apaga-se à mão. A app não apaga pastas do utilizador.
- **Criar o repositório remoto** (GitHub) — o `/create` só faz o que já faz (E5).
- **Ver o output completo das ferramentas** na UI (diffs, stdout). Para isso há **Ver terminal**.
- **Avisos fora do ecrã** (Telegram, notificação do browser, badge) quando a criação está à espera.
- **Layout para telemóvel** (a app é só desktop, [[../adr/0008-identidade-visual|ADR 0008]]).

> Esta lista impede uma sessão futura de expandir o âmbito sozinha.

### Segunda fase (se houver)
- A importação ([[importar-para-a-biblioteca]]) passa a mostrar as perguntas do `/import` como cartões em vez de
  revelar o terminal.
- `/adopt-project` e `/harvest-project` guiados, com o mesmo motor.
- Aviso no Telegram (o bot já existe, ADR 0017) quando a sessão guiada fica à espera.
- "Modo polido" para qualquer terminal (alternar entre xterm e a vista guiada).

## 3. Decisões tomadas

| Decisão | Escolha | Porquê | Alternativa rejeitada |
|---|---|---|---|
| Como a UI se liga ao `/create` | **Conversa polida** sobre o `/create` real: a app mostra o que a skill faz, pela ordem em que faz | Escolha do dono; a entrevista continua num só sítio (a skill do Workflow) e a UI acompanha quando ela mudar | Formulário fixo A-E na app + `/create` em modo "respostas dadas" — duplica a entrevista; as perguntas dependentes da stack (C6, D1) ficam difíceis |
| Escolhas | Hook `PreToolUse` com matcher `AskUserQuestion`: o hook guarda a pergunta, **espera** pela resposta da app e devolve-a ao Claude (`updatedInput` com `answers`) | A pergunta chega estruturada (perguntas, opções, descrições, multiSelect) — nada a adivinhar do ecrã | Ler o TUI do PTY à procura das opções — frágil a cada versão do CLI. **Plano B (se o spike falhar o `updatedInput`)**: `permissionDecision: "deny"` com a resposta no motivo ("O utilizador escolheu: …"), que o Claude lê como resposta |
| Permissões | Hook `PermissionRequest` (bloqueante, mesmo mecanismo) → cartão Permitir/Recusar; mais a allowlist do Workflow para os casos óbvios | Escolha do dono; o dono continua a decidir cada ação fora da allowlist, como no TUI | Só allowlist + revelar o terminal |
| Perguntas abertas | Hook `Stop` sem `result.json` = "à espera de texto"; a resposta é escrita no PTY como **bracketed paste** + Enter | É o que o teclado faria; o texto do dono vai para o stdin, nunca para a linha de comando | Pedir ao `/create` que faça tudo por `AskUserQuestion` — as perguntas abertas (A1-A8) não cabem em opções |
| De onde vem a conversa que a UI mostra | Do `.jsonl` da sessão (`~/.claude/projects/<cwd codificado>/<uuid>.jsonl`), reduzido pelo backend a entradas simples (texto do Claude, texto do dono, pergunta+resposta, permissão+decisão, atividade) | Já se lê o `.jsonl` para o resumo dos terminais (`sessions/claudeSessions.ts`); sobrevive a um reinício (Retomar mostra tudo) | Guardar a conversa à parte pela app — segunda cópia do mesmo facto |
| Prompt inicial | A descrição do dono é gravada pelo backend em `DATA_DIR/guided/<id>/brief.md`; o prompt inicial é `/create --app <caminho do brief>` (caminho gerado e validado pelo backend) | Mantém o ADR 0012: nada do cliente na linha de comando; reutiliza o prompt inicial da spec de importação | Escrever a descrição no PTY como primeira mensagem — o texto do dono passava a depender de o TUI estar pronto |
| Destino e confirmação | Em modo app, o `/create` pergunta E1 por `AskUserQuestion` com o caminho proposto como opção (o "Outro" deixa escrever outro) e a confirmação da Fase 2 como Gerar · Mudar alguma coisa · Cancelar | Tudo o que é escolha fica em cartões, como o dono pediu | E1 em texto livre (como hoje) |
| Onde vive | Ecrã próprio `/new-project` + **+ Novo projeto** nas tabs dos Terminais | Escolha do dono; a proposta e o progresso precisam de espaço | Drawer grande sobre os Terminais |
| Ordem entre specs | Depois dos passos 1 e 4 da [[importar-para-a-biblioteca]] | Escolha do dono; a base (terminais escondidos, prompt inicial, `--settings` com hooks) é a mesma — constrói-se uma vez | Esta primeiro |
| Markdown no frontend | Dependência nova `react-markdown` (sem HTML cru: `skipHtml`, sem `rehype-raw`) | As mensagens do `/create` (a proposta, as tabelas) são Markdown; renderizar à mão é um parser | Mostrar texto cru numa `<pre>` — não é "polido" |
| Hooks bloqueantes | O `guided-hook.cjs` espera pela resposta com polling de um ficheiro (`answer.json`), com o `timeout` do hook alto (a medir no spike: o objetivo é ≥ 1 h) | Uma pergunta pode ficar horas à espera; o Claude Code mata hooks que passam o `timeout` | Responder logo "ask" e deixar o TUI perguntar — volta a precisar do terminal |
| Se o hook expirar | A sessão fica "precisa de ti" e **Ver terminal** revela-a (o TUI mostra a pergunta normal) | Nada se perde; o mesmo escape da importação | Recomeçar a criação |

**ADRs gerados** (escritos nos passos 2 e 3, não agora):
- **App — ADR 0020** "Sessões guiadas: o Claude Code interativo com uma UI própria por hooks": hooks
  bloqueantes (`PreToolUse` de `AskUserQuestion`, `PermissionRequest`) a ligar o Claude Code à app por
  ficheiros em `DATA_DIR/guided/`, texto do dono escrito no PTY por uma rota REST (não só pelo WebSocket),
  a conversa lida do `.jsonl`, `react-markdown` (complementa o 0002, 0012 e o 0019 da importação).
- **Workflow — ADR 0011** "O `/create` em modo app": brief por ficheiro, escolhas sempre por
  `AskUserQuestion`, `result.json` no fim — e o que **não** muda (fases, regras de ouro, renderizador).

## 4. Desenho técnico

### 4.1 Dados

Sem base de dados ([[../adr/0009-estado-em-ficheiro-json|ADR 0009]]).

**`state.json`**: nada de novo além do que a spec de importação já acrescenta (`hidden`). O terminal da
criação é um terminal `hidden` normal; a ligação faz-se pela pasta da sessão guiada.

**Uma sessão guiada vive numa pasta**, `DATA_DIR/guided/<guidedId>/`:

| Ficheiro | Quem escreve | O quê |
|---|---|---|
| `meta.json` | backend | `{ id, purpose: "create", terminalId, claudeSessionId, createdAt }` |
| `brief.md` | backend, ao criar | A descrição do dono, tal como escrita (até 8000 chars) |
| `pending.json` | `guided-hook.cjs` | O que está à espera: `{ requestId, type: "question", questions }` ou `{ requestId, type: "permission", tool, input }` — apagado quando respondido |
| `answer.json` | backend | A resposta do dono a `requestId` — o hook lê-o, devolve-o ao Claude e apaga-o |
| `event.json` | `guided-hook.cjs` | Último evento (`Stop` · `UserPromptSubmit` · `Notification`) com `at` |
| `result.json` | o `/create` (modo app), no fim | Contrato abaixo |

Sessões terminadas (`done`, cancelada) ficam com a pasta até o dono carregar **Fechar** no fim — então a
pasta apaga-se e o terminal vai para o histórico.

**Estado derivado** (nunca guardado), por esta ordem:
1. `result.json` válido → `done` (ou `failed` se `status: failed`).
2. Terminal não `running` → `stopped` (Retomar disponível).
3. `pending.json` existe → `question` ou `permission`.
4. Último evento `Stop` → `waiting-text`; `Notification` sem `pending.json` → `needs-you` (algo que a UI não
   apanhou — Ver terminal).
5. Senão → `working`.

**Contrato do modo app do `/create`** — fonte de verdade na secção "Modo app" de
`WORKFLOW_PATH/docs/skills/skill-create.md` (passo 3). Forma inicial:

```jsonc
// Prompt inicial: /create --app <abs: DATA_DIR/guided/<id>/brief.md>
// result.json — escrito ao lado do brief.md, como último passo da Fase 5
{
  "version": 1,
  "status": "done" | "failed",
  "projectPath": "C:\\…\\projetos\\Ginasio",   // absoluto
  "projectName": "Ginasio",
  "summary": "<markdown curto: o que foi gerado, contagens>",
  "openDecisions": ["…"],                       // decisões em aberto, do Fase 5 → entregar
  "nextStep": "/implement-todo → Fundação",
  "error": "<só com failed>"
}
```

O `/create` em modo app também escreve o `result.json` com `failed` se o dono cancelar na proposta
("Cancelar" da Fase 2).

### 4.2 Endpoints

Todas com sessão obrigatória (`AUTH_002`).

**Criação** (`backend/src/creation/`):

| Método | Rota | Corpo | Resposta | Erros |
|---|---|---|---|---|
| POST | `/api/creations` | `{ description: string }` (1–8000) | `201 GuidedView` | `COMMON_001` · `CREATE_001` · `TERMINAL_002`/`005`/`007` |
| GET | `/api/creations/current` | — | `200 GuidedView \| null` | — |
| POST | `/api/creations/:id/open` | — | `201 TerminalView` (terminal novo em `projectPath`) | `GUIDED_001` · `GUIDED_003` · `CREATE_002` · erros do `cwdPolicy` |

**Sessão guiada** (`backend/src/guided/`, genérico — `purpose` diz para quê):

| Método | Rota | Corpo | Resposta | Erros |
|---|---|---|---|---|
| GET | `/api/guided/:id` | — | `200 GuidedView` | `GUIDED_001` |
| GET | `/api/guided/:id/feed?after=<cursor>` | — | `200 { entries: FeedEntry[], cursor }` | `GUIDED_001` |
| POST | `/api/guided/:id/answer` | `{ requestId, answers: Record<string, string> }` (chave = texto da pergunta, valor = label escolhido, labels separados por `, ` em multiSelect, ou o texto do "Outro") | `204` | `GUIDED_001` · `GUIDED_002` |
| POST | `/api/guided/:id/permission` | `{ requestId, decision: "allow" \| "deny" }` | `204` | `GUIDED_001` · `GUIDED_002` |
| POST | `/api/guided/:id/message` | `{ text }` (1–8000) | `204` | `GUIDED_001` · `GUIDED_003` · `GUIDED_004` |
| POST | `/api/guided/:id/resume` | `{ cols, rows }` | `200 GuidedView` | `GUIDED_001` · `TERMINAL_*` (é o `reopen` dos terminais) |
| POST | `/api/guided/:id/reveal` | — | `200 TerminalView` | `GUIDED_001` |
| DELETE | `/api/guided/:id` | — | `204` — cancela (mata o terminal, apaga a pasta, terminal para o histórico) ou fecha uma terminada | `GUIDED_001` |

`requestId` errado ou já respondido → `GUIDED_002` (a UI recarrega o estado). `message` só com o estado
`waiting-text` ou `needs-you` → senão `GUIDED_004` (escrever no meio de um turno baralha o TUI).

**O que o backend lança** (via `terminals/claudeArgs.ts`, o `kind: 'import'` da spec de importação
generalizado para `{ kind: 'prompted'; sessionId; prompt; addDirs; settings }`):

```
claude --session-id <uuid> --settings <DATA_DIR/claude-guided-settings.json>
       --add-dir <DATA_DIR/guided/<id>>
       "/create --app <DATA_DIR/guided/<id>/brief.md>"
```

`cwd` = `WORKFLOW_PATH` (em `ALLOWED_ROOTS`, pasta de confiança — senão `TERMINAL_007`). O prompt é
construído pelo backend e validado (regex + igual a `join(DATA_DIR, 'guided', <uuid>, 'brief.md')`).

**`claude-guided-settings.json`** (escrito no arranque, como o das importações): `statusLine` + hooks:

| Evento | Matcher | O que o `guided-hook.cjs` faz |
|---|---|---|
| `PreToolUse` | `AskUserQuestion` | Grava `pending.json` (`type: question`, `tool_input.questions`); espera por `answer.json` com o mesmo `requestId`; devolve `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","updatedInput":{"questions":…,"answers":…}}}` |
| `PermissionRequest` | — | Grava `pending.json` (`type: permission`, `tool_name`, `tool_input` reduzido); espera; devolve a decisão no formato que o spike confirmar |
| `Stop`, `UserPromptSubmit`, `Notification` | — | Grava `event.json` e sai logo, sem imprimir |

O hook encontra a pasta pela `session_id` do stdin (validada como UUID) através de um índice
`DATA_DIR/guided/by-session/<session_id>` escrito pelo backend; uma sessão que não é guiada → sai 0 sem fazer
nada. Nunca lança nem imprime nada além do JSON de decisão.

**A conversa** (`backend/src/guided/transcriptFeed.ts`) — lê o `.jsonl` da sessão e devolve:

```ts
type FeedEntry =
  | { id: string; type: 'assistant-text'; markdown: string; at: string }
  | { id: string; type: 'user-text'; text: string; at: string }           // o brief aparece como a 1.ª
  | { id: string; type: 'question'; questions: Question[]; answers: Record<string, string> | null; at: string }
  | { id: string; type: 'permission'; summary: string; decision: 'allow' | 'deny' | null; at: string }
  | { id: string; type: 'activity'; summary: string; count: number; at: string }; // ferramentas seguidas agrupadas
```

As mensagens de sistema, o conteúdo das skills lidas, os `tool_result` e o pensamento **não** aparecem.
Uma linha do `.jsonl` que não se percebe é ignorada (nunca derruba o pedido) — o formato não é público e o
spike regista um exemplo real em `backend/test/fixtures/guided-transcript.jsonl`.

### 4.3 Tipos / DTOs

```ts
// backend/src/guided/guided.schemas.ts — espelhados em frontend/src/types/guided.ts
export type GuidedStatus =
  | 'working' | 'question' | 'permission' | 'waiting-text' | 'needs-you' | 'stopped' | 'done' | 'failed';

export type Question = {
  question: string;
  header: string;
  multiSelect: boolean;
  options: { label: string; description: string }[];
};

export type GuidedView = {
  id: string;
  purpose: 'create';
  status: GuidedStatus;
  terminalId: string;
  createdAt: string;
  pending:
    | { requestId: string; type: 'question'; questions: Question[] }
    | { requestId: string; type: 'permission'; tool: string; summary: string }
    | null;
  result: CreateResult | null;
};

export type CreateResult = {
  status: 'done' | 'failed';
  projectPath: string | null;
  projectName: string | null;
  summary: string;
  openDecisions: string[];
  nextStep: string | null;
  error?: string;
};
```

### 4.4 Interface

- **Onde vive**: `/new-project` (`frontend/src/pages/NewProjectPage.tsx`), entrada **Novo projeto** na
  navegação do `AppLayout`, e botão **+ Novo projeto** no fim das tabs de projetos dos Terminais
  (`ProjectTabs.tsx`) que navega para lá.
- **Estados do ecrã**:
  1. **Sem criação** — título, uma caixa de texto grande ("Descreve a app: o que faz, para quem, o que tem de
     ter…", com as perguntas A1-A8 do `/create` como dica discreta por baixo) e **Começar**.
  2. **Em curso** — coluna central com a conversa (`GuidedFeed`), de cima para baixo; no fundo, conforme o
     estado:
     | Estado | No fundo do ecrã |
     |---|---|
     | `working` | Indicador "O Claude está a trabalhar…" + a última atividade |
     | `question` | `QuestionCard` (uma ou várias perguntas: cartões de opção clicáveis; multiSelect com caixas; "Outro" com campo de texto) + **Responder** |
     | `permission` | `PermissionCard`: ferramenta + resumo (comando ou caminho, monoespaçado) + **Permitir** (primário) / **Recusar** |
     | `waiting-text` | `ReplyBox` (textarea, `Ctrl+Enter` envia) |
     | `needs-you` | Aviso "A sessão precisa de algo que esta vista não mostra" + **Ver terminal** |
     | `stopped` | "A sessão parou (o backend reiniciou?)" + **Retomar** |
     Sempre visíveis no cabeçalho: **Ver terminal** e **Cancelar** (com confirmação; durante a geração
     avisa que a pasta pode ficar meio escrita, com o caminho).
  3. **Terminada** — o `summary` (Markdown), as decisões em aberto, o próximo passo, **Abrir projeto**
     (primário) e **Fechar**. Com `failed`: o erro + **Ver terminal** + **Fechar**.
- **Atualização**: polling de `GET /api/guided/:id` e do `feed?after=` a cada 1,5 s enquanto não está
  terminada; para quando o separador está escondido (`document.visibilityState`).
- **Componentes** (`frontend/src/components/guided/`): `GuidedFeed`, `AssistantMessage` (react-markdown com
  estilos por tokens; tabelas e blocos de código legíveis), `UserMessage`, `QuestionCard`, `AnsweredQuestion`
  (versão compacta de uma pergunta já respondida, no histórico), `PermissionCard`, `ActivityLine`, `ReplyBox`.
  Genéricos — não sabem que é o `/create`; o `NewProjectPage` é que sabe.
- **Estado vazio**: estado 1 acima. Sem `WORKFLOW_PATH`/biblioteca → o ecrã explica que é preciso o
  Workflow configurado (`LIBRARY_001`).
- **Visibilidade por role**: não há roles ([[../adr/0003-auth-utilizador-unico]]).
- **Visual**: só tokens ([[../skills/references/design/tokens-and-colors|tokens-and-colors]]). Os cartões de
  opção, as bolhas de conversa e o cartão de permissão são padrões novos → registados em
  `docs/skills/references/design/` no passo 9. Antes do passo 7, ver se vale um protótipo no Claude Design
  (os da pasta `docs/design/handoff-2026-09-27/` são referência, não código).

**Ficheiros**:
- **Backend (novo)**: `backend/src/guided/{guided.schemas,guidedService,guided.routes,guidedFiles,transcriptFeed}.ts`,
  `backend/src/creation/{creation.schemas,creationService,creation.routes}.ts`,
  `backend/test/{guidedService,guidedHook,transcriptFeed,guided.routes,creation.routes}.test.ts`,
  `backend/test/fixtures/guided-transcript.jsonl`, `backend/scripts/guided-spike.ts`.
- **Backend (modificado)**: `backend/src/terminals/claudeArgs.ts` (generalizar o lançamento com prompt),
  `backend/src/terminals/{terminalManager,terminalsService}.ts` (escrever texto num terminal escondido com
  bracketed paste), `backend/src/{app,config}.ts`, `backend/src/common/errors.ts`, `docs/api.md`.
- **Frontend (novo)**: `frontend/src/types/guided.ts`, `frontend/src/services/{guidedService,creationService}.ts`,
  `frontend/src/hooks/useGuidedSession.ts`, `frontend/src/components/guided/*.tsx`,
  `frontend/src/pages/NewProjectPage.tsx`.
- **Frontend (modificado)**: `frontend/src/main.tsx` (rota), `frontend/src/layouts/AppLayout.tsx` (entrada na
  navegação), `frontend/src/components/terminals/ProjectTabs.tsx` (botão), `frontend/src/errors/errorMessages.ts`,
  `frontend/package.json` (`react-markdown`).
- **Workflow (modificado)**: `docs/skills/skill-create.md` (secção "Modo app"), `.claude/settings.json`
  (allowlist), `docs/adr/0011-create-em-modo-app.md` (novo), `docs/adr/README.md`, `docs/vision.md` (a linha
  do formulário passa a apontar para o ADR).

### 4.5 Códigos de erro novos

| Código | HTTP | Mensagem no frontend |
|---|---|---|
| `GUIDED_001` | 404 | Esta sessão já não existe |
| `GUIDED_002` | 409 | Esta pergunta já foi respondida ou mudou — a vista foi atualizada |
| `GUIDED_003` | 409 | A sessão não está a correr — retoma-a primeiro |
| `GUIDED_004` | 409 | O Claude ainda está a trabalhar — espera que termine para escrever |
| `CREATE_001` | 409 | Já há um projeto a ser criado — acaba-o ou cancela-o primeiro |
| `CREATE_002` | 409 | O projeto ainda não foi criado, ou a pasta dele não existe |

## 5. Passos

Ordem obrigatória. Tiers: `opus` (desenho, não delegar) · `sonnet` (implementação) · `haiku` (mecânico).
**Regra 8 do `CLAUDE.md`**: nunca editar o backend a partir de um terminal servido por ele em `npm run dev`.
**Pré-requisito**: passos 1 e 4 da [[importar-para-a-biblioteca]] feitos. **O passo 3 mexe no repo do
Workflow** — commits lá, separados.

- [x] **1. Spike — a sessão guiada**
  - Ficheiro: `backend/scripts/guided-spike.ts`, `backend/test/fixtures/guided-transcript.jsonl`
  - Skill: —
  - Tier: `opus` (decide o mecanismo das escolhas e das permissões; os planos B mudam o passo 4)
  - Aceite quando: num PTY com o `claude` real e um `--settings` de teste, fica provado e escrito na §6:
    (a) um hook `PreToolUse` com matcher `AskUserQuestion` que devolve `updatedInput` com `answers` faz o
    Claude seguir com essa resposta **sem** mostrar o seletor no TUI (senão, testar o plano B `deny` com a
    resposta no motivo e escolher); (b) o hook `PermissionRequest` existe nesta versão do CLI, recebe a
    ferramenta e o input, e consegue permitir/recusar (registar o formato exato da saída); (c) um hook
    bloqueado 10 min continua válido com `timeout` alto — e qual é o máximo aceite; (d) texto escrito no PTY
    como bracketed paste (`\x1b[200~…\x1b[201~\r`), com várias linhas, chega como **uma** mensagem; (e) um
    `.jsonl` real com texto, `AskUserQuestion` respondida, permissão e ferramentas fica gravado como fixture
    (sem dados pessoais).

- [x] **2. ADR 0020 da app**
  - Ficheiro: `docs/adr/0020-sessoes-guiadas.md`, `docs/adr/README.md`
  - Skill: —
  - Tier: `opus`
  - Aceite quando: contexto (pedido de 2026-10-23, a ideia "Lançar o `/create` por formulário"), opções
    (conversa sobre a skill · formulário fixo · ler o TUI), decisão (§3: hooks bloqueantes por ficheiros,
    texto no PTY por REST com bracketed paste, conversa do `.jsonl`, `react-markdown` sem HTML cru) e
    consequências (dependência do formato do `.jsonl` e dos hooks do CLI; o que fica de fora), com o
    resultado do spike; linha no README.

- [x] **3. Workflow — `/create` em modo app + ADR 0011**
  - Ficheiro (repo do Workflow): `docs/skills/skill-create.md`, `docs/adr/0011-create-em-modo-app.md`,
    `docs/adr/README.md`, `.claude/settings.json`, `docs/vision.md`
  - Skill: — (é uma alteração a uma skill do Workflow; seguir o `CLAUDE.md` dele)
  - Tier: `opus`
  - Aceite quando: `skill-create.md` tem a secção "Modo app" (ativa com `--app <brief>`): o brief responde
    ao bloco A — só se pergunta, numa mensagem, o que ele não cobre; todas as escolhas (B, C, D, E1, E2-E5,
    Fase 2) por `AskUserQuestion`, E1 com o caminho proposto como opção; no fim, `result.json` ao lado do
    brief (contrato §4.1 desta spec, que passa a linkar para lá); o resto das fases igual; a allowlist
    ganha `Bash(node tools/render-blueprint.mjs:*)` e `Bash(node tools/verify-project.mjs:*)` (o resto da
    geração — escrever na pasta nova, `git init` — **fica** a pedir permissão, de propósito); ADR 0011 com
    contexto/opções/decisão/consequências; **teste a seco** no Workflow, à mão, com um brief de teste e
    destino numa pasta temporária até à Fase 2, e Cancelar → `result.json` `failed`; commit no Workflow.

- [x] **4. Backend — motor da sessão guiada**
  - Ficheiro: `backend/src/guided/{guided.schemas,guidedFiles,guidedService,guided.routes}.ts`,
    `backend/src/terminals/{claudeArgs,terminalManager,terminalsService}.ts`, `backend/src/common/errors.ts`,
    `backend/test/{guidedHook,guidedService,guided.routes}.test.ts`, `docs/api.md`
  - Skill: —
  - Tier: `opus` (hooks bloqueantes, texto do dono para um PTY, estado derivado)
  - Aceite quando: o `guided-hook.cjs` (testado com stdin falso) grava `pending.json`, espera, devolve a
    resposta no formato do spike e apaga o `answer.json`; ignora sessões que não são guiadas e
    `session_id` que não é UUID; nunca imprime nada fora do JSON de decisão. As rotas da §4.2 (guided)
    funcionam com o `claude` falso de `test/fakeClaude.ts`; `requestId` errado → `GUIDED_002`; `message`
    durante `working` → `GUIDED_004`; o texto chega ao PTY em bracketed paste; o estado derivado segue a
    §4.1; `DELETE` limpa a pasta e o índice `by-session`; `npm run typecheck`/`test`/`lint` limpos.

- [x] **5. Backend — conversa a partir do `.jsonl`**
  - Ficheiro: `backend/src/guided/transcriptFeed.ts`, `backend/test/transcriptFeed.test.ts`
  - Skill: —
  - Tier: `sonnet`
  - Aceite quando: com a fixture do spike, o feed tem as entradas certas e pela ordem (brief, texto,
    pergunta com resposta, permissão com decisão, atividade agrupada); `after=<cursor>` só devolve as novas;
    linhas inválidas e tipos desconhecidos são ignorados; o conteúdo das skills lidas e os `tool_result`
    não aparecem; `npm run typecheck`/`test`/`lint` limpos.

- [x] **6. Backend — criação**
  - Ficheiro: `backend/src/creation/{creation.schemas,creationService,creation.routes}.ts`,
    `backend/src/app.ts`, `backend/src/common/errors.ts`, `backend/test/creation.routes.test.ts`, `docs/api.md`
  - Skill: —
  - Tier: `sonnet`
  - Aceite quando: `POST /api/creations` grava o brief, lança a sessão escondida com o prompt da §4.2 (testado
    pelos argumentos passados ao `claude` falso) e devolve `201`; segunda criação → `CREATE_001`;
    `result.json` falso `done` → `GuidedView.result` preenchido; `open` cria um terminal visível em
    `projectPath` (fora de `ALLOWED_ROOTS` → erro do `cwdPolicy`; sem `result` → `CREATE_002`); descrição
    vazia ou > 8000 → `COMMON_001`; `npm run typecheck`/`test`/`lint` limpos.

- [ ] **7. Frontend — componentes da sessão guiada**
  - Ficheiro: `frontend/src/components/guided/*.tsx`, `frontend/src/types/guided.ts`,
    `frontend/src/services/guidedService.ts`, `frontend/src/hooks/useGuidedSession.ts`,
    `frontend/src/errors/errorMessages.ts`, `frontend/package.json` (`react-markdown`)
  - Skill: `frontend-design-system`, `frontend-error-handling`
  - Tier: `opus` (é o "polido" que o dono pediu — padrões visuais novos)
  - Aceite quando: numa página de desenvolvimento (`frontend/src/pages/dev/`, como a `_tokens`) com dados
    falsos: Markdown com tabela, lista e código renderizado só com tokens; `QuestionCard` com escolha única,
    múltipla, "(Recomendado)" e "Outro"; várias perguntas juntas; `PermissionCard`; `ReplyBox` com
    `Ctrl+Enter`; perguntas respondidas aparecem compactas; HTML no Markdown **não** é interpretado; nenhum
    hex novo; `npx tsc -b` e lint limpos.

- [ ] **8. Frontend — ecrã Novo projeto**
  - Ficheiro: `frontend/src/pages/NewProjectPage.tsx`, `frontend/src/services/creationService.ts`,
    `frontend/src/main.tsx`, `frontend/src/layouts/AppLayout.tsx`,
    `frontend/src/components/terminals/ProjectTabs.tsx`
  - Skill: `frontend-design-system`, `frontend-error-handling`
  - Tier: `sonnet`
  - Aceite quando: no browser, com o backend e o `claude` falso a simular cada estado: os três estados do
    ecrã (§4.4); voltar à página depois de navegar mostra a criação em curso; **Ver terminal** leva aos
    Terminais com ela em foco; **Retomar** depois de parar o processo; **Abrir projeto** leva aos Terminais
    com um terminal na pasta; **+ Novo projeto** nas tabs navega para lá; o polling para com o separador
    escondido; `npx tsc -b` e lint limpos.

- [ ] **9. Docs da app**
  - Ficheiro: `docs/product/use-cases.md`, `docs/architecture.md`, `docs/security.md` (hooks bloqueantes,
    texto para o PTY por REST), `docs/database.md` (`DATA_DIR/guided/`), `docs/code-map.md`,
    `docs/skills/references/project-vocabulary.md` ("sessão guiada"),
    `docs/skills/references/design/*` (cartões de opção, bolhas, cartão de permissão)
  - Skill: —
  - Tier: `sonnet`
  - Aceite quando: o fluxo está nos casos de uso, os padrões visuais novos estão registados, e nenhum doc
    contradiz o ADR 0020.

- [ ] **10. Verificação ponta a ponta com o `/create` real + fecho**
  - Ficheiro: `notes/verificacao-browser-pendente.md`, `notes/ToDo.md`, `notes/whatIveDone.md`, esta spec §6
  - Skill: `run`
  - Tier: `sonnet`
  - Aceite quando: com o dono, numa instância de `scripts/verify/` com o Workflow real e o `claude` real:
    criar um projeto de teste (nome óbvio, ex. `_teste-create`, numa pasta dentro de `ALLOWED_ROOTS`) de
    ponta a ponta só pela UI — prompt inicial, perguntas abertas, cartões, proposta, Gerar, permissões, fim,
    **Abrir projeto**; registar quanto tempo levou e quantas vezes foi preciso **Ver terminal** (o objetivo é
    zero). **Limpar a seguir**: apagar a pasta do projeto de teste e reverter a linha em
    `projects/INDEX.md` do Workflow (`git checkout`); `git status` do Workflow limpo.

## 6. Estado atual

> ⚠️ **Atualizar SEMPRE no fim de cada sessão.** É a secção que torna esta spec retomável.

**Feito:**
- Spec escrita (2026-10-23).
- **Passo 1 — spike (2026-10-26, `claude` 2.1.310)**, `backend/scripts/guided-spike.ts`, numa pasta temporária com
  uma skill de teste que faz 2 perguntas, escreve um ficheiro e tenta um Bash. **Tudo confirmado sem plano B:**
  - (a) `PreToolUse` com matcher `AskUserQuestion` a devolver
    `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","updatedInput":{...tool_input, "answers":{"<pergunta>":"<label>"}}}}`
    → o Claude segue com essas respostas, **sem seletor no ecrã** (multiSelect: labels separados por `, `). O
    plano B (`deny` com motivo) não foi preciso.
  - (b) `PermissionRequest` existe: stdin com `tool_name`, `tool_input` e `permission_suggestions`; a saída
    `{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}` permite, e
    `{"behavior":"deny","message":"…"}` recusa (o Claude recebe a `message` como resultado e continua). Nenhum
    `Notification` quando o hook decide. **⚠️ Só dispara com `--permission-mode default`**: o modo por omissão
    desta conta é `auto` (`permission_mode: "auto"` no stdin), que aprovou o Write e o Bash sozinho — a mesma causa
    do achado da importação (o `audit-library.mjs` editado). A sessão guiada **tem de** lançar com
    `--permission-mode default` (argumento fixo).
  - (c) Um hook com `timeout: 86400` ficou **10 min** bloqueado à espera do `answer.json` e a sessão seguiu
    normalmente com a resposta. O `86400` foi aceite sem erro de settings; um teto acima de 10 min não foi medido.
  - (d) `ESC[200~linha um⏎linha dois⏎…ESC[201~` + `CR` (Enter 300 ms depois) → **um** `UserPromptSubmit` com
    as 3 linhas.
  - (e) Fixture em `backend/test/fixtures/guided-transcript.jsonl` (30 linhas, caminhos e utilizador anonimizados,
    sem as linhas `api-request*` nem os attachments de contexto). O `.jsonl` tem tudo o que o feed precisa: a
    pergunta e as respostas em `toolUseResult.{questions,answers}` da linha `user`; **cada decisão de permissão,
    também as aceites**, num attachment `{"type":"hook_permission_decision","decision":"allow|deny","toolUseID"}`; a
    recusa também em `toolDenialKind` na linha do `tool_result`; o conteúdo da skill numa linha `user` com
    `isMeta: true`; e muitos tipos a ignorar (`mode`, `permission-mode`, `file-history-*`, `last-prompt`,
    `ai-title`, `system`).
- **Passo 2 — [[../adr/0020-sessoes-guiadas|ADR 0020]]** (2026-10-26), com linha no README. Acrescenta ao desenho: o
  `--permission-mode default` fixo, `timeout: 86400` nos hooks bloqueantes, e o filtro de caracteres de controlo
  (todos exceto `
` e `	`) no texto escrito no PTY — sem ele um `ESC[201~` no texto fechava o paste.
- **Passo 3 — no Workflow** (2026-10-26, commit `b8097ad` lá, **sem push**): secção "Modo app" do
  `skill-create.md` (a fonte de verdade do contrato do `result.json` — a §4.1 desta spec é só a forma inicial;
  **vale a de lá**), ponteiro `.claude/skills/create/SKILL.md`, ADR 0011, README dos ADRs, `vision.md`, allowlist
  (+ `render-blueprint`, `verify-project`, `git rev-parse`). Auditoria do pre-commit: 0 erros. **Teste a seco**
  duas vezes com `backend/scripts/create-app-dry-run.ts` (o `/create` real lançado como a app o vai lançar, com
  um brief de ginásio e respostas automáticas): o brief cobriu o bloco A todo (nenhuma pergunta de texto); 15-18
  perguntas, todas por `AskUserQuestion` (vocabulário, B, C, D, E1 com o caminho proposto, E2-E4, confirmação);
  até à proposta em ~2,5 min; Cancelar → `result.json` `failed` / "Cancelado pelo utilizador"; destino não
  criado; `git status` do Workflow só com as edições do passo. O `result.json` foi escrito **sem pedido de
  permissão** graças a uma regra `Edit(//c/…/guided/<uuid>/**)` no `--settings`.
- **Passo 4 — motor da sessão guiada** (2026-10-26): `guided/{guidedFiles,guided.schemas,guidedService,guided.routes}.ts`,
  `claudeArgs` com `kind: 'guided'` e `permissionMode`, `terminals/paste.ts`, `TerminalsService.createGuided`/`paste`
  e `reopen` de uma sessão guiada, `guidedId` no `state.json`, `GUIDED_001`–`004` (backend e `errorMessages.ts`).
  394 testes (+31: o hook gerado com stdin falso — sessão alheia/UUID inválido ignorados, eventos, pergunta e
  permissão com resposta, pasta apagada a meio; o serviço com terminais falsos — estado derivado, validações,
  resume, remove; as rotas sobre o `TerminalsService` real e o `claude` falso — argumentos, paste limpo no PTY,
  sessão obrigatória na app inteira). `typecheck` só com o erro antigo de `auth.test.ts`, lint limpo. **Com o
  `claude` real** (`backend/scripts/guided-engine-check.ts`, uma skill `create` de teste): pergunta com multiSelect →
  cartão → resposta; Write permitido, Bash recusado; `waiting-text` → mensagem de 2 linhas; `result.json` escrito sem
  pedir permissão → `done` em 20 s; `remove` limpa. `docs/api.md` e `docs/database.md`.
- **Passo 5 — conversa do `.jsonl`** (2026-10-26): `guided/transcriptFeed.ts` (`buildFeed` puro, `TranscriptFeed` com
  cache por tamanho/mtime, `feedPage`), `GuidedService.feed` (o brief como 1.ª entrada), `GET /api/guided/:id/feed`.
  406 testes (+12: a fixture inteira pela ordem certa, atividade agrupada, blocos da mesma mensagem numa bolha,
  pergunta/permissão por decidir, linhas inválidas e sub-agentes ignorados, o cursor, a rota). Com o `claude` real
  (`guided-engine-check.ts`): brief → "Leu 1 ficheiro" → pergunta → 2 permissões → pergunta aberta → resposta de 2
  linhas → "Escreveu 1 ficheiro" (o `result.json`, sem cartão). `docs/api.md`.
- **Passo 6 — criação** (2026-10-26): `creation/{creation.schemas,creationService,creation.routes}.ts`, `CREATE_001`/`002`
  (backend e `errorMessages.ts`). 413 testes (+7: o brief só no ficheiro e nunca nos argumentos, `/create --app` em
  último, escondido, segunda criação → `CREATE_001`, descrição vazia/longa → 400, `result.json` `done` → `open` cria um
  terminal visível na pasta, fora das roots → `FOLDER_001`, sem pasta/`failed` → `CREATE_002`, fechar liberta).
  **HTTP real** numa instância de `scripts/verify/` com `--workflow <real> --real-claude`: `POST /api/creations` → o
  `/create` real respondido só pela API (`answer`, `permission`, `message`) até à proposta em ~2 min, Cancelar →
  `failed`, feed com as 5 espécies de entrada, `DELETE` → `current` `null`, Workflow limpo. Achado e corrigido: no
  Windows o Claude correu o `render-blueprint` pela ferramenta **PowerShell**, fora da allowlist `Bash(…)` → o modo app
  manda usar a `Bash` (commit `70fc43c` no Workflow); na 2.ª corrida o único pedido de permissão foi o legítimo (o
  destino por omissão fora das roots da instância). Os resumos de `Glob`/`Grep` passam a levar o caminho.
**Em curso:** nada.
**Próxima ação concreta:** passo 7 — frontend, componentes da sessão guiada (`frontend/src/components/guided/`), numa
página de desenvolvimento com dados falsos. Começar por perguntar ao dono se quer um protótipo no Claude Design (§7).
**Desvios ao plano:**
- Passo 1: o lançamento da §4.2 ganha `--permission-mode default` (sem ele, no modo `auto` desta conta, o
  `PermissionRequest` nunca chega e não há cartões Permitir/Recusar). Escrever no ADR 0020 e no `claudeArgs` (passo 4).
- Passo 1: a permissão com decisão no feed vem do attachment `hook_permission_decision` (por `toolUseID`), não de
  um registo da app — confirma a decisão "a conversa vem do `.jsonl`" da §3.
- Passo 3: o `claude-guided-settings.json` tem de levar, além dos hooks, `permissions.allow` com
  `Edit(//<DATA_DIR>/guided/**)` (para o `result.json` e o `blueprint-config.json` não pedirem permissão — formato
  provado: `//c/Users/…`, letra da drive em minúscula, barras normais) e **`Read(//<root>/**)` por cada
  `ALLOWED_ROOTS`**: no teste a seco, ver se o destino existe (`Glob` fora do Workflow) pediu permissão — 3 cartões
  de permissão por leituras. Só leitura; a escrita no destino continua a pedir.
- Passo 3: o modo app manda ler com `Read`/`Grep`/`Glob` e não com a shell (na 1.ª corrida um `ls` e um `for … grep`
  pediram permissão), e não ler outros projetos (uma `Glob` foi à `docs/adr` desta app).
- Passo 3: numa das corridas o E5 (git) não foi perguntado. Não é bloqueante (o `git init` pede permissão na
  mesma); ver no passo 10 se se repete.
- Passo 3: entrou `backend/scripts/create-app-dry-run.ts` (não estava na spec) — serve para repetir o teste a
  seco quando o `/create` mudar.
- Passo 4: em vez de generalizar o `kind: 'import'` num `kind: 'prompted'` com prompt livre, entrou um
  `kind: 'guided'` com um conjunto **fechado** de comandos (`GUIDED_COMMANDS`: hoje só `create` → `/create --app`,
  ficheiro `brief.md`) — nenhum texto livre chega à linha de comando, nem do backend.
- Passo 4: um pedido à espera é `pending-<requestId>.json` (e a resposta `answer-<requestId>.json`), não um
  `pending.json` único — o Claude pode pedir permissões em paralelo, e dois hooks escreviam no mesmo ficheiro. A
  vista mostra o mais antigo. Cada pending leva o `pid` do hook: um hook morto (timeout, sessão parada) deixa de
  contar como pergunta e passa a `needs-you`.
- Passo 4: `event.json` ganha `Answered` (escrito pelo hook depois de responder → `working`), e uma `Notification`
  logo a seguir a um `Stop` não se regista (é o Claude Code a dizer que está parado à espera — senão
  `waiting-text` virava `needs-you` ao fim de um minuto). `message` grava `UserPromptSubmit` logo, para uma
  segunda mensagem não entrar antes do hook. `resume` grava `Stop` (a conversa retomada fica no prompt).
- Passo 4: a `GuidedView` ganhou `error` (porquê, quando o `result.json` é inválido), como a `ImportView`.
- Passo 4: o `guided-engine-check.ts` não estava na spec — prova o motor com o `claude` real sem o Workflow.
- Passo 5: o cursor não é "depois do id X": é quantas entradas o cliente tem, e a última volta sempre — só ela pode
  mudar (uma atividade que cresce, uma pergunta que recebe resposta, uma chamada que passa de atividade a permissão
  quando a decisão chega). A permissão por decidir não tem entrada própria no feed: o cartão vem da `GuidedView.pending`.
**O que uma sessão nova precisa de saber:**
- A entrevista **não** se escreve na app. Se uma sessão se apanhar a codificar perguntas do `/create` no
  frontend, está a fazer a alternativa rejeitada.
- A sessão guiada é um terminal `hidden` normal (da spec de importação) + hooks + o `.jsonl` — não um
  segundo motor. `claude -p` e a API continuam proibidos ([[../adr/0002-motor-via-pty-sobre-subscricao|ADR 0002]]).
- O formato do `.jsonl` e dos hooks não é contrato público do Claude Code: tudo o que depende deles está
  isolado em `transcriptFeed.ts` e no `guided-hook.cjs`, com testes sobre fixtures reais.

## 7. Perguntas em aberto

| Pergunta | Bloqueia | Notas |
|---|---|---|
| O `updatedInput` com `answers` responde ao `AskUserQuestion` sem mostrar o seletor? | — | ✅ Sim (spike, 2026-10-26) — §6 (a) |
| O hook `PermissionRequest` existe e decide nesta versão do CLI? | — | ✅ Sim, mas só com `--permission-mode default` (spike, 2026-10-26) — §6 (b) |
| Qual o `timeout` máximo de um hook? | Não — há o escape "Ver terminal" | ✅ Em parte: `86400` aceite e 10 min provados (spike, 2026-10-26); um teto acima disso não medido |
| Polling a 1,5 s chega para parecer fluido? | Não | Medir no passo 8; se não, SSE numa 2.ª iteração |
| Vale um protótipo no Claude Design antes do passo 7? | Não | Perguntar ao dono no início do passo 7 |

## Relacionado

[[skill-plan-feature]] · [[skill-implement-todo]] · [[../adr/README]] · [[importar-para-a-biblioteca]] ·
[[../adr/0002-motor-via-pty-sobre-subscricao]] · [[../adr/0012-argumentos-do-claude-e-status-line]] ·
[[terminais]] · [[../product/use-cases]]
