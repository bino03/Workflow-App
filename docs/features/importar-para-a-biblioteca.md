# Feature: Importar para a biblioteca do Workflow (pelas skills do Workflow)

| | |
|---|---|
| **Estado** | 🚧 Em curso |
| **Criada** | 2026-10-23 |
| **Última sessão** | 2026-10-25 |
| **Passos** | 10 / 11 concluídos |

> Escrita para uma sessão que **não viu a conversa que a originou**. Se algo só faz sentido com contexto
> externo, falta escrevê-lo.

Nasceu do pedido (2026-10-23): "algo que me deixe importar skills, front-ends, back-ends e stacks, **da mesma
maneira que está implementado no Workflow, no vault, não na aplicação** — tanto a partir da aplicação, e
adiciona no vault do Workflow". É a 2.ª fase da spec [[upload-de-skills]] (✅ fechada) e concretiza a ideia
"Acrescentar uma skill ou um design à biblioteca sem mexer no terminal" de [[../../notes/ideas|ideas.md]]
(contexto de 2026-09-28: os três problemas que lá estão — correr sem terminal, as perguntas da skill, rever
antes de aceitar — são os que esta spec resolve).

Há **dois repositórios** envolvidos:
- **App** — este (`C:\Users\jlalv\Desktop\utad\projetos\WorkFlow App`).
- **Workflow** — `WORKFLOW_PATH` (`C:\Users\jlalv\Desktop\Workflow\Workflow` nesta máquina), com o seu próprio
  git, `CLAUDE.md`, ADRs (`docs/adr/`) e skills (`docs/skills/` + ponteiros em `.claude/skills/`). As
  convenções desse vault mandam lá dentro: ler o `CLAUDE.md` do Workflow antes de lhe mexer.

---

## 1. O que é e porquê

Hoje a app só sabe pôr na biblioteca **um** `skill-*.md` já pronto dentro de uma stack, e escreve-o ela
própria sem triagem ([[../adr/0014-escrita-controlada-biblioteca|ADR 0014]]). Tudo o resto — uma stack nova
(backend, frontend, desktop…), um design, uma skill solta ou vinda da net — exige abrir um terminal no
Workflow e correr à mão `/add-stack`, `/add-new-design` ou `/create-new-skill`. São essas skills que fazem o
trabalho que importa: triagem (vale a pena entrar?), forma fixa dos módulos, texto genérico com
placeholders, contraste WCAG, registo, proveniência, `node tools/audit-library.mjs`. Um upload direto pela
app salta tudo isso.

O dono quer importar **qualquer** destas coisas a partir da app, mas com a lógica a viver **no vault do
Workflow**, não no código da app: a app recolhe o pedido num formulário, corre a skill do Workflow num
terminal escondido, e no fim mostra o que mudou para o dono aceitar (commit) ou descartar.

**Como sei que está bem feito:** na Biblioteca carrego em **Importar**, escolho "Stack", dou o URL da
documentação de uma tecnologia, preencho camada/versões/com-que-combina e envio. Aparece uma faixa
"A importar…" no topo da Biblioteca; não abro nenhum terminal. Uns minutos depois a faixa diz "Pronto a
rever": abro, vejo o veredito da triagem, o resumo e o diff de cada ficheiro criado em `library/` do
Workflow; carrego **Aceitar** e há um commit novo no Workflow, a stack aparece na tab Stacks. Se a meio a
skill tiver uma dúvida, a faixa passa a "Precisa de ti" e **Ver terminal** mostra-me o terminal na grelha,
onde respondo. Se carregar **Descartar**, o `git status` do Workflow fica limpo como estava.

## 2. Âmbito

### Dentro
- **Tipos importáveis**: `skill` (de processo, ou de uma stack), `design` (tema), `stack` (qualquer camada:
  backend, frontend, platform, desktop, fullstack), e `auto` ("Não sei — decide tu": a skill do Workflow
  classifica).
- **Origens**: ficheiros ou uma pasta enviados pelo browser · um URL (`http`/`https`) · uma pasta local
  dentro de `ALLOWED_ROOTS` (ex. um projeto em `utad/projetos`) · uma descrição em texto.
