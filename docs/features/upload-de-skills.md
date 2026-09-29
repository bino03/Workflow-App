# Feature: Upload de skills para a biblioteca do Workflow

| | |
|---|---|
| **Estado** | 📋 Planeada |
| **Criada** | 2026-09-29 |
| **Última sessão** | 2026-09-29 |
| **Passos** | 0 / 6 concluídos |

> Escrita para uma sessão que **não viu a conversa que a originou**. Se algo só faz sentido com contexto
> externo, falta escrevê-lo.

Nasceu do pedido "algo que me permitisse dar upload de skills, designs e stacks, que deve ir para o vault
e por sua vez aparecer na app" (conversa de 2026-09-29). Refinado numa entrevista com o dono na mesma
conversa — o âmbito ficou reduzido a **só skills** (ver §2), porque stacks e designs são pastas com vários
ficheiros obrigatórios (§3), enquanto uma skill é um único ficheiro.

---

## 1. O que é e porquê

Hoje o ecrã **Biblioteca** ([[../product/use-cases]], [[../adr/0005-biblioteca-lida-do-disco|ADR 0005]]) só
lê `WORKFLOW_PATH/library` — para acrescentar uma skill nova a uma stack, o dono tem de abrir um terminal,
lançar o Claude Code na pasta do Workflow e escrever o ficheiro à mão (ou pedir a uma sessão para o fazer).
O dono quer arrastar um ficheiro `skill-*.md` já escrito para a app e vê-lo aparecer na stack certa da
Biblioteca, sem abrir o Obsidian nem um terminal no Workflow.

Isto **reverte parcialmente a [[../adr/0005-biblioteca-lida-do-disco|ADR 0005]]** ("nunca escreve" —
que já previa este dia: "Se um dia a app escrever diretamente, ADR novo"). O novo ADR (passo 1) abre uma
única porta de escrita, estreita e validada: um ficheiro `skill-*.md` dentro de `stacks/<id>/skills/` de
uma stack que já existe, mais o campo `provides-skills` do `STACK.md` dessa stack. Nada mais no
`WORKFLOW_PATH` fica escrevível pela app.

**Como sei que está bem feito:** na Biblioteca, tab Skills, clico "+ Adicionar skill", escolho uma stack
existente (ex.: `react-vite-antd`), arrasto um `skill-nova-coisa.md` válido para a zona de upload e clico
"Enviar" — a skill aparece na lista sem recarregar a página, o ficheiro existe em
`WORKFLOW_PATH/library/stacks/react-vite-antd/skills/skill-nova-coisa.md`, e o `provides-skills` do
`STACK.md` dessa stack passa a incluir `nova-coisa`. Se o ficheiro tem um frontmatter inválido, ou já
existe uma skill com esse nome nessa stack, ou a stack escolhida não existe, o drawer mostra o erro exato
e **nada é escrito no disco**.

## 2. Âmbito

### Dentro
- **Só skills** — um único ficheiro `skill-<nome>.md`, sempre associado a uma **stack já existente** na
  biblioteca (`stacks/<id>/skills/skill-<nome>.md`). Escolhida na entrevista de 2026-09-29 porque é o caso
  real mais comum (todas as skills reutilizáveis vistas na biblioteca do Workflow vivem dentro de uma
  stack) e o mais simples (um ficheiro, o schema zod de leitura já existe —
  `backend/src/library/library.schemas.ts` → `skillManifestSchema`).
- **Mecanismo**: arrastar (ou escolher por clique) **um** ficheiro `.md` — sem zip, sem pasta. Um upload de
  multipart de um único campo de ficheiro.
- **Validação antes de escrever**: o frontmatter tem de ter um bloco `--- … ---` que faz `parse` com
  sucesso no `skillManifestSchema` **e** o campo `name` tem de ser kebab-case (mesma convenção já usada
  nas skills reais da biblioteca do Workflow: o `name` do frontmatter é o mesmo texto que aparece depois
  de `skill-` no nome do ficheiro, ex. `name: create-new-skill` em `skill-create-new-skill.md`). Um erro em
  qualquer um destes → nada escrito, erro devolvido com o que falha.
- **Nome do ficheiro final decidido pelo backend**, nunca pelo nome do ficheiro arrastado: sempre
  `skill-<name>.md`, onde `<name>` vem do frontmatter já validado (kebab-case). Evita confiar num nome de
  ficheiro vindo do cliente.
