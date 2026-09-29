# Feature: Separadores de projetos

| | |
|---|---|
| **Estado** | 🚧 Em curso — falta só a verificação manual no browser do passo 8 |
| **Criada** | 2026-09-28 |
| **Última sessão** | 2026-09-28 |
| **Passos** | 7 / 8 concluídos |

> Escrita para uma sessão que **não viu a conversa que a originou**. Se algo só faz sentido com contexto
> externo, falta escrevê-lo.

Reescreve a navegação da página **Terminais** (já ✅ em [[terminais]]) para ser **por projeto**: a lateral
deixa de listar terminais soltos e passa a listar **projetos** (do registo do Workflow,
`projects/INDEX.md`); cada projeto aberto ganha um **separador tipo browser**; dentro de um separador
mantém-se o foco dividido/grelha de hoje, mas só com os terminais desse projeto — nunca misturados com
os de outro. Nasceu da ideia "Painel de projetos + Adicionar projeto" em `notes/ideas.md`, com a forma
concreta (separadores) pedida pelo dono a 2026-09-28.

---

## 1. O que é e porquê

Hoje, para abrir um projeto que já está no registo do Workflow (`projects/INDEX.md`), é preciso passar
pelo drawer "Novo terminal" e escolher a pasta à mão — a app não sabe que projetos existem, só pastas. E
com vários projetos abertos ao mesmo tempo, a lateral atual (agrupada por pasta, spec [[terminais]] §3)
mistura tudo numa lista só, sem separação forte entre o que pertence a um projeto e a outro. O dono quer
trabalhar **um projeto de cada vez, com um separador próprio**, como abas de um browser, e usar a lateral
só para navegar entre projetos e abrir novos a partir do que o Workflow já conhece.

**Como sei que está bem feito:** abro a app e vejo logo um separador por cada projeto que já tinha
terminais; clico noutro projeto na lateral — se ainda não tinha terminal, abre-se-me logo um `claude` a
correr nessa pasta e ganho um separador novo; troco entre separadores e o que vejo (foco dividido ou
grelha, terminal em foco, `Alt+1…9`) nunca mistura com o separador de outro projeto; "fecho" um separador
com terminais a correr, eles continuam vivos, e clicar o projeto outra vez na lateral devolve-me
exatamente onde estava.

## 2. Âmbito

### Dentro
- **Backend — registo de projetos**: ler `WORKFLOW_PATH/projects/INDEX.md` (tabela Markdown do Workflow,
  só leitura — mesmo padrão do módulo `library`, [[../adr/0005-biblioteca-lida-do-disco|ADR 0005]]) e
  devolver os projetos com caminho válido dentro de `ALLOWED_ROOTS`. `GET /api/projects` novo.
- **Projetos escondidos**: Estado `descartado` no registo, caminho fora de `ALLOWED_ROOTS`, caminho que
  não existe no disco — nunca aparecem no painel (mesma regra das pastas favoritas/recentes fora das
  raízes, já usada no `FolderPicker`).
- **Lateral (`TerminalSidebar`) redesenhada**: lista os projetos — os do registo **e** qualquer projeto
  com terminais que não esteja (ou já não esteja) no registo, para nunca perder um terminal existente.
  Sem "+ Novo terminal" solto. Clicar um projeto **sem** terminais abre-lhe logo um terminal novo
  (`mode: 'new'`) e ganha separador; clicar um projeto **com** terminais abre/foca o separador dele. O
  "+" por projeto (já existe) continua a abrir mais um terminal nesse projeto; a estrela de favorito
  mantém-se.
- **Separadores de projeto (`ProjectTabs`)**: uma faixa por cima da área principal, um separador por
  projeto aberto, pela ordem em que foram abertos (sessão atual — não sobrevive a recarregar); "fechar"
  (×) só **esconde** o separador — os terminais desse projeto continuam a correr; reabre-se clicando o
  projeto na lateral.
- **Ao carregar/recarregar a página**: abre logo um separador para cada projeto que já tem terminais
  (`running`/`exited`/`stopped`) — a experiência de hoje, sem clique extra.
- **Isolamento entre projetos**: dentro de um separador mantém-se o foco dividido/grelha atuais
  ([[terminais]] §3), mas só com os terminais **desse** projeto. `Alt+1…9` salta só entre os terminais do
  projeto ativo. O estado de foco/split/ampliado de cada projeto fica à parte — trocar de separador e
  voltar mostra o projeto tal como foi deixado, e nunca mostra nem deixa interagir com terminais de outro
  projeto ao mesmo tempo.