- **Do lado do Workflow** (repo do Workflow):
  - Skill nova **`/import`** — o ponto de entrada único: lê o pedido (`request.json`), classifica se
    `kind: auto`, e segue os passos da skill certa (`/create-new-skill`, `/add-new-design`, `/add-stack`)
    em **modo importação**: sem fazer perguntas que o pedido já responde, **sem commit**, e termina a
    escrever um `result.json`.
  - As três skills existentes ganham uma secção "Modo importação" (o que muda quando correm a partir do
    `/import`) — o resto dos passos, a triagem e o Final Checklist ficam iguais.
  - O contrato `request.json` / `result.json` documentado **uma vez**, no Workflow
    (`docs/import-contract.md`); a app espelha-o em zod e linka para lá.
  - `.claude/settings.json` (versionado) com uma allowlist estreita, para o terminal escondido não parar
    em pedidos de permissão nos casos normais.
  - ADR no Workflow (o `docs/vision.md` dele tem a pergunta em aberto "A app escreve na biblioteca?").
  - O formato do catálogo de skills externas (`library/external/`, hoje 🚧 "proposta") fica aceite, porque
    importar uma skill de um URL de terceiros cai lá ([[#3. Decisões tomadas]]).
- **Do lado da app**:
  - Um botão **Importar** no cabeçalho da Biblioteca (visível em todas as tabs) → drawer com tipo, origem e
    as perguntas desse tipo.
  - Um terminal **escondido** por importação: um terminal normal (PTY com o `claude`, `cwd` =
    `WORKFLOW_PATH`), marcado `hidden` — não aparece na grelha nem no bot até ser revelado.
  - Estado da importação visível numa faixa no topo da Biblioteca: `A importar` · `Precisa de ti` (com
    **Ver terminal**) · `Pronto a rever` · `Falhou`.
  - Revisão: resumo + triagem + diff por ficheiro → **Aceitar** (commit no Workflow) ou **Descartar**
    (repõe o Workflow como estava). **Cancelar** enquanto corre (mata o terminal e descarta).
  - **Uma importação de cada vez** (partilham o git do Workflow), e só com o Workflow sem alterações por
    gravar.
- **Sai o upload direto de skills** (o `POST /api/library/stacks/:stackId/skills`, o `UploadSkillDrawer`,
  o `frontmatterEditor`) — a app volta a **não escrever ficheiros** na biblioteca; só faz o commit/reversão
  que o dono pede. Novo ADR substitui o 0014.

### ⛔ Fora — não implementar nesta feature
- **`.zip`** — envia-se a pasta (o browser manda os caminhos relativos). Descomprimir é superfície nova
  (zip-slip) e uma biblioteca nova no backend, para um caso que a pasta já cobre.
- **Responder às perguntas da skill numa UI própria** (ler o pedido do `.jsonl` e escrever a resposta no
  PTY). Quando a skill precisa de algo, revela-se o terminal — decidido na entrevista.
- **Várias importações em paralelo**, e fila de importações.
- **Aceitar só parte dos ficheiros**, ou editar o diff antes de aceitar. É tudo ou nada; para afinar,
  revela-se o terminal e pede-se à sessão, ou aceita-se e corrige-se depois.
- **Histórico de importações na app.** O histórico é o `git log` do Workflow; uma importação aceite ou
  descartada desaparece da app (o terminal vai para o histórico de terminais, como qualquer outro).
- **Editar ou apagar entradas que já estão na biblioteca** pela app.
- **Lançar `/harvest-project`, `/adopt-project`, `/upgrade-project` ou `/create`** pela app (o mecanismo
  serve-os, mas cada um é uma conversa longa — 2.ª fase).
- **Avisos fora da Biblioteca** (Telegram, badge na navegação, notificação do browser) quando a importação
  fica "Precisa de ti" ou "Pronto a rever".
- **`git push`** do Workflow. Aceitar faz só o commit local, como as skills do Workflow fazem hoje.
- **Mudar a forma dos módulos da biblioteca** (`STACK.md`, `THEME.md`, frontmatter das skills). O `/import`
  usa a forma que existe.

> Esta lista impede uma sessão futura de expandir o âmbito sozinha.

### Segunda fase (se houver)
- Lançar `/harvest-project` (a partir de um projeto em `utad/projetos`) pelo mesmo mecanismo.
- Aviso no Telegram quando uma importação fica "Precisa de ti" / "Pronto a rever" (o bot já existe, ADR 0017).
- Responder às perguntas da skill sem revelar o terminal, se o "Ver terminal" se mostrar frequente.

## 3. Decisões tomadas

| Decisão | Escolha | Porquê | Alternativa rejeitada |
|---|---|---|---|
| Onde vive a lógica da importação | Nas skills do Workflow (`/import` → `/add-stack` · `/add-new-design` · `/create-new-skill`); a app só lança, mostra e faz commit/reversão | Pedido explícito do dono ("no vault, não na aplicação"); as skills já fazem triagem, forma fixa, WCAG, placeholders, registo, proveniência — um upload direto salta tudo isso | App a escrever os ficheiros (o que o ADR 0014 fazia) — cresce para três validadores na app que duplicam as skills |
| Como corre | Formulário na app + terminal **escondido** com o `claude` no `WORKFLOW_PATH` | Escolha do dono na entrevista: não quer ver um terminal para uma importação normal | Terminal visível já com o comando lançado (era a recomendação; rejeitada pelo dono) |
| Ponto de entrada no Workflow | Uma skill nova `/import` que lê o pedido e encaminha | A app não precisa de saber qual das três skills corre; `kind: auto` passa a ser possível; o "modo importação" fica descrito num sítio | A app escolher a skill pelo tipo e só as três ganharem "origem por argumento" |
| Respostas às perguntas da skill | Vêm no `request.json` (escrito pelo backend com o que o formulário recolheu); o texto do dono **nunca** entra na linha de comando nem é escrito no PTY | Mantém o ADR 0012 (nada do cliente vira argumento): a linha de comando só leva um caminho gerado pelo backend | Escrever as respostas no PTY à medida que a skill pergunta — frágil (detetar a pergunta no ecrã) |
| Quando a skill precisa de algo que o pedido não tem, ou o Claude pede permissão | O terminal escondido é revelado (botão **Ver terminal**) e o dono responde lá | Nada se perde; não obriga a modelar perguntas abertas numa UI | Parar, mostrar a pergunta na app e recomeçar a importação com a resposta — cada pergunta custava uma corrida nova |
| Permissões no terminal escondido | Allowlist estreita no `.claude/settings.json` **do Workflow** (versionado) | Fica no vault do Workflow, como o dono pediu; serve também quem corre as skills à mão | `--permission-mode acceptEdits` passado pela app — só cobre edições (Bash e WebFetch continuam a pedir) e mexia nos argumentos fixos |
| Como a app sabe o estado | `result.json` escrito pela skill no fim + hooks `Stop`/`Notification`/`UserPromptSubmit` num `--settings` próprio das importações, que só gravam o nome do evento | A app não lê o ecrã nem o `.jsonl`; um `Stop` sem `result.json` = a skill parou para perguntar | Ler o ecrã do PTY à procura de prompts — frágil a cada versão do CLI |
| Como a skill arranca | `/import <caminho do request.json>` como **prompt inicial posicional** do `claude` interativo (não é `claude -p`), com o caminho gerado pelo backend e validado por regex | Sem esperar que o TUI esteja pronto para escrever no PTY | Escrever `/import …` no PTY depois do arranque — exige detetar "pronto" (diálogo de confiança, atualizações). **Fica como plano B se o spike (passo 1) mostrar que o prompt posicional não corre slash commands** |
| Ficheiros enviados e pasta local fora do `cwd` | `--add-dir <pasta>` (pasta de staging em `DATA_DIR/imports/<id>/` ou a pasta do projeto já resolvida pelo `cwdPolicy`) | A app não escreve nada dentro do `WORKFLOW_PATH`, nem staging | Staging dentro do Workflow (`.imports/`, git-ignored) — a app voltava a escrever no Workflow |
| Revisão | A skill **não** faz commit em modo importação; a app mostra o diff e **Aceitar** faz `git add` dos ficheiros alterados + `git commit` no Workflow; **Descartar** repõe-nos | A biblioteca é partilhada por todos os projetos gerados — um erro só aparece no projeto seguinte | Commit pela skill (como hoje à mão) — desfazer obrigava a `git revert` |
| Pré-condição | Só se arranca com o `git status` do Workflow limpo e sem outra importação ativa | Garante que "o que mudou" = "o que a importação fez", e que Aceitar/Descartar não toca em trabalho do dono | Permitir e tentar separar as alterações — impossível de fazer bem |
| Upload direto da v1 (ADR 0014) | **Sai** | Escolha do dono; com o `/import` a app volta a não escrever ficheiros na biblioteca, e há um só caminho | Manter os dois |
| Skill externa vinda de um URL | O `/import` segue as regras de `library/external/README.md` do Workflow: cataloga-a (`kind: external-skill`, com veredito) e só a adapta para `library/skills` se a licença o permitir; o formato proposto desse README passa a aceite no ADR do Workflow | O README já diz "o ADR fica por escrever quando a primeira leva entrar" — esta feature é essa leva | Copiar a skill externa tal como vem — viola "nunca copiar sem respeitar a licença" |
| Comando `git` | `GIT_BIN` (omissão `git`), sempre com argumentos fixos, `cwd` = `WORKFLOW_PATH`, sem shell (`execFile`) | Mesmo padrão do `TAILSCALE_BIN` (ADR 0018) para um binário novo | `simple-git` ou outra dependência — só são precisos 4 comandos |

**ADRs gerados** (escritos nos passos 2 e 3, não agora):
- **App — ADR 0019** "Importar para a biblioteca pelas skills do Workflow": substitui o
  [[../adr/0014-escrita-controlada-biblioteca|0014]]; acrescenta à lista do
  [[../adr/0012-argumentos-do-claude-e-status-line|0012]] o prompt inicial `/import <caminho>` e
  `--add-dir <caminho>`, e um segundo ficheiro de `--settings` (o das importações, com hooks); abre a regra
  de binários do [[../adr/0004-exposicao-e-modelo-de-ameaca|0004]] a `GIT_BIN`.
- **Workflow — ADR 0010** "Importações pela Workflow App": o `/import`, o modo importação (sem perguntas
  respondidas, sem commit, `result.json`), a allowlist, o catálogo de skills externas aceite; responde à
  pergunta 2 do `docs/vision.md` do Workflow ("a app escreve na biblioteca?" → não: lança as skills, e só faz
  commit/reversão a pedido do dono).

## 4. Desenho técnico

### 4.1 Dados

Sem base de dados ([[../adr/0009-estado-em-ficheiro-json|ADR 0009]]).

**`state.json`** — `savedTerminalSchema` (`backend/src/state/state.schema.ts`) ganha dois campos, com omissão
(ficheiros antigos não precisam de migração, como o `remoteControl`):

```ts
importId: z.uuid().nullable().default(null),   // terminal lançado por uma importação
hidden: z.boolean().default(false),            // fora da grelha e do bot até ser revelado
```

**Uma importação vive numa pasta**, `DATA_DIR/imports/<importId>/` (fora do `state.json`, apagada ao
aceitar/descartar):

| Ficheiro | Quem escreve | O quê |
|---|---|---|
| `request.json` | backend, ao criar | O pedido (contrato abaixo) |
| `files/…` | backend, ao criar | Os ficheiros enviados, com os caminhos relativos já saneados (só origem `files`) |
| `result.json` | a skill `/import`, no fim | O resultado (contrato abaixo) |
| `meta.json` | backend | `{ id, terminalId, claudeSessionId, createdAt }` — liga a importação ao terminal |

**Eventos dos hooks**: `DATA_DIR/import-events/<claudeSessionId>.json` = `{ event, at }` (último evento só;
`event` ∈ `Stop` · `Notification` · `UserPromptSubmit`). Escrito pelo `import-hook.cjs`, apagado com a
importação.

**Estado derivado** (nunca guardado), por esta ordem:
1. `result.json` válido → `review` (se `git status` mostra alterações) ou `rejected` (sem alterações —
   a triagem disse que não) ou `failed` (`result.status: failed`).
2. Terminal já não está `running` → `failed` (o processo saiu sem resultado).
3. Último evento `Stop` ou `Notification` → `needs-you`.
4. Senão → `running`.

Depois de um reinício do backend, o PTY morreu: a importação aparece `failed` (com `result.json`, `review`
continua possível — os ficheiros estão no disco do Workflow).

**Contrato `request.json` / `result.json`** — fonte de verdade em `WORKFLOW_PATH/docs/import-contract.md`
(passo 2). Forma inicial a escrever lá:

```jsonc
// request.json — versão 1
{
  "version": 1,
  "id": "<uuid>",
  "kind": "skill" | "design" | "stack" | "auto",
  "source":
      { "type": "files",   "path": "<abs: DATA_DIR/imports/<id>/files>" }
    | { "type": "url",     "url": "https://…" }
    | { "type": "project", "path": "<abs, dentro de ALLOWED_ROOTS>" }
    | { "type": "text",    "text": "…" },
  "answers": { … },          // por kind, abaixo; texto livre do dono, até 2000 chars por campo
  "createdAt": "<ISO>"
}
// answers por kind — espelham o "Step 1" de cada skill do Workflow:
//  stack:  { technology, layer: backend|frontend|platform|desktop|fullstack, pairsWith: string[],
//            conflictsWith: string[], whenToChoose, whenNot, versions }
//  design: { name, character, suits, notSuits }
//  skill:  { target: "process" | "<stack id>", whenToUse }
//  auto:   { notes }

// result.json — versão 1, escrito pela skill /import como último passo
{
  "version": 1,
  "id": "<o mesmo do request>",
  "status": "done" | "rejected" | "failed",
  "kind": "skill" | "design" | "stack" | "external-skill",
  "libraryId": "<id da entrada criada>" | null,
  "summary": "<markdown curto: o que entrou e porquê>",
  "triage": [{ "criterion": "Distinto", "ok": true, "note": "…" }],
  "commitMessage": "feat: acrescenta a stack django à biblioteca",
  "error": "<só com status failed>"
}
```

### 4.2 Endpoints

Todas com sessão obrigatória (`AUTH_002`), como o resto da API.

| Método | Rota | Corpo | Resposta | Erros |
|---|---|---|---|---|
| POST | `/api/library/imports` | `multipart/form-data`: campo `request` (JSON: `kind`, `source` sem `path` de staging, `answers`) + 0..N campos `files` (cada um com o caminho relativo como nome do ficheiro) | `201 ImportView` | `COMMON_001` · `IMPORT_002` · `IMPORT_003` · `IMPORT_004` · `FOLDER_*` (pasta fora de `ALLOWED_ROOTS`) · `TERMINAL_002`/`005`/`007` |
| GET | `/api/library/imports/current` | — | `200 ImportView \| null` | — |
| GET | `/api/library/imports/:id/diff` | — | `200 ImportDiff` | `IMPORT_001` · `IMPORT_005` (não está em `review`) |
| POST | `/api/library/imports/:id/accept` | — | `200 { commit: string }` (sha) | `IMPORT_001` · `IMPORT_005` · `IMPORT_006` |
| POST | `/api/library/imports/:id/discard` | — | `204` | `IMPORT_001` · `IMPORT_006` |
| POST | `/api/library/imports/:id/reveal` | — | `200 TerminalView` (agora `hidden: false`) | `IMPORT_001` |
| DELETE | `/api/library/imports/:id` | — | `204` — cancela: mata o terminal, descarta alterações, apaga a pasta | `IMPORT_001` · `IMPORT_006` |

**Sai**: `POST /api/library/stacks/:stackId/skills` (e o registo do `@fastify/multipart` passa a servir só
esta rota nova, com os limites dela).

`GET /api/terminals` e o bot (`backend/src/telegram/botActions.ts`, que usa `terminals.list()`) deixam de ver
terminais `hidden`. `MAX_TERMINALS` conta-os (um terminal escondido é um PTY como os outros).

**Limites do upload** (constantes no código, como os 256 KiB da v1): até 200 ficheiros, 10 MiB no total;
cada caminho relativo saneado (`/` como separador, sem segmentos `..` nem `.`, sem absolutos nem letra de
drive, sem `:`, até 512 chars) — um caminho mau recusa o pedido inteiro (`IMPORT_004`), nada escrito.
URL: só `http:`/`https:`, até 2048 chars. Pasta local: `resolveAllowedPath` (o mesmo `cwdPolicy` dos
terminais).

**O que o backend lança** (`terminals/claudeArgs.ts`, único sítio que constrói a linha de comando):

```
claude --session-id <uuid> --settings <DATA_DIR/claude-import-settings.json>
       --add-dir <DATA_DIR/imports/<id>>  [--add-dir <pasta do projeto, se source=project>]
       "/import <DATA_DIR/imports/<id>/request.json>"
```

O prompt é validado contra `^/import [^\s"'`$<>|&;]+request\.json$` **e** tem de ser
`join(DATA_DIR, 'imports', <uuid>, 'request.json')` — o backend constrói-o, nada do cliente entra lá.
`cwd` = `WORKFLOW_PATH` (tem de estar em `ALLOWED_ROOTS` — está) e tem de ser pasta de confiança do Claude
Code (`isTrustedFolder`, como o Remote Control) → senão `TERMINAL_007`: ninguém está no PTY para responder
ao diálogo de confiança.

**`claude-import-settings.json`** (escrito no arranque, como o `claude-settings.json` —
`backend/src/usage/usageFiles.ts`): a mesma `statusLine` + `hooks` para `Stop`, `Notification` e
`UserPromptSubmit`, todos com o comando fixo `"<process.execPath>" "<DATA_DIR>/import-hook.cjs"`. O
`import-hook.cjs` lê o stdin, tira `session_id` (validado como UUID) e `hook_event_name`, grava
`import-events/<session_id>.json`, nunca falha e nunca imprime nada (o `Stop` de um hook que imprime pode
bloquear o fim do turno).

**git** (`backend/src/imports/workflowGit.ts`, `execFile(GIT_BIN, args, { cwd: WORKFLOW_PATH })`):

| Para quê | Argumentos fixos |
|---|---|
| Pré-condição e lista de alterações | `status --porcelain=v1 -z --untracked-files=all` |
| Diff de um ficheiro alterado | `diff --no-color -- <path>` (path da lista acima) |
| Diff de um ficheiro novo | lido do disco, mostrado como todo adicionado |
| Aceitar | `add -- <paths…>` e `commit -m <mensagem>` |
| Descartar | `checkout -- <paths modificados/apagados>` + `unlink` dos novos (caminhos resolvidos e verificados dentro do `WORKFLOW_PATH`) |

A mensagem do commit é o `commitMessage` do `result.json` se bater em
`^(feat|docs|fix|chore): [^\n]{1,100}$`; senão `feat: importa <kind> <libraryId> para a biblioteca`. Os
hooks de pre-commit do Workflow (`.githooks`) correm — se recusarem, `IMPORT_006` com o fim do stderr, nada
fica a meio (o `add` é desfeito com `reset -- <paths>`).

### 4.3 Tipos / DTOs

```ts
// backend/src/imports/imports.schemas.ts — espelhados em frontend/src/types/imports.ts
export type ImportKind = 'skill' | 'design' | 'stack' | 'auto';
export type ImportStatus = 'running' | 'needs-you' | 'review' | 'rejected' | 'failed';

export type ImportView = {
  id: string;
  kind: ImportKind;
  sourceLabel: string;            // "3 ficheiros" · "https://…" · "utad/projetos/X" · "Descrição"
  status: ImportStatus;
  terminalId: string;
  createdAt: string;
  result: ImportResult | null;    // o result.json validado, quando existe
  changedFiles: number;           // do git status; 0 enquanto corre
};

export type ImportResult = {
  status: 'done' | 'rejected' | 'failed';
  kind: 'skill' | 'design' | 'stack' | 'external-skill';
  libraryId: string | null;
  summary: string;
  triage: { criterion: string; ok: boolean; note: string }[];
  commitMessage: string;
  error?: string;
};

export type ImportDiff = {
  files: { path: string; change: 'added' | 'modified' | 'deleted'; diff: string; truncated: boolean }[];
};
```

Um `result.json` que não faz `parse` → a importação fica `failed` com `error: "result.json inválido"` (e
**Ver terminal** continua disponível).

### 4.4 Interface

- **Onde vive**: ecrã Biblioteca (`/library`).
- **Como se chega lá**: botão **Importar** no cabeçalho da Biblioteca (substitui o "+ Adicionar skill" da tab
  Skills), visível em todas as tabs. Desativado, com tooltip, quando já há uma importação ativa.
- **Drawer `ImportDrawer`** (padrão de drawer da app, [[../skills/references/design/drawers-and-modals|drawers-and-modals]];
  formulário com React Hook Form + Zod, [[../skills/references/design/forms-and-validation|forms-and-validation]]):
  1. **O quê** — segmentado: Skill · Design · Stack · Não sei.
  2. **De onde** — segmentado: Ficheiros · URL · Projeto · Descrição. Ficheiros = zona de arrastar (ficheiros
     ou uma pasta, `webkitdirectory`), mostra contagem e tamanho total; Projeto = o seletor de pastas que o
     diálogo de novo terminal já usa (`frontend/src/components/terminals/new/`).
  3. **Perguntas do tipo** — os campos de `answers` (§4.1); `skill.target` é um `Select` com "Processo
     (sem stack)" + as stacks de `useLibrary().stacks.entries`; `stack.pairsWith`/`conflictsWith` são
     `Select` múltiplos com as stacks existentes.
  4. **Importar** — `loading`; erro do backend dentro do drawer ([[../skills/references/frontend-error-handling|frontend-error-handling]]).
  Sucesso → fecha, aparece a faixa.
- **Faixa `ImportBanner`** no topo da Biblioteca (só quando há uma importação): ícone + texto do estado +
  ações:
  | Estado | Texto | Ações |
  |---|---|---|
  | `running` | A importar <tipo> de <origem>… | Ver terminal · Cancelar |
  | `needs-you` | A skill precisa de ti | **Ver terminal** · Cancelar |
  | `review` | Pronto a rever — N ficheiros | **Rever** · Descartar |
  | `rejected` | A triagem não aceitou: <1.ª linha do summary> | Ver porquê (abre a revisão sem diff) · Fechar (= descartar) |
  | `failed` | Falhou: <error> | Ver terminal · Descartar |
  Atualiza-se por polling de `GET /imports/current` a cada 3 s **só** enquanto `running`/`needs-you`.
- **Drawer `ImportReviewDrawer`**: summary (Markdown), tabela da triagem (✓/✗ + nota), lista de ficheiros
  com o diff de cada um (colapsável, monoespaçado, adições/remoções com tokens de sucesso/erro), botões
  **Aceitar** (primário) e **Descartar** (perigo, com confirmação). Aceitar → notificação "Importado
  (<sha curto>)", a faixa some, `useLibrary` volta a carregar a lista.
- **Ver terminal** → `POST …/reveal` e navega para `/terminals` com esse terminal em foco (o terminal passa a
  ser um terminal normal da grelha; fechar a importação depois fecha-o).
- **Estado vazio**: sem importação ativa, não há faixa. Sem `WORKFLOW_PATH`/biblioteca, o botão não aparece
  (a Biblioteca já mostra `LIBRARY_001`).
- **Visibilidade por role**: não há roles ([[../adr/0003-auth-utilizador-unico]]).
- **Visual**: só tokens ([[../skills/references/design/tokens-and-colors|tokens-and-colors]]); a faixa e o
  bloco de diff são padrões novos → registados em `docs/skills/references/design/` no passo 10.

**Ficheiros**:
- **Backend (novo)**: `backend/src/imports/{imports.schemas,importService,imports.routes,workflowGit,importFiles,stagingFiles}.ts`,
  `backend/test/{imports.routes,importService,workflowGit,stagingFiles,importFiles}.test.ts`,
  `backend/scripts/import-spike.ts`.
- **Backend (modificado)**: `backend/src/terminals/{claudeArgs,terminalsService,terminals.routes}.ts`,
  `backend/src/state/state.schema.ts`, `backend/src/telegram/botActions.ts` (não listar escondidos),
  `backend/src/{app,config}.ts` (`GIT_BIN`, registo das rotas, multipart), `backend/src/common/errors.ts`,
  `backend/test/{claudeArgs,terminalsService,stateStore}.test.ts`.
- **Backend (apagado)**: `backend/src/library/frontmatterEditor.ts`, `backend/test/{frontmatterEditor,library.upload}.test.ts`,
  `uploadSkill` em `libraryService.ts`, a rota em `library.routes.ts`, `skillUploadManifestSchema`.
- **Frontend (novo)**: `frontend/src/types/imports.ts`, `frontend/src/services/importService.ts`,
  `frontend/src/hooks/useCurrentImport.ts`, `frontend/src/components/library/{ImportDrawer,ImportBanner,ImportReviewDrawer}.tsx`.
- **Frontend (modificado)**: `frontend/src/pages/LibraryPage.tsx`, `frontend/src/hooks/useLibrary.ts` (sai
  `addSkill`, entra `reload`), `frontend/src/services/libraryService.ts` (sai `uploadSkill`),
  `frontend/src/errors/errorMessages.ts`, `frontend/src/pages/TerminalsPage.tsx` (foco num terminal vindo da
  navegação, se ainda não existir).
- **Frontend (apagado)**: `frontend/src/components/library/UploadSkillDrawer.tsx`.
- **Workflow (novo)**: `docs/skills/skill-import.md`, `.claude/skills/import/SKILL.md`,
  `docs/import-contract.md`, `docs/adr/0010-importacoes-pela-workflow-app.md`, `.claude/settings.json`.
- **Workflow (modificado)**: `docs/skills/{skill-add-stack,skill-add-new-design,skill-create-new-skill}.md`
  (secção "Modo importação"), `docs/skills/SKILLS-INDEX.md`, `docs/adr/README.md`,
  `library/external/README.md` (formato aceite), `docs/vision.md` (pergunta 2 respondida, link ao ADR),
  `CLAUDE.md` do Workflow (uma linha no "Fluxo de trabalho": importar → `/import`).

### 4.5 Códigos de erro novos

| Código | HTTP | Mensagem no frontend |
|---|---|---|
| `IMPORT_001` | 404 | Esta importação já não existe |
| `IMPORT_002` | 409 | Já há uma importação a decorrer — acaba-a ou cancela-a primeiro |
| `IMPORT_003` | 409 | O Workflow tem alterações por gravar — faz commit ou descarta-as antes de importar |
| `IMPORT_004` | 400 | Ficheiros a mais, grandes demais, ou com um caminho inválido |
| `IMPORT_005` | 409 | A importação ainda não está pronta para isto |
| `IMPORT_006` | 500 | O git do Workflow recusou a operação (o detalhe vem na mensagem) |

**Retirados**: `LIBRARY_002`–`LIBRARY_005` (saem do backend e do `errorMessages.ts`; não se reutilizam os
números).

## 5. Passos

Ordem obrigatória. Tiers: `opus` (desenho, não delegar) · `sonnet` (implementação) · `haiku` (mecânico).
**Regra 8 do `CLAUDE.md`**: nunca editar o backend a partir de um terminal servido por ele em `npm run dev`.
**Os passos 2 e 3 mexem no repo do Workflow** — ler o `CLAUDE.md` dele antes; commits lá são separados dos
desta app.

- [x] **1. Spike — prompt inicial, hooks e `--add-dir`**
  - Ficheiro: `backend/scripts/import-spike.ts` (como o `statusline-spike.ts`/`preview-spike.ts`)
  - Skill: —
  - Tier: `opus` (decide o mecanismo de arranque; o plano B muda o passo 4)
  - Aceite quando: num PTY com o `claude` real, `cwd` numa pasta temporária de confiança, fica provado e
    escrito na §6: (a) `claude --session-id <uuid> --settings <f> "/<comando> <caminho>"` corre o slash
    command como primeira mensagem, em modo interativo; (b) os hooks `Stop`, `Notification` e
    `UserPromptSubmit` de um `--settings` correm e recebem `session_id` e `hook_event_name` no stdin; (c)
    com `--add-dir <pasta>` o `claude` lê um ficheiro dessa pasta sem pedir permissão; (d) um hook que não
    imprime nada não atrasa o fim do turno. Se (a) falhar: plano B (escrever `/import …\r` no PTY quando
    aparece o primeiro `Notification`/idle) descrito na §6 e o passo 4 ajustado **antes** de avançar.

- [x] **2. ADR 0019 da app**
  - Ficheiro: `docs/adr/0019-importar-pelas-skills-do-workflow.md`, `docs/adr/README.md` (linha nova; o
    0014 passa a `substituído por 0019` **só** na coluna Estado do README e no campo Estado do próprio 0014
    — a decisão original não se reescreve)
  - Skill: —
  - Tier: `opus`
  - Aceite quando: o ADR tem contexto (pedido de 2026-10-23, o que o 0005/0014 decidiram, a ideia de
    2026-09-28), opções (terminal visível · escondido com formulário · upload direto alargado · manter
    0014), decisão (§3 desta spec, incluindo os argumentos novos — prompt inicial e `--add-dir` — o segundo
    `--settings` com hooks, e `GIT_BIN`), consequências (o que sai, o que fica de fora — §2); README do ADR
    atualizado.

- [x] **3. Workflow — `/import`, modo importação, contrato, allowlist, ADR 0010**
  - Ficheiro (repo do Workflow): `docs/adr/0010-importacoes-pela-workflow-app.md`, `docs/adr/README.md`,
    `docs/import-contract.md`, `docs/skills/skill-import.md`, `.claude/skills/import/SKILL.md`,
    `docs/skills/{skill-add-stack,skill-add-new-design,skill-create-new-skill}.md`, `docs/skills/SKILLS-INDEX.md`,
    `library/external/README.md`, `docs/vision.md`, `CLAUDE.md`, `.claude/settings.json`
  - Skill: `/create-new-skill` **do Workflow** (secção "Skill do Workflow")
  - Tier: `opus` (é o desenho da importação — triagem, classificação `auto`, o que se pergunta e o que não)
  - Aceite quando: `skill-import.md` tem os passos (ler o pedido e validar a versão → classificar se
    `auto` → ler a origem conforme o tipo → seguir a skill de destino em modo importação → `node
    tools/audit-library.mjs` → escrever `result.json` → **nunca** commit) e diz explicitamente o que fazer
    quando falta informação (perguntar normalmente no terminal — a app revela-o); as três skills têm
    "Modo importação" curto (sem perguntas já respondidas, sem commit, o resto igual); o contrato tem os
    JSON da §4.1 desta spec (que passa a linkar para lá); a allowlist cobre `Read`, `Write`/`Edit` em
    `library/**` e `docs/provenance.md`, `WebFetch`, `Bash(node tools/audit-library.mjs:*)`,
    `Bash(git status:*)`/`Bash(git diff:*)` — e **não** `git commit`/`git push`/`rm`; **teste a seco**: no
    Workflow, à mão, `/import <request.json de teste>` com uma descrição de um design fictício chega a
    `result.json` válido sem pedir permissões, e o `git checkout`/limpeza deixa o `git status` limpo;
    commit no Workflow `feat: /import — a Workflow App importa pelas skills do vault`.

- [x] **4. Backend — terminais escondidos e a linha de comando da importação**
  - Ficheiro: `backend/src/terminals/claudeArgs.ts` (`ClaudeLaunch` + `{ kind: 'import'; sessionId;
    requestPath; addDirs }`), `backend/src/imports/importFiles.ts` (escreve `claude-import-settings.json` e
    `import-hook.cjs`, como `usageFiles.ts`), `backend/src/state/state.schema.ts` (`importId`, `hidden`),
    `backend/src/terminals/terminalsService.ts` (`createHidden`, `reveal`, `list` sem escondidos),
    `backend/src/telegram/botActions.ts`, testes em `backend/test/{claudeArgs,importFiles,terminalsService,stateStore}.test.ts`
  - Skill: —
  - Tier: `sonnet`
  - Aceite quando: `claudeArgs` rejeita um `requestPath` relativo, com espaços/aspas, ou fora de
    `DATA_DIR/imports/<uuid>/request.json`; um `state.json` antigo carrega com `importId: null, hidden:
    false`; `GET /api/terminals` e o bot não mostram escondidos; `reveal` torna-o visível; o `import-hook.cjs`
    (testado com stdin falso) grava o evento, ignora `session_id` que não é UUID e sai 0 sem imprimir;
    `npm run typecheck`/`test`/`lint` limpos.

- [x] **5. Backend — `ImportService`: criar, estado, cancelar**
  - Ficheiro: `backend/src/imports/{imports.schemas,importService,stagingFiles,imports.routes}.ts`,
    `backend/src/{app,config}.ts`, `backend/src/common/errors.ts` (`IMPORT_001`–`IMPORT_006`),
    `backend/test/{imports.routes,importService,stagingFiles}.test.ts`, `docs/api.md`
  - Skill: —
  - Tier: `opus` (escreve no disco a partir de caminhos enviados pelo cliente; lança processos com cwd no
    Workflow)
  - Aceite quando: `POST /api/library/imports` com cada uma das quatro origens cria a pasta, o
    `request.json` (que faz `parse` no schema do contrato), o terminal escondido (com o `claude` falso de
    `test/fakeClaude.ts`) e devolve `201 ImportView` `running`; caminho relativo com `..`, absoluto ou `C:`
    → `400 IMPORT_004` e nada escrito; > 200 ficheiros ou > 10 MiB → `IMPORT_004`; segunda importação →
    `409 IMPORT_002`; Workflow sujo → `409 IMPORT_003`; pasta de projeto fora de `ALLOWED_ROOTS` → erro do
    `cwdPolicy`; o estado derivado segue a §4.1 (testado com eventos e `result.json` falsos, e com o
    processo terminado); `DELETE` mata o terminal e apaga a pasta; `docs/api.md` atualizado;
    `npm run typecheck`/`test`/`lint` limpos.

- [x] **6. Backend — revisão: diff, aceitar, descartar**
  - Ficheiro: `backend/src/imports/workflowGit.ts`, `backend/src/imports/{importService,imports.routes}.ts`,
    `backend/test/workflowGit.test.ts` (repo git temporário criado no teste), `docs/api.md`, `docs/environment.md` (`GIT_BIN`)
  - Skill: —
  - Tier: `opus` (é o único sítio onde a app mexe no git de outro repositório)
  - Aceite quando: num repo temporário com um ficheiro novo, um modificado e um apagado: `diff` devolve os
    três com `change` certo (e `truncated` acima de 200 KB por ficheiro); `accept` faz um commit com
    exatamente esses três caminhos e a mensagem validada (uma mensagem com `\n` ou sem prefixo cai na de
    omissão); um pre-commit hook que falha → `IMPORT_006`, nada staged; `discard` deixa `git status`
    limpo; um caminho na lista que resolva fora do repo (symlink) é recusado; `accept` fora de `review` →
    `IMPORT_005`; depois de aceitar/descartar, a pasta da importação e o evento desaparecem e o terminal
    vai para o histórico; `npm run typecheck`/`test`/`lint` limpos.

- [x] **7. Backend — sai o upload direto (v1)**
  - Ficheiro: `backend/src/library/{library.routes,libraryService,library.schemas}.ts`,
    `backend/src/library/frontmatterEditor.ts` (apagado), `backend/test/{frontmatterEditor,library.upload}.test.ts`
    (apagados), `backend/src/common/errors.ts` (sai `LIBRARY_002`–`005`), `docs/api.md`
  - Skill: —
  - Tier: `sonnet`
  - Aceite quando: `POST /api/library/stacks/:id/skills` → 404; nenhuma referência a `uploadSkill`,
    `frontmatterEditor` ou `LIBRARY_00[2-5]` no `backend/` (grep); `npm run typecheck`/`test`/`lint` limpos.

- [x] **8. Frontend — tipos, serviço, erros**
  - Ficheiro: `frontend/src/types/imports.ts`, `frontend/src/services/importService.ts`,
    `frontend/src/services/libraryService.ts` (sai `uploadSkill`), `frontend/src/errors/errorMessages.ts`
    (entra `IMPORT_001`–`006`, sai `LIBRARY_002`–`005`)
  - Skill: `frontend-error-handling`
  - Tier: `sonnet`
  - Aceite quando: os tipos espelham a §4.3; o serviço envia o multipart com o caminho relativo de cada
    ficheiro (`webkitRelativePath` ou o nome) e cobre todas as rotas da §4.2; mensagens pela ordem do
    backend; `npx tsc -b` e lint limpos.

- [x] **9. Frontend — Importar, faixa, revisão, ver terminal**
  - Ficheiro: `frontend/src/components/library/{ImportDrawer,ImportBanner,ImportReviewDrawer}.tsx`,
    `frontend/src/hooks/useCurrentImport.ts`, `frontend/src/hooks/useLibrary.ts`,
    `frontend/src/pages/LibraryPage.tsx`, `frontend/src/pages/TerminalsPage.tsx`,
    `frontend/src/components/library/UploadSkillDrawer.tsx` (apagado)
  - Skill: `frontend-design-system`, `frontend-error-handling`
  - Tier: `opus` (UX nova — formulário por tipo e o fluxo de revisão)
  - Aceite quando: no browser, com o backend em modo de teste (`claude` falso ou instância de
    `scripts/verify/`): o drawer muda os campos com o tipo e a origem; enviar cria a faixa `running`;
    simular `needs-you` mostra **Ver terminal**, que leva à grelha com esse terminal em foco; simular
    `review` abre a revisão com diff; Aceitar → notificação com o sha e a lista recarrega; Descartar e
    Cancelar pedem confirmação; erro `IMPORT_003` mostrado dentro do drawer; só tokens, nenhum hex novo;
    `npx tsc -b` e lint limpos.

- [x] **10. Docs da app**
  - Ficheiro: `docs/product/use-cases.md`, `docs/architecture.md`, `docs/security.md`, `docs/database.md`
    (`importId`/`hidden` e a pasta `DATA_DIR/imports/`), `docs/code-map.md`, `docs/environment.md`,
    `docs/skills/references/project-vocabulary.md`, `docs/skills/references/design/*` (faixa de estado e
    bloco de diff), `docs/features/upload-de-skills.md` (nota no topo: substituída por esta spec)
  - Skill: —
  - Tier: `sonnet`
  - Aceite quando: nenhum doc diz que a app escreve ficheiros na biblioteca nem fala no "+ Adicionar skill";
    o fluxo de importação está nos casos de uso; os padrões visuais novos estão registados.

- [ ] **11. Verificação ponta a ponta com o Workflow real + fecho**
  - Ficheiro: `notes/verificacao-browser-pendente.md`, `notes/ToDo.md`, `notes/whatIveDone.md`, esta spec §6
  - Skill: `run`
  - Tier: `sonnet`
  - Aceite quando: com o dono a aprovar a escrita no `WORKFLOW_PATH` real, numa instância de
    `scripts/verify/` com o `claude` real: (1) importar um **design de teste** por descrição em texto →
    `review` → diff mostra `library/frontend/themes/<id>/` + registo + provenance → **Descartar** → `git
    status` do Workflow limpo; (2) importar uma skill por URL que a triagem deva recusar (ex. duplicada) →
    `rejected` com o porquê; (3) forçar uma pergunta (pedido de stack com `answers` vazios) → `needs-you` →
    **Ver terminal** → responder → `review` → Descartar; nada fica no Workflow nem em `DATA_DIR/imports/`;
    consola limpa. Aceitar com um commit real só se o dono quiser uma entrada nova de verdade.

## 6. Estado atual

> ⚠️ **Atualizar SEMPRE no fim de cada sessão.** É a secção que torna esta spec retomável.

**Feito:**
- Spec escrita (2026-10-23).
- **Passo 1 — spike (2026-10-25, `claude` 2.1.310)**, `backend/scripts/import-spike.ts`, numa pasta
  temporária com uma skill de teste. **Tudo confirmado à primeira, sem plano B:**
  - (a) `claude --add-dir <d> --session-id <uuid> --settings <f> "/spike-import <caminho>"` corre o slash
    command como primeira mensagem, em modo interativo (`UserPromptSubmit` com esse `prompt` a +2,3 s; resposta
    no `.jsonl` a +7,3 s). **O `--add-dir` é variádico**: vai antes de outra opção, e o prompt fica em último —
    senão era engolido como mais uma pasta.
  - (b) Os hooks de um `--settings` correm com `session_id` (o nosso) e `hook_event_name` no stdin. O `Stop`
    traz também `transcript_path` e **`last_assistant_message`** (útil para a spec [[novo-projeto-guiado]]);
    o `UserPromptSubmit` traz o `prompt`.
  - (c) Com `--add-dir`, o `Read` de um ficheiro dessa pasta não pediu permissão (nenhum `Notification`).
  - (d) Um hook que não imprime nada não atrasa o fim do turno: a mensagem seguinte entrou 600 ms depois do
    `Stop` e teve o seu próprio `Stop`.
  - Achado: no diálogo de confiança de uma pasta nova, a opção por omissão é **"No, exit"** — Enter sai. A
    regra da spec (o `WORKFLOW_PATH` tem de já ser de confiança, senão `TERMINAL_007`) fica justificada.
- **Passo 2 — [[../adr/0019-importar-pelas-skills-do-workflow|ADR 0019]]** (2026-10-25): substitui o 0014 (só o campo Estado do 0014 e a linha do README mudaram); a tabela de argumentos inclui a ordem (`--add-dir` primeiro, prompt em último).
- **Passo 3 — no Workflow** (2026-10-25, commits `2ab86d6` + `1cb3b7b` lá, **sem push**): ADR 0010,
  `docs/import-contract.md` (a cópia única do contrato — a §4.1 desta spec é só a forma inicial; **vale a de
  lá**), `docs/skills/skill-import.md` + ponteiro, "Modo importação" em `skill-add-stack`/`skill-add-new-design`/
  `skill-create-new-skill`, SKILLS-INDEX, catálogo de skills externas aceite, pergunta 2 do `vision.md`
  respondida, linha no `CLAUDE.md`, `.claude/settings.json`. Auditoria do pre-commit: 0 erros.
  **Teste a seco**: o `/import` real, lançado como a app o vai lançar (PTY, `cwd` = Workflow, `--add-dir`,
  hooks), com um design fictício por descrição → `result.json` `done` em **159 s**, triagem completa, contraste
  calculado, **zero pedidos de permissão**, sem commit; escreveu `themes/teste-ambar/{THEME,tokens}.md` + linha
  no registo + `provenance.md`. Descartado à mão (checkout dos 2 + apagar os 2 novos) → `git status` limpo.
- **Passo 4 — terminais escondidos** (2026-10-25): `claudeArgs` com `kind: 'import'` e `addDirs` (pasta
  absoluta, sem controlos/aspas, nunca começada por `-`; `request.json` só em `<…>/<uuid>/request.json`; import
  + Remote Control recusado); `imports/importFiles.ts` (`claude-import-settings.json` + `import-hook.cjs` +
  `readImportEvent`); `state.json` com `importId`/`hidden`/`addDirs`; `TerminalsService.createImport`/`reveal`,
  `list()` sem escondidos, `reopen` de uma importação com as mesmas pastas e sem `/import`. 370 testes (+15),
  `typecheck` só com o erro antigo de `auth.test.ts`, lint limpo. `docs/database.md` e `docs/api.md` atualizados.
- **Passo 5 — `ImportService` e rotas** (2026-10-25): `POST /api/library/imports` (multipart), `GET …/current`,
  `POST …/:id/reveal`, `DELETE …/:id`; `IMPORT_001`–`006`; `GIT_BIN` no config. 396 testes (+26: `stagingFiles`,
  `workflowGit` com um repo real, `importService` com dependências falsas, rotas com a app inteira e o `claude`
  falso). **Chamado por HTTP real** numa instância de `scripts/verify/` (Workflow falso, sem git): `current` →
  `null`, caminho `../` → 400, sem `request` → 400, ficheiros a menos → 400 `IMPORT_004`, válido → 500
  `IMPORT_006` (o `git status` falha, como deve), sem sessão → 401. Docs: `api.md`, `environment.md`,
  `code-map.md`, `backend/.env.example`.
- **Passo 6 — revisão** (2026-10-25): `WorkflowGit.diff`/`commit`/`discard` + `insideRepo` (caminhos do `git
  status` resolvidos com junctions e confirmados no repo); `GET …/diff`, `POST …/accept`, `POST …/discard`, e o
  `DELETE` é o mesmo que o `discard`. 407 testes (+11): repo git real (diff dos 3 tipos, binário, corte > 200 KB,
  commit com exatamente os caminhos, pre-commit que recusa → nada staged, descarte → `git status` limpo e pastas
  novas apagadas, junction para fora recusada) e o fluxo completo pelas rotas. **HTTP real** numa instância com
  `--git-workflow` (opção nova do `scripts/verify/instance.mjs`): aceitar → um commit com os 2 ficheiros e a
  mensagem da skill; descartar → HEAD igual e repo limpo; cancelar a correr → 204.
- **Passo 7 — sai o upload direto** (2026-10-25): rota, `uploadSkill`, `frontmatterEditor.ts`,
  `skillUploadManifestSchema`, `LIBRARY_002`–`005` (fica um comentário "retirados, não se reutilizam") e os
  seus 45 testes; teste novo: `POST /api/library/stacks/:id/skills` → 404. Nenhuma referência no `backend/`
  (grep). 363 testes. `api.md` e `code-map.md` sem o upload. **O frontend ainda chama a rota que saiu**
  (o `UploadSkillDrawer` dá 404 até ao passo 9).
- **Passo 8 — frontend: tipos, serviço, erros** (2026-10-25): `types/imports.ts` (espelho do
  `imports.schemas.ts`), `TerminalView` com `importId`/`hidden`, `services/importService.ts` (todas as rotas;
  `createImport` monta o multipart com `source.paths` pela ordem das partes; `relativePathOf` usa o
  `webkitRelativePath`), `errorMessages.ts` com `IMPORT_001`–`006` e sem `LIBRARY_002`–`005`. `npx tsc -b` e
  lint limpos.
- **Passo 9 — UI** (2026-10-25): `ImportDrawer` (RHF + Zod em `importFormSchema.ts`; O quê/De onde em
  `Segmented`; perguntas de cada tipo por tabela; zona de arrastar com vários ficheiros + "Escolher uma pasta"
  com `webkitdirectory`; "Projeto" num `AutoComplete` com as pastas recentes/favoritas), `ImportBanner` (cor +
  forma por estado: arco/losango/ponto/quadrado/✕, classes `.status-banner.is-*` no `index.css`),
  `ImportReviewDrawer` (Large: resumo, triagem ✓/✕, diff por ficheiro em `Collapse` com `.diff-block`),
  `ImportPanel` (as ações: revelar, aceitar, descartar/cancelar com `useConfirm`), `useCurrentImport` (polling
  3 s só em `running`/`needs-you`), botão **Importar** em todas as tabs (desativado com uma aberta).
  `TerminalsPage` foca o terminal vindo do "Ver terminal" (`location.state.focusTerminalId`). Saíram o
  `UploadSkillDrawer`, o `uploadSkill` e o `addSkill`. **Verificado no browser 32/32** (Chrome headless, instância
  `--git-workflow`, `claude` sem login; o que a skill escreveria escrito à mão): campos por tipo e por origem, URL
  `ftp://` recusado, `IMPORT_003` dentro do drawer, faixa `running` → `needs-you` → `review`, Ver terminal →
  `/terminals` com o terminal visível e o estado de navegação limpo, revisão com triagem e diff colorido, Aceitar →
  notificação com o sha + commit no Workflow + repo limpo, Descartar com confirmação → HEAD igual e repo limpo,
  consola limpa. Capturas vistas (drawer, faixas, revisão, confirmação).
- **Passo 10 — docs** (2026-10-25): `use-cases.md` (o fluxo de importar), `architecture.md`, `database.md`
  (`DATA_DIR/imports/` e `import-events/`), `security.md` (o que o browser pode pedir; os argumentos novos do
  `claude` e o `GIT_BIN`), `code-map.md` (frontend da Biblioteca), `project-vocabulary.md` ("Importação"),
  `design/cards.md` ("Faixa de estado"), `design/drawers-and-modals.md` ("Drawer de revisão com diff" e o exemplo
  de drawer com ficheiros), `design/forms-and-validation.md` (§4.1 a partir do `ImportDrawer`, vários ficheiros e
  pasta), `design/tokens-and-colors.md` (classes `.status-banner`, `.diff-block`), nota de substituída no topo de
  [[upload-de-skills]]. Nenhum doc fora das specs/ADRs fala do upload direto (grep).
**Em curso:** nada.
**Próxima ação concreta:** passo 11 — **precisa do dono** (ver §7): a verificação ponta a ponta com o `claude` real
e o Workflow real.
**Desvios ao plano:**
- A allowlist do Workflow tem mais do que o passo 3 listava: `WebSearch`, `node tools/dry-run.mjs` (o teste a
  seco das stacks) e o `cp -r` dos dois moldes `_TEMPLATE` (o `/add-stack` e o `/add-new-design` copiam-nos).
  Ficou no ADR 0010 do Workflow.
- O `.claude/settings.local.json` do Workflow **nesta máquina** permite `git commit`/`git push` (é do dono, não
  versionado). O `/import` diz para nunca fazer commit, e o teste a seco não fez — mas a proteção é a skill,
  não as permissões.
- Passo 4: o terminal guardado ganhou também **`addDirs`** (a spec só tinha `importId`/`hidden`) — sem ele, um
  terminal de importação reaberto perdia as pastas. `botActions.ts` **não** mudou: usa `list()`, que já filtra.
  O `ClaudeLaunch` de importação chama-se `kind: 'import'` (a spec do novo projeto prevê generalizá-lo).
  O comando da status line saiu para `statusLineSetting()` em `usageFiles.ts`, partilhado pelos dois `--settings`.
- Passo 5: os caminhos relativos dos ficheiros vão **dentro do JSON** (`source.paths`, pela ordem das partes
  `files`) — não no `filename` das partes, que o busboy reduz ao nome base por omissão. A `ImportView` ganhou
  **`error`** (porque falhou, também sem `result.json`). `done` sem alterações no Workflow → `failed` ("a skill
  disse que escreveu, mas o Workflow não tem alterações"); `rejected` com alterações (o descarte no
  `provenance.md`) → `review`. A rota `reveal` e o `workflowGit.ts` (só `changes()`) entraram já no passo 5. As
  validações do pedido correm antes do `git status` (achado na chamada HTTP real: ficheiros a menos davam
  `IMPORT_006` em vez de `IMPORT_004`).
- Passo 6: **Descartar e Cancelar são a mesma operação** (o `POST …/discard` e o `DELETE`), em qualquer estado —
  fechar o terminal primeiro, depois repor. Um commit recusado deixa a importação em `review` (o dono corrige e
  tenta de novo, ou descarta). O `--git-workflow` do `instance.mjs` não estava na spec; vai servir aos passos 9 e 11.
- Passo 8: o `uploadSkill` do `libraryService.ts` saiu no passo 9, com o `UploadSkillDrawer`, que era quem o usava
  (tirá-lo antes partia o `tsc -b`).
- Passo 9: entrou um `ImportPanel` (a spec só tinha banner + review) para as ações não viverem na página. O
  **resumo da skill aparece como texto** (`whitespace-pre-wrap`), não Markdown renderizado — a app ainda não tem
  renderizador; o `react-markdown` chega com a spec [[novo-projeto-guiado]] e pode servir aqui depois. O diff
  começa no primeiro `@@` (o cabeçalho do `git diff` é ruído) e um ficheiro que o git marca sem diferenças de
  conteúdo (fins de linha CRLF/LF com `core.autocrlf`, visto nas capturas) diz isso em vez de mostrar uma caixa
  vazia. O foco do "Ver terminal" ficou **dentro do efeito de seeding** da `TerminalsPage` (a página monta de novo
  ao navegar): um efeito próprio caía na regra `react-hooks/set-state-in-effect`; a lógica de layout saiu para
  `focusedLayout()`, partilhada com o `focusTerminal`.
**O que uma sessão nova precisa de saber:**
- A lógica da importação vive **no Workflow** (skill `/import`), por pedido explícito do dono. Se uma
  sessão se apanhar a escrever validação de `STACK.md`/`THEME.md` no backend da app, está a sair da spec.
- O terminal da importação é um terminal normal com `hidden: true` — não um mecanismo à parte.
- A app só escreve dentro de `DATA_DIR/imports/`; no Workflow só corre `git add/commit/checkout` e apaga
  ficheiros novos, **sempre a pedido do dono** (Aceitar/Descartar/Cancelar) e com o repo limpo à partida.
- A verificação com o Workflow real limpa o que escreveu, como na spec [[upload-de-skills]].

## 7. Perguntas em aberto

| Pergunta | Bloqueia | Notas |
|---|---|---|
| O prompt inicial posicional corre slash commands no modo interativo? | Passo 4 (mecanismo) | Spike, passo 1. Plano B já decidido (escrever no PTY) |
| A allowlist chega para as três skills sem nenhum pedido de permissão? | Não — o fallback é revelar o terminal | Afinar no teste a seco do passo 3; o que faltar e for seguro entra na allowlist |
| `kind: auto` classifica bem uma pasta mista (ex. um projeto inteiro)? | Não | Se o `/import` não souber, pergunta — e a app revela o terminal |
| Os 10 MiB chegam para um handoff do Claude Design com screenshots? | Não | Constante fácil de mudar; medir com um handoff real no passo 11 |

## Relacionado

[[skill-plan-feature]] · [[skill-implement-todo]] · [[../adr/README]] · [[upload-de-skills]] ·
[[../adr/0005-biblioteca-lida-do-disco]] · [[../adr/0014-escrita-controlada-biblioteca]] ·
[[../adr/0012-argumentos-do-claude-e-status-line]] · [[../product/use-cases]]