- **Colisão de nome**: se `stacks/<stackId>/skills/skill-<name>.md` já existe, o upload é recusado — nunca
  sobrescreve. O dono apaga ou edita à mão primeiro se quiser substituir (decidido na entrevista: a
  biblioteca é partilhada por todos os projetos gerados pelo Workflow, um overwrite por engano estraga uma
  stack já `proven`).
- **`STACK.md` da stack de destino ganha o nome novo em `provides-skills`** (edição pontual e
  determinística do frontmatter — nunca do resto do ficheiro), para a lista "Skills" da stack no ecrã
  Biblioteca (`StackEntry.providesSkills`, já lido hoje) ficar correta sem passo manual.
- **Limite de tamanho do ficheiro**: 256 KiB (constante no código, não variável de ambiente — não há razão
  para um dono afinar isto; uma skill real tem poucos KB). Ficheiro vazio ou maior → recusado.
- **A skill aparece na Biblioteca sem recarregar a página** — a lista de skills atualiza-se com a entrada
  devolvida pelo próprio pedido de upload (sem um segundo pedido `GET /api/library/skills`).

### ⛔ Fora — não implementar nesta feature
- **Upload de stacks ou designs completos** (pastas com vários ficheiros obrigatórios —
  `STACK.md`/`conventions.md`/`structure.md`/`commands.md`/`pitfalls.md`, ou `THEME.md`/`tokens.md`).
  Decidido na entrevista: são módulos multi-ficheiro, mais casos-limite (ficheiros em falta, validação de
  completude) do que uma versão inicial justifica.
- **Skills "soltas"**, sem stack (`library/skills/<categoria>/skill-*.md`). O formulário desta v1 exige
  sempre escolher uma stack existente.
- **Substituir (overwrite) uma skill já existente pela app.** Colisão de nome é sempre recusada (ver
  acima); editar ou apagar uma skill já existente na biblioteca continua a fazer-se pelos terminais.
- **Atualizar `library/stacks/README.md`** (a tabela "Registo" com a coluna "Skills") ou qualquer outro
  ficheiro de prosa/registo do Workflow. Só o `STACK.md` da stack de destino (campo `provides-skills`) é
  editado — o resto fica desatualizado até o dono o editar à mão. Documentado como limitação conhecida no
  novo ADR.
- **Pré-visualizar ou editar o conteúdo do ficheiro na UI** antes de gravar. O ficheiro é escrito tal como
  foi arrastado (depois de validado) — sem editor de texto na app.
- **Upload de várias skills de uma vez.**

> Esta lista impede uma sessão futura de expandir o âmbito sozinha.

### Segunda fase (se houver)
- Upload de designs completos (2 ficheiros: `THEME.md` + `tokens.md` — mais simples que uma stack).
- Upload de stacks completas, com validação de completude (recusar se faltar um ficheiro obrigatório do
  molde `_TEMPLATE/STACK.md`).
- Skills soltas sem stack, com escolha livre de categoria.
- Atualizar também `library/stacks/README.md` (ou aceitar que continua um ficheiro só de leitura humana,
  por decidir).

## 3. Decisões tomadas