### ⛔ Fora — não implementar nesta feature
- **Adotar uma pasta existente que o Workflow não conhece**, e **"Novo projeto"** com `/create` já
  lançado (casos 2 e 3 da ideia original, `notes/ideas.md` → "Painel de projetos"). Precisam de um ADR
  novo (`intent: 'create' | 'adopt'` → argumento fixo, complementa o
  [[../adr/0004-exposicao-e-modelo-de-ameaca|ADR 0004]]) — fora desta spec.
- **Atalho de teclado para trocar de separador/projeto** — só clique nesta versão.
- **Reordenar separadores à mão**, fixá-los, ou a ordem sobreviver a recarregar.
- **A app escrever no `projects/INDEX.md`** — continua só leitura ([[../adr/0005-biblioteca-lida-do-disco|ADR 0005]]); quem escreve é o `/create`/`/adopt-project` do Workflow, pelos terminais.
- **Mostrar projetos `descartado`** ou fora de `ALLOWED_ROOTS`, mesmo desativados — ficam escondidos.

> Esta lista impede uma sessão futura de expandir o âmbito sozinha.

### Segunda fase (se houver)
- Casos 2/3 de "Adicionar projeto" (adotar pasta existente, criar projeto novo) + ADR do `intent`.
- Atalho de teclado para trocar de projeto.
- Persistir quais separadores estavam abertos entre sessões (hoje: recalculado dos terminais existentes).

## 3. Decisões tomadas