| Decisão | Escolha | Porquê | Alternativa rejeitada |
|---|---|---|---|
| Âmbito da v1 | Só skills, sempre dentro de uma stack existente | Skill é 1 ficheiro (simples, schema já existe); stacks/designs são pastas com ficheiros obrigatórios — mais trabalho e casos-limite | Incluir designs (2 ficheiros) ou as três coisas já na v1 — adiado para 2ª fase |
| Mecanismo de upload | Arrastar/escolher um único ficheiro `.md` (multipart) | Sem depender de biblioteca de zip nova no backend; o caso de uso real (uma skill) é sempre um ficheiro só | `.zip` com estrutura esperada — só faria sentido para stacks/designs multi-ficheiro, fora do âmbito |
| Colisão de nome (stack + nome de skill já existe) | Recusar sempre | A biblioteca é partilhada por todos os projetos gerados pelo Workflow; overwrite por engano estraga uma stack `proven` | Perguntar para confirmar substituição — fica para 2ª fase se fizer falta |
| Destino de uma skill | Sempre dentro de uma stack existente, escolhida num `Select` | Reflete o uso real (skills soltas em `library/skills/process/` são um conjunto fixo do próprio Workflow) | Também permitir skill solta sem stack — fora do âmbito desta v1 |
| Sincronizar `provides-skills` do `STACK.md` | Sim, acrescenta o nome automaticamente (edição pontual do frontmatter) | Mantém o manifesto coerente com o disco sem passo manual; a lista "Skills" da stack no ecrã já lê este campo | Não mexer no `STACK.md` — ficaria desatualizado, rejeitado por deixar a Biblioteca a mentir sobre o que a stack fornece |
| Nome do ficheiro final | Derivado do campo `name` do frontmatter (kebab-case), nunca do nome do ficheiro arrastado | Evita confiar num nome vindo do cliente; garante `skill-<name>.md` sempre coerente com `name:` | Usar o nome do ficheiro arrastado tal como veio — risco de nomes inconsistentes ou path traversal |
| Falha ao atualizar `STACK.md` depois do ficheiro da skill já escrito | Melhor esforço: regista aviso no log, devolve sucesso na mesma (a skill já existe e aparece na Biblioteca por leitura direta da pasta) | `provides-skills` é só uma referência cruzada informativa — o `LibraryService.skills()` não depende dele para listar a skill nova | Reverter (apagar) o ficheiro da skill se o `STACK.md` falhar — complexidade extra para um campo não crítico |
| Limite de tamanho do ficheiro | 256 KiB, constante no código | Uma skill real tem poucos KB; não há razão para variável de ambiente | `MAX_SKILL_UPLOAD_BYTES` no `.env` — nada a afinar por instalação |

**ADRs gerados:** um novo (passo 1) — reverte parcialmente a
[[../adr/0005-biblioteca-lida-do-disco|ADR 0005]], abrindo uma escrita estreita e validada
(`stacks/<id>/skills/skill-*.md` + `provides-skills` do `STACK.md` dessa stack) — nada mais no
`WORKFLOW_PATH` fica escrevível pela app.

## 4. Desenho técnico

### 4.1 Dados

Sem base de dados nova ([[../adr/0009-estado-em-ficheiro-json|ADR 0009]]). O `WORKFLOW_PATH/library` deixa
de ser só-leitura **só** nestes dois pontos:
- `library/stacks/<stackId>/skills/skill-<name>.md` — ficheiro novo, criado (nunca sobrescrito).
- `library/stacks/<stackId>/STACK.md` — só o array `provides-skills` do frontmatter é alterado (acrescenta
  `<name>` se ainda não estiver lá); o resto do ficheiro (corpo Markdown, outros campos do frontmatter)
  fica byte-a-byte igual.

### 4.2 Endpoints

| Método | Rota | Corpo | Resposta | Erros |
|---|---|---|---|---|
| POST | `/api/library/stacks/:stackId/skills` | `multipart/form-data`, campo `file` (um `.md`) | `201 SkillEntry` (mesma forma do `GET /api/library/skills`) | `COMMON_001` · `LIBRARY_002` · `LIBRARY_003` · `LIBRARY_004` · `LIBRARY_005` |

Sessão obrigatória (`AUTH_002`), como o resto da API. `:stackId` tem de ser um dos ids devolvidos por
`GET /api/library/stacks` — nunca é concatenado cru num caminho de ficheiro (ver §4.5 e o passo 3, que
testa explicitamente um `stackId` tipo `../../etc`).

### 4.3 Tipos / DTOs

```ts
// backend/src/library/library.schemas.ts — novo, ao lado de skillManifestSchema
const kebab = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'tem de ser kebab-case (letras minúsculas, dígitos, hífen)');

/** Como skillManifestSchema, mas com `name` a exigir kebab-case — só para uploads (a leitura fica tolerante). */
export const skillUploadManifestSchema = skillManifestSchema.extend({ name: kebab });
```

```ts
// backend/src/library/libraryService.ts — novo método
async uploadSkill(stackId: string, fileBuffer: Buffer): Promise<SkillEntry>
// lança AppError('LIBRARY_004') se a stack não existe,
// AppError('LIBRARY_002', …, fieldErrors) se o frontmatter/nome for inválido,
// AppError('LIBRARY_003') se stacks/<stackId>/skills/skill-<name>.md já existir.
```

```ts
// backend/src/library/frontmatterEditor.ts — novo, função pura (sem I/O)
/** Acrescenta `name` a `provides-skills` no bloco de frontmatter de um STACK.md; idempotente. */
export function withSkillAddedToProvidesSkills(stackMdText: string, name: string): string
```

Frontend reutiliza `SkillEntry` de `frontend/src/types/library.ts` (já existe, espelha o backend) — sem
tipo novo.

### 4.4 Interface

- **Onde vive**: ecrã Biblioteca (`/library`), tab Skills.
- **Como se chega lá**: botão novo "+ Adicionar skill" junto à pesquisa/filtros da tab Skills (só visível
  nessa tab — a Biblioteca deixa de ser "só leitura" apenas para skills; o texto do cabeçalho
  `frontend/src/pages/LibraryPage.tsx` ("Stacks, designs e skills do teu registo. Só leitura.") tem de ser
  revisto para não continuar a dizer "só leitura" sem exceção).
- **Ficheiros**:
  - **Backend (novo)**: `backend/src/library/frontmatterEditor.ts`,
    `backend/test/frontmatterEditor.test.ts`.
  - **Backend (modificado)**: `backend/src/library/library.schemas.ts` (`skillUploadManifestSchema`),
    `backend/src/library/libraryService.ts` (`uploadSkill`), `backend/src/library/library.routes.ts` (rota
    nova), `backend/src/app.ts` (regista `@fastify/multipart`), `backend/package.json`
    (+`@fastify/multipart`), `backend/test/library.routes.test.ts` (casos novos).
  - **Frontend (novo)**: `frontend/src/components/library/UploadSkillDrawer.tsx`.
  - **Frontend (modificado)**: `frontend/src/services/libraryService.ts` (`uploadSkill(stackId, file)`),
    `frontend/src/pages/LibraryPage.tsx` (botão + abrir o drawer + inserir a entrada devolvida na lista),
    `frontend/src/errors/errorMessages.ts` (`LIBRARY_002`–`LIBRARY_005`).
- **O drawer** (`UploadSkillDrawer`, mesmo padrão dos outros drawers da app —
  [[../skills/references/design/drawers-and-modals|drawers-and-modals]]): um `Select` com as stacks (de
  `useLibrary().stacks.entries`, mostra `name`, valor `id`; vazio → aviso "Nenhuma stack na biblioteca" e o
  campo de ficheiro desativado) + uma zona de arrastar/escolher um ficheiro `.md` (mostra só o nome e o
  tamanho do ficheiro escolhido, sem pré-visualizar conteúdo) + botão "Enviar" (desativado sem stack e sem
  ficheiro). Ao enviar: `loading` no botão, erro do backend mostrado dentro do drawer (via
  `ErrorHandler`, [[../skills/references/frontend-error-handling|frontend-error-handling]] — os
  `fieldErrors` de `LIBRARY_002` juntam-se numa lista, não há campos de formulário a que amarrar cada um
  individualmente, já que o erro está *dentro* do ficheiro). Sucesso: fecha o drawer, mostra uma notificação
  "Skill adicionada." e a tabela de skills já tem a entrada nova (inserida no estado do `useLibrary`, sem
  refazer o `GET`).
- **Estado vazio**: sem nenhuma stack na biblioteca → o botão "+ Adicionar skill" continua visível mas o
  drawer explica que é preciso pelo menos uma stack primeiro (`/add-stack` pelos terminais).
- **Visibilidade por role**: não há roles ([[../adr/0003-auth-utilizador-unico]]).
- **Visual**: reaproveita o padrão de drawer já existente (`LibraryEntryDrawer`) e os tokens
  ([[../skills/references/design/tokens-and-colors|tokens-and-colors]]) — sem padrão visual novo à partida;
  se a zona de arrastar ficheiro precisar de um padrão que ainda não existe, regista-se em `design/` no
  passo 5.

### 4.5 Códigos de erro novos

| Código | HTTP | Mensagem no frontend |
|---|---|---|
| `LIBRARY_002` | 400 | O ficheiro não é uma skill válida — confirma o frontmatter (`fieldErrors` com o detalhe) |
| `LIBRARY_003` | 409 | Já existe uma skill com este nome nessa stack |
| `LIBRARY_004` | 404 | Esta stack não existe na biblioteca |
| `LIBRARY_005` | 400 | Ficheiro em falta, vazio, ou maior que o limite permitido |