| Decisão | Escolha | Porquê | Alternativa rejeitada |
|---|---|---|---|
| Fonte dos projetos | Ler `WORKFLOW_PATH/projects/INDEX.md`, uma tabela Markdown para humanos (sem frontmatter) | É o único registo que existe no Workflow para projetos (ao contrário de stacks/skills, que têm manifesto — [[../adr/0005-biblioteca-lida-do-disco|ADR 0005]]); não há alternativa estruturada | Pedir ao Workflow um manifesto novo por projeto — muda o Workflow, fora do controlo desta app |
| Robustez do parser | Tolerante: linha mal formada salta-se (nunca falha o pedido), ficheiro em falta/sem "Pasta base" → lista vazia | Mesmo padrão de tolerância da Biblioteca a manifestos inválidos | Falhar o pedido com 500/400 |
| Projetos escondidos | `descartado`, fora de `ALLOWED_ROOTS`, caminho inexistente | Mesma regra já usada nas pastas favoritas/recentes fora das raízes | Mostrar desativados |
| Dentro de um separador | Mantém-se foco dividido/grelha de hoje, só com os terminais do projeto | Reaproveita a spec [[terminais]] inteira (Definições, `Alt+\`, grelha) em vez de inventar uma navegação nova | Um terminal de cada vez dentro do separador (sem split/grelha) |
| `Alt+1…9` | Salta só entre os terminais do **projeto ativo** | Pedido explícito do dono: nunca misturar terminais de projetos diferentes | Continuar global (salta todos os terminais de todos os projetos) |
| Fechar um separador | Só esconde — os terminais continuam a correr; reabre-se clicando o projeto na lateral | O dono não quer matar trabalho ao trocar de foco, e a lateral já lista o projeto na mesma | Fechar (matar) os terminais do projeto, como o "Fechar" de um terminal |
| Separadores ao carregar a página | Abre logo um por cada projeto com terminais existentes | Mantém a experiência de hoje (entrar e já ver tudo); nenhum estado novo a persistir — deriva-se dos terminais já gravados | Começar sem nenhum separador aberto |
| Ordem dos separadores | Pela ordem em que foram abertos nesta sessão; não sobrevive a recarregar | Como abas de browser; simples, sem estado novo a persistir | Alfabética |
| Clicar um projeto do registo sem terminais | Abre logo um terminal novo (`mode: 'new'`), sem drawer extra | Pedido do dono: "se possível abre um terminal com o claude iniciado" — um clique, sem passos a mais | Abrir o separador vazio primeiro, com um botão "+ Terminal" lá dentro |
| `Estado: descartado` no registo | Escondido | Evita abrir um terminal num projeto morto por engano | Mostrar a cinzento/desativado |

**ADRs gerados:** nenhum (a leitura da tabela é uma escolha de parser, registada acima com o porquê — não
muda nenhuma decisão estrutural já tomada). O ADR de `intent → argumento fixo` fica para a segunda fase.

## 4. Desenho técnico

### 4.1 Dados

Sem novidade em `backend/src/state/state.schema.ts` nem em `state.json`
([[../database]], [[../adr/0009-estado-em-ficheiro-json|ADR 0009]]). Novo: leitura só-leitura de
`WORKFLOW_PATH/projects/INDEX.md`, recalculada a cada pedido — nada persistido.

Formato real do ficheiro (confirmado a 2026-09-28): uma frase `Pasta base: \`<caminho>\`` antes da tabela,
e uma tabela `| Projeto | Caminho (relativo à base) | Tipo | Stack (resumo) | Entrada | Vault | Estado |`.
O caminho absoluto de um projeto = `join(pasta base, caminho relativo)`, depois `resolveAllowedPath`
(`backend/src/folders/cwdPolicy.ts`, já existe) contra `ALLOWED_ROOTS` — falha (fora das raízes, não
existe) → o projeto sai da lista, não é erro.

Estado novo só no **frontend**, em memória de componente (não `localStorage`, não sobrevive a
recarregar):
- `openProjectPaths: string[]` — separadores abertos, pela ordem de abertura.
- `activeProjectPath: string | null` — o separador em foco.
- Por projeto, o que hoje é estado único da página (`selectedId`, `splitId`, `enlargedId`, `activeId`) —
  um `Map<string, ProjectLayoutState>`, para trocar de separador sem perder nem misturar o foco/split de
  cada um.

### 4.2 Endpoints

| Método | Rota | Corpo / query | Resposta | Erros |
|---|---|---|---|---|
| GET | `/api/projects` | — | `ProjectEntry[]` (registo, filtrado — sem `descartado`, sem os fora de `ALLOWED_ROOTS`) | — (sem `projects/INDEX.md` ou sem "Pasta base" → `[]`, nunca 500) |

Requer sessão (`AUTH_002` sem ela), como o resto da API.

### 4.3 Tipos / DTOs

```ts
// backend/src/projects/project.schemas.ts  ↔  frontend/src/types/project.ts
type ProjectEntry = {
  name: string;
  path: string;          // absoluto, resolveAllowedPath já aplicado
  type: string | null;   // "meu" | "gerado" | "adotado" | null (coluna livre no registo)
  stack: string | null;
  status: string | null; // "ativo" | "—" | … (nunca "descartado", já filtrado)
};
```

### 4.4 Interface

- **Onde vive**: continua a rota `/terminals` — não é um ecrã novo, é a mesma página reestruturada.
- **Como se chega lá**: igual a hoje (item "Terminais" na navegação).
- **Ficheiros**:
  - **Backend (novo)**: `backend/src/projects/{project.schemas.ts,projectIndexParser.ts,projectsService.ts,projects.routes.ts}`, `backend/test/{projectIndexParser,projects.routes}.test.ts`.
  - **Frontend (novo)**: `frontend/src/types/project.ts`, `services/projectService.ts`, `hooks/useProjects.ts`, `components/terminals/ProjectTabs.tsx`.
  - **Frontend (reescrito)**: `pages/TerminalsPage.tsx` (estado por projeto, isolamento), `components/terminals/TerminalSidebar.tsx` (lista de projetos, sem "+ Novo terminal" solto), `components/terminals/projects.ts` (junta registo + terminais existentes; funções de agrupamento scoped ao projeto ativo).
  - **Frontend (sem mudança de contrato)**: `hooks/useTerminalShortcuts.ts` (o `type: 'jump'` mantém-se; só muda **quem** o `TerminalsPage` indexa — os terminais do projeto ativo, não todos), `components/terminals/{TerminalPane,TerminalGrid}.tsx` (recebem só os terminais do projeto ativo, como hoje recebem `ordered`/`visibleIds`).
- **Estado vazio**: sem nenhum projeto (registo vazio e sem terminais) → lateral com "Nenhum projeto encontrado" + uma linha a apontar para `WORKFLOW_PATH`/`ALLOWED_ROOTS`; sem separador aberto, área principal em branco (sem o botão "+ Novo terminal" de hoje, que sai do âmbito).
- **Visibilidade por role**: não há roles ([[../adr/0003-auth-utilizador-unico]]).
- **Visual**: sem protótipo do Claude Design para separadores tipo browser (o handoff de 2026-09-27 só cobre foco/dividido/grelha) — desenhar só com os tokens ([[../skills/references/design/tokens-and-colors]]), e **registar o padrão novo** em `design/` no passo 8, como qualquer padrão visual inédito.

### 4.5 Códigos de erro novos

Nenhum. `GET /api/projects` nunca falha por dados do registo (tolerante, ver §3); os erros de criar
terminal continuam os `TERMINAL_*`/`FOLDER_001` já existentes ([[terminais]] §4.5).

## 5. Passos

Ordem obrigatória. Tiers: `opus` (desenho, não delegar) · `sonnet` (implementação) · `haiku` (mecânico).
**Regra 8 do `CLAUDE.md`**: nunca editar o backend a partir de um terminal servido por ele em `npm run dev`.

- [x] **1. Parser do `projects/INDEX.md`** — ✅ 2026-09-28 (6 testes)
  - Ficheiro: `backend/src/projects/projectIndexParser.ts`, `backend/test/projectIndexParser.test.ts` (fixture com uma cópia do `INDEX.md` real: linhas válidas, uma `descartado`, uma linha sem caminho, ficheiro sem "Pasta base", sem tabela, vazio)
  - Skill: —
  - Tier: `sonnet`
  - Aceite quando: extrai a "Pasta base" e as linhas da tabela; devolve caminho absoluto por linha (`node:path.win32.join`, os caminhos do registo são sempre estilo Windows); nunca lança (linha mal formada salta-se, ficheiro sem tabela → `[]`).
  - **Decisão ao implementar**: `descartado` **não** é filtrado aqui — o parser só lê o que está na página (devolve a linha com `status: "descartado (2026-09-06)"` tal como escrita); o passo 2 (`ProjectsService`) é que decide esconder. Mantém o parser de responsabilidade única.

- [x] **2. `ProjectsService`, rota `GET /api/projects` e docs** — ✅ 2026-09-28 (4 testes)
  - Ficheiro: `backend/src/projects/{project.schemas.ts,projectsService.ts,projects.routes.ts}`, `backend/test/projects.routes.test.ts`; `docs/api.md`, `docs/code-map.md`
  - Skill: —
  - Tier: `sonnet`
  - Aceite quando: `GET /api/projects` (com sessão) devolve só projetos cujo caminho resolve dentro de `ALLOWED_ROOTS` via `resolveAllowedPath` (`backend/src/folders/cwdPolicy.ts`); sem `projects/INDEX.md` → `[]`/200; testado com `app.inject`; `api.md`/`code-map.md` atualizados no mesmo commit ([[../backend-conventions]]).

- [x] **3. Frontend: tipos, serviço, hook** — ✅ 2026-09-28
  - Ficheiro: `frontend/src/types/project.ts`, `frontend/src/services/projectService.ts`, `frontend/src/hooks/useProjects.ts`
  - Skill: `frontend-design-system`
  - Tier: `sonnet`
  - Aceite quando: `useProjects` busca a lista uma vez e expõe `refresh`; `npx tsc -b` e lint limpos.

- [x] **4. `components/terminals/projects.ts` — juntar registo + terminais existentes** — ✅ 2026-09-28
  - Ficheiro: `frontend/src/components/terminals/projects.ts` (reescrito)
  - Skill: `frontend-design-system`
  - Tier: `opus` (a lógica de junção decide o resto da página — um erro aqui propaga a todos os passos seguintes)
  - Aceite quando: junta `ProjectEntry[]` (registo) com os terminais existentes por `cwd`; um projeto do registo sem terminal aparece como "por abrir"; um terminal cujo projeto saiu do registo (ou nunca lá esteve) não desaparece; devolve também os "abertos" (com terminais) para inicializar `openProjectPaths` no passo 7.
  - **Decisão ao implementar**: `joinProjects` devolve `Project[]` com `registry: ProjectEntry | null` em vez de dois tipos separados — um projeto é sempre um só, com ou sem registo; `projectsWithTerminals()` é a função que dá os "abertos" ao passo 7.

- [x] **5. `ProjectTabs` — separadores tipo browser** — ✅ 2026-09-28
  - Ficheiro: `frontend/src/components/terminals/ProjectTabs.tsx`
  - Skill: `frontend-design-system`
  - Tier: `sonnet`
  - Aceite quando: um separador por `openProjectPaths`, pela ordem de abertura; nome do projeto, indicação de estado (ex.: quantos a correr), × que chama `onClose` (esconder, não mata); separador ativo destacado; só tokens, nenhum hex novo.

- [x] **6. `TerminalSidebar` — lista de projetos** — ✅ 2026-09-28 (verificação no browser feita no passo 8, junto com o resto da página)
  - Ficheiro: `frontend/src/components/terminals/TerminalSidebar.tsx` (reescrito)
  - Skill: `frontend-design-system`, `frontend-error-handling`
  - Tier: `opus` (mexe na navegação principal da página)
  - Aceite quando: no browser — sem "+ Novo terminal" solto; clicar um projeto do registo sem terminais cria um terminal `claude` real (`mode: 'new'`) e abre/foca o separador; clicar um projeto com terminais reabre o separador tal como ficou; `descartado`/fora de `ALLOWED_ROOTS` não aparecem (já vêm filtrados do backend); estrela de favorito continua a marcar/desmarcar; "+" por projeto continua a abrir mais um terminal nesse projeto.
  - **Decisão ao implementar (pergunta ao dono, 2026-09-28)**: sem o botão global, abrir um terminal numa pasta **fora** do registo do Workflow fica sem interface nesta v1 (volta com os casos "adotar"/"criar", §2 "Segunda fase") — o dono não escolheu entre as duas opções propostas e pediu para seguir com a recomendada.

- [x] **7. `TerminalsPage` — estado por projeto e isolamento** — ✅ 2026-09-28
  - Ficheiro: `frontend/src/pages/TerminalsPage.tsx` (reescrito), `frontend/src/hooks/useTerminalShortcuts.ts` (sem mudar o contrato — só quem o consome)
  - Skill: `frontend-design-system`
  - Tier: `opus` (é o coração da spec [[terminais]] original, reescrito — o sítio onde um erro mistura terminais de projetos diferentes, o risco que o dono pediu explicitamente para evitar)
  - Aceite quando: no browser, com dois projetos e 2 terminais cada — foco dividido/grelha num separador nunca mostra nem deixa focar terminais do outro; `Alt+1…9` só salta os do separador ativo; `Alt+\` divide dentro do projeto ativo sem tocar no outro; esconder um separador com terminais a correr não os mata (continuam "a correr" quando se volta a esse projeto); Definições (grelha/foco dividido) continua a funcionar por separador; ao carregar a página, abre logo um separador por cada projeto com terminais existentes.
  - **Decisões ao implementar**:
    - O estado de foco/split/ampliado por projeto vive num `Record<path, ProjectLayout>` (não um `Map` — mais simples com `useState`); `layoutFor`/`updateLayout` leem/escrevem por caminho.
    - Todos os terminais (de todos os projetos) continuam **sempre montados** no mesmo container (grelha ou foco, conforme o modo), só a classe `hidden` muda — o mesmo truque que já existia para "fora do ecrã"; troca de separador nunca desmonta xterm.js/WebSocket. Trocar entre foco dividido ↔ grelha continua a remontar tudo, como já acontecia antes desta spec (são duas árvores React diferentes).
    - `Alt+N` (novo terminal) passa a abrir mais um terminal **no projeto ativo** em vez do drawer global (que já não tem para onde apontar sem o botão do topo).
    - Reabrir (um ou "todos") não muda o separador ativo — replica o comportamento de antes desta spec, que também não mudava a seleção ao reabrir.
    - `paneSize` ganhou um parâmetro `split: boolean` (a estimativa de largura da PTY); um terminal criado/reaberto começa sempre sem split (a `FitAddon` corrige o tamanho real a seguir, como já acontecia).
  - **Verificação no browser**: feita no passo 8, para os dois passos (6 e 7) juntos — mexem na mesma árvore de componentes.

- [ ] **8. Verificação ponta a ponta + fecho**
  - Ficheiro: `docs/product/use-cases.md` (ecrã Terminais → mencionar separadores por projeto), `docs/skills/references/design/*` (se houver padrão visual novo a registar dos separadores), `docs/features/terminais.md` (§ Relacionado — acrescentar link para esta spec, edição pontual, sem reescrever o histórico), `notes/ToDo.md`, `notes/whatIveDone.md`
  - Skill: `run`
  - Tier: `sonnet`
  - Aceite quando: no browser, com o `claude` real — dois projetos, separadores, troca sem perder nem misturar estado, esconder/reabrir um separador, recarregar a página mantém os separadores dos projetos com terminais; docs atualizados; plano e work log fechados.
  - **Feito nesta sessão (2026-09-28)**: automático — 172 testes do backend a passar, `tsc -b`/lint do
    frontend limpos, `typecheck`/lint do backend limpos (erro pré-existente em `test/auth.test.ts`, sem
    relação); app a correr via `/run`, health checks OK; docs atualizados (`use-cases.md`,
    `terminais.md` § Relacionado, `design/browser-tabs.md` — padrão novo registado).
  - **Por fazer**: a extensão do Chrome (`claude-in-chrome`) não respondeu (`"No group with id"`, 5
    tentativas, incluindo com o Chrome já aberto) — e a verificação real precisa de qualquer forma do
    login com a password verdadeira, que só o dono tem. Checklist completo em
    `notes/verificacao-browser-pendente.md` → "spec `separadores-de-projetos`, passo 8". Adiada, não
    dispensada.

## 6. Estado atual

> ⚠️ **Atualizar SEMPRE no fim de cada sessão.** É a secção que torna esta spec retomável.

**Feito:**
- Passos 1-7 (parser, `ProjectsService`/rota, tipos/serviço/hook do frontend, `joinProjects`, `ProjectTabs`,
  `TerminalSidebar` e `TerminalsPage` reescritos) — ver as notas "Decisão ao implementar" de cada passo na
  secção 5. 172 testes do backend a passar, `tsc -b`/lint do frontend limpos, `typecheck`/lint do backend
  limpos (o único erro é pré-existente em `test/auth.test.ts`, sem relação com esta spec).
- Passo 8 (parte automática) — docs atualizados (`docs/product/use-cases.md`, `docs/features/terminais.md`
  § Relacionado, `docs/skills/references/design/browser-tabs.md` — padrão novo registado e ligado em
  `frontend-visual-consistency.md`).
**Em curso:** passo 8 — falta a verificação manual no browser (dois projetos, separadores, troca sem
misturar estado, esconder/reabrir, recarregar a página).
**Próxima ação concreta:** correr o checklist de `notes/verificacao-browser-pendente.md` → "spec
`separadores-de-projetos`, passo 8" (precisa do dono: extensão do Chrome sem responder nesta sessão, e o
login real precisa da password verdadeira de qualquer forma). Feito isso, marcar o passo 8 `[x]` e o Estado
da spec como "✅ Concluída".
**Desvios ao plano:** a secção 6 tinha ficado desatualizada numa sessão anterior (dizia só os passos 1-2
feitos, quando o código já tinha os passos 3-7) — corrigido nesta sessão.
**O que uma sessão nova precisa de saber:**
- O `projects/INDEX.md` real está em `C:\Users\jlalv\Desktop\Workflow\Workflow\projects\INDEX.md`
  (`WORKFLOW_PATH` do `.env`); a "Pasta base" declarada lá dentro (`C:\Users\jlalv\Desktop\utad\projetos\`)
  já está dentro de `ALLOWED_ROOTS` desta máquina — não precisa de nenhuma variável de ambiente nova.
- Isto **reescreve** a interface da spec [[terminais]] (já ✅ concluída) — não a edita: os ficheiros lá
  descritos (`TerminalSidebar`, `TerminalsPage`, `useTerminalShortcuts`) mudam de comportamento, mas as
  decisões da spec antiga sobre o motor (PTY, scrollback, quota, `--session-id`/`--resume`) continuam
  válidas e não se repetem aqui.
- Casos "adotar pasta existente" e "criar projeto novo com `/create`" ficam de fora desta spec de
  propósito (§2) — não os implementar mesmo que pareçam pequenos; precisam de ADR novo primeiro.

## 7. Perguntas em aberto

| Pergunta | Bloqueia | Notas |
|---|---|---|
| Atalho de teclado para trocar de projeto (só clique nesta v1) — vale a pena um no futuro? | Não bloqueia — decisão de 2ª fase | Perguntar ao dono quando a v1 estiver em uso |
| Forma visual exata dos separadores (sem protótipo do Claude Design) | Não bloqueia — desenha-se com os tokens no passo 5 | Registar o padrão novo em `design/` no passo 8 |

## Relacionado

[[skill-plan-feature]] · [[skill-implement-todo]] · [[../adr/README]] · [[terminais]] ·
[[../adr/0005-biblioteca-lida-do-disco]] · [[../adr/0004-exposicao-e-modelo-de-ameaca]] ·
[[../../notes/ideas]] → "Painel de projetos + Adicionar projeto"