`COMMON_001` continua a cobrir o corpo do pedido mal formado (ex.: sem o campo `file` no multipart, ou
`stackId` com um formato inválido antes mesmo de se ir ao disco).

## 5. Passos

Ordem obrigatória. Tiers: `opus` (desenho, não delegar) · `sonnet` (implementação) · `haiku` (mecânico).
**Regra 8 do `CLAUDE.md`**: nunca editar o backend a partir de um terminal servido por ele em `npm run dev`.

- [ ] **1. ADR — escrita controlada da app na biblioteca do Workflow**
  - Ficheiro: `docs/adr/0014-escrita-controlada-biblioteca.md`, `docs/adr/README.md` (linha nova),
    `docs/adr/0005-biblioteca-lida-do-disco.md` (só o campo "Estado" da tabela do README a apontar para o
    novo ADR, como já se fez com o 0003/0011 — **não reescrever a decisão original do 0005**)
  - Skill: —
  - Tier: `opus` (decisão estrutural — reverte parte de um ADR aceite; não delegar)
  - Aceite quando: o ADR novo descreve o contexto (o pedido, o que o 0005 já previa), as opções
    consideradas (esta escrita estreita vs. continuar só pelos terminais vs. abrir escrita total), a
    decisão (só `stacks/<id>/skills/skill-*.md` + `provides-skills` do `STACK.md` correspondente,
    validado, sem overwrite) e as consequências (o que fica de fora — §2 desta spec); `docs/adr/README.md`
    tem a linha nova; o 0005 não teve a sua decisão original editada.

- [ ] **2. `frontmatterEditor.ts` + `skillUploadManifestSchema` — lógica pura**
  - Ficheiro: `backend/src/library/frontmatterEditor.ts`, `backend/src/library/library.schemas.ts`
    (extend), `backend/test/frontmatterEditor.test.ts`
  - Skill: —
  - Tier: `sonnet`
  - Aceite quando: `withSkillAddedToProvidesSkills` acrescenta o nome a `provides-skills` num `STACK.md`
    de exemplo com a lista vazia e noutro já com itens; chamado duas vezes com o mesmo nome não duplica
    (idempotente); o corpo Markdown e os outros campos do frontmatter ficam inalterados; lança se o
    ficheiro não tiver bloco `--- … ---`. `skillUploadManifestSchema` aceita `name: "add-thing"` e rejeita
    `"Add Thing"`/`"add_thing"`/`"Add-Thing"`. `npm run typecheck`/`test`/`lint` limpos.

- [ ] **3. `POST /api/library/stacks/:stackId/skills` — rota, serviço, multipart**
  - Ficheiro: `backend/src/library/library.routes.ts`, `backend/src/library/libraryService.ts`,
    `backend/src/app.ts`, `backend/package.json` (+`@fastify/multipart`),
    `backend/test/library.routes.test.ts`, `docs/api.md`
  - Skill: —
  - Tier: `opus` (primeira rota do backend que escreve fora do próprio processo, no disco do Workflow —
    um erro aqui corrompe a biblioteca partilhada por todos os projetos gerados; path traversal via
    `stackId` tem de ficar impossível por construção, não só validado)
  - Aceite quando: multipart de um `skill-*.md` válido para uma stack existente → `201` com o `SkillEntry`,
    o ficheiro existe em `stacks/<id>/skills/skill-<name>.md`, `provides-skills` do `STACK.md` dessa stack
    inclui o nome; frontmatter inválido → `400 LIBRARY_002` com `fieldErrors`, nada escrito; `stackId`
    inexistente (incluindo `../../etc` ou caminhos absolutos) → `404 LIBRARY_004`, nada escrito nem lido
    fora de `library/stacks/`; nome já existente nessa stack → `409 LIBRARY_003`, nada escrito; ficheiro
    vazio ou > 256 KiB → `400 LIBRARY_005`; `docs/api.md` atualizado no mesmo commit
    ([[../backend-conventions]]); `npm run typecheck`/`test`/`lint` limpos.

- [ ] **4. Frontend: serviço + erros**
  - Ficheiro: `frontend/src/services/libraryService.ts` (extend), `frontend/src/errors/errorMessages.ts`
    (`LIBRARY_002`–`LIBRARY_005`)
  - Skill: `frontend-error-handling`
  - Tier: `sonnet`
  - Aceite quando: `uploadSkill(stackId, file)` envia multipart e devolve `SkillEntry`; os quatro códigos
    novos têm mensagem em `errorMessages.ts`, na mesma ordem do backend; `npx tsc -b` e lint limpos.

- [ ] **5. `UploadSkillDrawer` + botão na `LibraryPage`**
  - Ficheiro: `frontend/src/components/library/UploadSkillDrawer.tsx`,
    `frontend/src/pages/LibraryPage.tsx` (reescrito na tab Skills)
  - Skill: `frontend-design-system`, `frontend-error-handling`
  - Tier: `opus` (primeira vez que a Biblioteca deixa de ser só-leitura — o precedente de UX conta para
    qualquer upload futuro, §2 "Segunda fase")
  - Aceite quando: no browser — "+ Adicionar skill" na tab Skills abre o drawer; escolher uma stack +
    arrastar um `skill-*.md` válido → sucesso, drawer fecha, a skill aparece na lista sem F5; frontmatter
    inválido → erro claro dentro do drawer, continua aberto; nome duplicado → erro claro; sem nenhuma
    stack na biblioteca → aviso a dizer para usar `/add-stack` primeiro; só tokens, nenhum hex novo;
    `npx tsc -b` e lint limpos.

- [ ] **6. Verificação ponta a ponta + registo do padrão + fecho**
  - Ficheiro: `docs/product/use-cases.md`, `docs/skills/references/design/*` (se emergir um padrão novo
    para a zona de upload), `notes/ToDo.md`, `notes/whatIveDone.md`
  - Skill: `run`
  - Tier: `sonnet`
  - Aceite quando: no browser, com o `claude` real — upload de uma skill de **teste** (nome óbvio, ex.
    `skill-teste-upload`) numa stack de baixo risco (não `proven`, ex. `tauri` ou `rust-axum` — nunca uma
    stack em uso ativo como `react-vite-antd`/`spring-boot`); confirma que aparece na Biblioteca **e** em
    `WORKFLOW_PATH/library/stacks/<id>/skills/skill-teste-upload.md` **e** no `provides-skills` do
    `STACK.md` dessa stack; **depois da verificação, apaga o ficheiro de teste e reverte o
    `provides-skills`** (a biblioteca é partilhada por outros projetos — não deixar lixo de teste lá);
    docs atualizados; plano/spec fechados.

## 6. Estado atual

> ⚠️ **Atualizar SEMPRE no fim de cada sessão.** É a secção que torna esta spec retomável.

**Feito:** nada ainda — spec escrita e pronta a implementar.
**Em curso:** nada.
**Próxima ação concreta:** `/implement-todo` → "Implementar a partir de uma spec" → começar pelo passo 1
(ADR).
**Desvios ao plano:** nenhum ainda.
**O que uma sessão nova precisa de saber:**
- Esta feature **escreve no disco do Workflow** (`WORKFLOW_PATH/library`), partilhado por todos os
  projetos gerados por ele — não é um dado só desta app. Qualquer teste manual (passo 6) tem de ser
  limpo no fim.
- O âmbito ficou deliberadamente pequeno (só skills, sempre dentro de uma stack existente, sem overwrite)
  — ver §2 "Fora" antes de adicionar stacks/designs completos ou skills soltas: são 2ª fase.
- O passo 1 (ADR) tem de existir e ser aceite **antes** do código — é uma decisão estrutural que reverte
  parte da [[../adr/0005-biblioteca-lida-do-disco|ADR 0005]].

## 7. Perguntas em aberto

| Pergunta | Bloqueia | Notas |
|---|---|---|
| Vale a pena, numa 2ª fase, também atualizar `library/stacks/README.md`? | Não bloqueia — decisão de 2ª fase | Edição de uma tabela de prosa é mais frágil que editar um array no frontmatter; avaliar depois de uso real |
| Upload de designs/stacks completos chega a fazer falta, ou o fluxo pelos terminais chega? | Não bloqueia — 2ª fase | Perguntar ao dono depois de usar esta v1 |

## Relacionado

[[skill-plan-feature]] · [[skill-implement-todo]] · [[../adr/README]] ·
[[../adr/0005-biblioteca-lida-do-disco]] · [[../product/use-cases]]
