# Feature: Informação dos projetos (hosting, URLs, deploys)

| | |
|---|---|
| **Estado** | 🚧 Em curso |
| **Criada** | 2026-11-08 |
| **Última sessão** | 2026-11-08 |
| **Passos** | 4 / 7 concluídos |

> Escrita para uma sessão que **não viu a conversa que a originou**. Se algo só faz sentido com contexto
> externo, falta escrevê-lo.

Uma página **Projetos** onde cada projeto do registo do Workflow tem a sua ficha: em que estado de vida
está, onde corre (ambientes, cada um com URL, hosting e histórico de deploys), onde está o código e a infra,
o que é preciso para o operar, e notas. Nasceu de o dono ter o **Worksite** já em produção e querer
vê-lo na app. Decisão estrutural em [[../adr/0028-informacao-de-deploy-por-projeto]].

---

## 1. O que é e porquê

Hoje a app sabe que um projeto **existe** (registo `projects/INDEX.md`, [[separadores-de-projetos]]) mas
não o que lhe aconteceu: está em produção? Onde? Em que URL? Quando foi o último deploy? Essa informação
vive na cabeça do dono ou espalhada por painéis de hosting. O dono quer abrir a app e ver, de relance, o
estado de todas as suas aplicações.

**Como sei que está bem feito:** abro **Projetos**, vejo um cartão por projeto; o do Worksite diz
"Em produção", mostra o URL (um clique abre-o), o hosting e "último deploy há 3 dias". Dou um deploy,
volto, carrego **Registar deploy**, e o cartão atualiza. Num projeto novo sem nada, vejo "Sem informação" e
um botão para a preencher.

## 2. Âmbito

### Dentro
- **Backend**: nova coleção `projectInfos` no `state.json` (ADR 0028) e rotas `/api/project-infos` para ler,
  gravar a ficha, apagar a ficha e registar/apagar deploys. Só para projetos que `GET /api/projects` devolve.
- **Ficha por projeto** (todos os campos opcionais):
  - *Ciclo de vida*: `development` · `production` · `maintenance` · `paused` · `archived`; cliente/dono (texto).
  - *Ambientes* (até 5): tipo (`production` · `staging` · `development` · `other`), nome, URL, hosting
    (autocompletar com sugestões), branch/versão em produção, URL do painel do hosting, URL dos logs/
    monitorização, URL de health check (**só guardado**, nunca chamado), custo mensal (€), **histórico de
    deploys** (data/hora, versão opcional, nota opcional; até 20 por ambiente).
  - *Código e infra*: URL do repositório, base de dados/serviços (texto), CI/CD (texto), domínio
    (nome, onde está registado, data de renovação).
  - *Notas e links*: notas livres (≤ 4000) e até 10 links `{rótulo, URL}`.
- **Página `/projects`**: cartões (nome, tag de ciclo de vida, URL do ambiente de produção, hosting, último
  deploy relativo), filtro por ciclo de vida (chips), pesquisa por nome; clicar num cartão abre um **drawer**
  com a ficha completa e **Editar**.
- **Registar deploy**: botão no drawer, por ambiente — data/hora de agora, editável, versão e nota opcionais.
- **Item "Projetos"** na navegação e uma ação de atalho `goProjects` no catálogo (sem tecla por omissão,
  como `goLibrary`).

### ⛔ Fora — não implementar nesta feature
- **Ícone de informação (ⓘ) nos separadores dos Terminais** que abre a ficha do projeto. O dono quer-o,
  mas **para já só a página**. A página tem de aceitar um projeto pré-aberto por `location.state`
  (`{projectPath}`) para essa fase ser barata — mas o ícone não se faz agora.
- **Ping/verificação de estado dos URLs** (bolinha verde/vermelha), automático ou por botão. É o backend a
  fazer pedidos a URLs escritos pelo utilizador (SSRF); precisa de ADR próprio ([[../adr/0028-informacao-de-deploy-por-projeto]], ponto 4).
- **Ler a data do deploy do git ou da API do hosting.** A data é sempre manual.
- **Projetos que não estão no registo** (entradas manuais, site de cliente sem pasta). Só os do registo,
  sem `descartado` e dentro de `ALLOWED_ROOTS`.
- **Entidade `Fornecedor`** reutilizável entre apps. Hosting é texto com autocompletar.
- **Guardar segredos** (passwords, tokens, chaves). Nunca; a UI avisa nos campos de notas.
- **Exportar a ficha para o vault do projeto**, atalho "Abrir terminal" no cartão, gráficos de custo,
  alertas de renovação.
- **A app escrever no `projects/INDEX.md`** ou em pastas de projetos.

> Esta lista impede uma sessão futura de expandir o âmbito sozinha.

### Segunda fase (se houver)
- Ícone ⓘ em `ProjectTabs` → `/projects` com o drawer do projeto aberto.
- Ping de estado dos URLs (ADR de segurança primeiro: só `http(s)`, timeout curto, sem IPs privados).
- Aviso de renovação de domínio/hosting perto da data.
- Exportar um resumo para o vault do projeto para o Claude o ler.

## 3. Decisões tomadas

| Decisão | Escolha | Porquê | Alternativa rejeitada |
|---|---|---|---|
| Onde se guarda | Coleção `projectInfos` no `state.json`, chave `projectPath` | Mesmo mecanismo de ADR 0009; edita-se na UI; a app não escreve em pastas de projetos | Ficheiro por projeto (superfície nova no ADR 0004); `projects/INDEX.md` (só leitura, ADR 0005) |
| Ambientes | Lista de até 5, cada um com os seus dados e deploys | O Worksite terá produção + staging; um só bloco obrigaria a migração depois | Um único deployment por projeto |
| Data do deploy | Manual, histórico por ambiente (20), "último" derivado | Zero integrações, serve para qualquer hosting | Só um campo de data; leitura automática (uma integração por hosting) |
| Ping de estado | Fora | SSRF; exige ADR próprio | Botão "Verificar agora" |
| Que projetos | Os do `GET /api/projects` | Reaproveita a regra `descartado`/`ALLOWED_ROOTS` já testada | Entradas manuais (ids próprios, "Adicionar") |
| Hosting | Texto com autocompletar (sugestões fixas + já usados) | Sem tabela a manter, aceita qualquer fornecedor | Texto livre puro (grafias diferentes); entidade `Fornecedor` |
| Onde na UI | Página `/projects` + drawer; ⓘ nos separadores fica para a 2ª fase | Pedido do dono: "para já faz apenas a página" | Painel dentro de Terminais |
| Versão do schema | `.default([])`, sem subir `STATE_VERSION` | Precedente de `accounts` (ADR 0027) | `migrate(2 → 3)` desnecessário |
| Moeda do custo | EUR, campo `monthlyCostEur` | Dono em Portugal; simples | Moeda por ambiente (adiar até haver custo em USD) |
| URLs | Só `http:`/`https:`, `rel="noopener noreferrer"` | Evita `javascript:` e `file:` em links clicáveis | Aceitar qualquer string |

**ADRs gerados:** [[../adr/0028-informacao-de-deploy-por-projeto]].

## 4. Desenho técnico

### 4.1 Dados

`DATA_DIR/state.json` ganha `projectInfos` (ver [[../database]] — atualizar no passo 2):

```ts
// backend/src/state/state.schema.ts
const httpUrl = z.url().refine((u) => /^https?:\/\//i.test(u), 'http(s) only').max(500);

deploySchema = z.object({
  id: z.uuid(),
  at: z.iso.datetime(),                       // instante do deploy
  version: z.string().trim().min(1).max(80).nullable().default(null),
  note: z.string().trim().min(1).max(280).nullable().default(null),
});

environmentSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['production', 'staging', 'development', 'other']),
  name: z.string().trim().min(1).max(40),
  url: httpUrl.nullable().default(null),
  hosting: z.string().trim().min(1).max(80).nullable().default(null),
  version: z.string().trim().min(1).max(80).nullable().default(null),   // branch / versão em produção
  dashboardUrl: httpUrl.nullable().default(null),                        // painel do hosting
  logsUrl: httpUrl.nullable().default(null),
  healthUrl: httpUrl.nullable().default(null),                           // só guardado, nunca chamado
  monthlyCostEur: z.number().min(0).max(100000).nullable().default(null),
  deploys: z.array(deploySchema).max(20).default([]),                    // mais recente primeiro
});

projectInfoSchema = z.object({
  projectPath: z.string().min(1),             // único; = ProjectEntry.path
  lifecycle: z.enum(['development', 'production', 'maintenance', 'paused', 'archived']).nullable().default(null),
  client: z.string().trim().min(1).max(80).nullable().default(null),
  environments: z.array(environmentSchema).max(5).default([]),
  repoUrl: httpUrl.nullable().default(null),
  database: z.string().trim().min(1).max(120).nullable().default(null),
  ci: z.string().trim().min(1).max(120).nullable().default(null),
  domain: z.object({
    name: z.string().trim().min(1).max(120),
    registrar: z.string().trim().min(1).max(80).nullable().default(null),
    renewsAt: z.iso.date().nullable().default(null),
  }).nullable().default(null),
  links: z.array(z.object({ label: z.string().trim().min(1).max(60), url: httpUrl })).max(10).default([]),
  notes: z.string().max(4000).default(''),
  updatedAt: z.iso.datetime(),
});
// stateSchema: projectInfos: z.array(projectInfoSchema).default([])
```

- `projectPath` é único; o limite de entradas é o do registo (sem tecto próprio).
- Deploys guardam-se mais recente primeiro; ao exceder 20, sai o mais antigo.
- "Último deploy" de um ambiente = o `at` mais recente; o do cartão = o do ambiente `production` (se não
  houver, o mais recente de qualquer ambiente). **Deriva-se, nunca se guarda.**

### 4.2 Endpoints

Todos com sessão (`AUTH_002`). `projectPath` tem de estar na lista de `GET /api/projects`, senão `PROJECT_001`.

| Método | Rota | Corpo / query | Resposta | Erros |
|---|---|---|---|---|
| GET | `/api/project-infos` | — | `ProjectInfo[]` (só dos projetos hoje visíveis no registo) | — |
| PUT | `/api/project-infos` | `{projectPath, info}` (a ficha **sem** `deploys`; ambientes sem `id` ganham um) | `ProjectInfo` | `COMMON_001`, `PROJECT_001` |
| DELETE | `/api/project-infos` | query `projectPath` | `204` | `PROJECT_001` |
| POST | `/api/project-infos/deploys` | `{projectPath, environmentId, at?, version?, note?}` (`at` omissão = agora) | `ProjectInfo` | `COMMON_001`, `PROJECT_001`, `PROJECT_002` |
| DELETE | `/api/project-infos/deploys` | query `projectPath`, `environmentId`, `deployId` | `ProjectInfo` | `PROJECT_001`, `PROJECT_002`, `PROJECT_003` |

Regras do `PUT`: substitui a ficha **mas preserva os `deploys`** dos ambientes cujo `id` se mantém; um
ambiente que desaparece leva os deploys consigo. PUT sem nada preenchido grava na mesma (o `DELETE` é que
remove a ficha). Idempotente.

### 4.3 Tipos / DTOs

`ProjectInfo` = o `projectInfoSchema` acima (espelhado à mão em `frontend/src/types/projectInfo.ts`). O
frontend junta `ProjectEntry` (já existe) com a `ProjectInfo | undefined` pelo `path`. Helpers puros em
`frontend/src/components/projects/projectInfoFormat.ts`: `lastDeploy(env)`, `primaryEnvironment(info)`,
`lifecycleLabel/Color`, `relativeDeploy(at)`.

### 4.4 Interface

- **Onde vive**: rota `/projects`, `frontend/src/pages/ProjectsPage.tsx`.
- **Como se chega lá**: item **Projetos** em `NAV_ITEMS` (`layouts/AppLayout.tsx`), entre Terminais e
  Biblioteca; ação `goProjects` no catálogo de atalhos (`backend/src/keybindings/catalog.ts`, sem tecla).
- **Ficheiros**:
  - Backend (novos): `backend/src/projectInfo/{projectInfo.schemas.ts,projectInfoService.ts,projectInfo.routes.ts}`, `backend/test/projectInfo.routes.test.ts`; (editados) `state/state.schema.ts`, `common/errors.ts`, `app.ts`.
  - Frontend (novos): `types/projectInfo.ts`, `services/projectInfoService.ts`, `hooks/useProjectInfos.ts`, `pages/ProjectsPage.tsx`, `components/projects/{ProjectCard,ProjectInfoDrawer,ProjectInfoForm,EnvironmentFields,DeployList,RegisterDeployModal,projectInfoFormat,hosting}.ts(x)`; (editados) `main.tsx` (rota), `layouts/AppLayout.tsx`, `errors/errorMessages.ts`.
- **Estado vazio**: sem projetos no registo → "Nenhum projeto encontrado" com pista para `WORKFLOW_PATH`/
  `ALLOWED_ROOTS` (igual à lateral dos Terminais). Projeto sem ficha → cartão com "Sem informação" e botão
  **Adicionar informação** que abre o drawer em modo de edição.
- **Hosting**: `AutoComplete` do Ant Design; opções = sugestões fixas (`Vercel`, `Netlify`, `Railway`,
  `Render`, `Fly.io`, `Cloudflare`, `Supabase`, `AWS`, `Hetzner`, `VPS próprio`) + os já usados em qualquer
  ficha, sem duplicados. Aceita qualquer texto.
- **Aviso**: por baixo das notas, "Não guardes passwords nem tokens aqui."
- **Visibilidade por role**: não há roles ([[../adr/0003-auth-utilizador-unico]]).
- **Visual**: só tokens ([[../skills/references/design/tokens-and-colors]]) e as convenções de
  [[../skills/references/frontend-visual-consistency]]; cartões e chips no padrão de tabelas/listas
  ([[../skills/references/design/tables-and-lists]]). Sem protótipo do Claude Design: se nascer um padrão
  visual novo, registá-lo em `design/` no passo 7.

### 4.5 Códigos de erro novos

| Código | HTTP | Mensagem no frontend |
|---|---|---|
| `PROJECT_001` | 404 | Este projeto já não está no registo do Workflow. |
| `PROJECT_002` | 404 | Esse ambiente já não existe — recarrega a página. |
| `PROJECT_003` | 404 | Esse deploy já não existe. |

(Backend em `common/errors.ts`, espelho 1:1 em `frontend/src/errors/errorMessages.ts`, skill
`frontend-error-handling`.) Validação (URL não `http(s)`, textos longos) → `COMMON_001` com erro por campo.

## 5. Passos

Ordem obrigatória. Tiers: `opus` (desenho, não delegar) · `sonnet` (implementação) · `haiku` (mecânico).
**Regra 8 do `CLAUDE.md`**: nunca editar o backend a partir de um terminal servido por ele em `npm run dev`.

- [x] **1. Schema da coleção `projectInfos`**
  - Ficheiro: `backend/src/state/state.schema.ts`, `backend/test/stateStore.test.ts`
  - Skill: — (seguir [[../backend-conventions]] e [[../skills/references/code-best-practices]])
  - Tier: `sonnet`
  - Aceite quando: os schemas da §4.1 existem e `stateSchema` tem `projectInfos` com `.default([])` **sem** subir `STATE_VERSION`; um `state.json` v2 antigo (sem o campo) lê-se como `projectInfos: []`; testes: URL `javascript:` rejeitado, 21 deploys rejeitados, 6 ambientes rejeitados, `projectPath` duplicado rejeitado.

- [x] **2. Serviço, rotas, erros e docs de dados**
  - Ficheiro: `backend/src/projectInfo/{projectInfo.schemas.ts,projectInfoService.ts,projectInfo.routes.ts}`, `backend/src/common/errors.ts` (`PROJECT_001-003`), `backend/src/app.ts` (montar), `backend/test/projectInfo.routes.test.ts`; `docs/api.md` (secção "Informação dos projetos"), `docs/code-map.md` (linha "Informação dos projetos"), `docs/database.md` (coleção `projectInfos` + linha na tabela "O que vive onde" + ER)
  - Skill: — (seguir [[../backend-conventions]], [[../api]] e o padrão de `backend/src/accounts/`)
  - Tier: `sonnet`
  - Aceite quando: as 5 rotas da §4.2 passam com `app.inject` — incluindo `PROJECT_001` para um caminho fora do registo, `PUT` que preserva os deploys dos ambientes com o mesmo `id` e descarta os do ambiente removido, `POST` de deploy com `at` omitido usa agora e ordena o mais recente primeiro, o 21.º deploy empurra o mais antigo, `DELETE` ficha remove tudo; sem sessão → `AUTH_002`; `docs/` atualizados no mesmo commit.

- [x] **3. Frontend: tipos, serviço, hook, erros**
  - Ficheiro: `frontend/src/types/projectInfo.ts`, `services/projectInfoService.ts`, `hooks/useProjectInfos.ts`, `errors/errorMessages.ts`
  - Skill: `frontend-design-system`, `frontend-error-handling`
  - Tier: `sonnet`
  - Aceite quando: `useProjectInfos` busca uma vez e expõe `save`, `remove`, `registerDeploy`, `removeDeploy`, `refresh`; cada catch usa `ErrorHandler.handle`; `PROJECT_001-003` espelhados; `npx tsc -b` e lint limpos.

- [x] **4. Página `/projects` com cartões, filtros e navegação**
  - Ficheiro: `frontend/src/pages/ProjectsPage.tsx`, `components/projects/{ProjectCard,projectInfoFormat,hosting}.ts(x)`, `main.tsx`, `layouts/AppLayout.tsx`, `backend/src/keybindings/catalog.ts` (`goProjects`, sem tecla) e o `NAV_ITEMS` de `layouts/AppLayout.tsx` (onde o frontend trata `goLibrary`)
  - Skill: `frontend-design-system`, [[../skills/references/frontend-visual-consistency]]
  - Tier: `sonnet`
  - Aceite quando: no browser, `/projects` lista os projetos do registo juntando com a ficha por `path`; cartão mostra nome, tag de ciclo de vida, URL do ambiente de produção como link `target=_blank rel="noopener noreferrer"`, hosting e "último deploy" relativo; chips de ciclo de vida filtram e a pesquisa por nome funciona; estado vazio e "Sem informação" tratados; item **Projetos** na navegação; só tokens, nenhum hex novo. `formatters` (`lastDeploy`, `primaryEnvironment`) cobertos por testes se a stack do frontend tiver runner, senão verificados no passo 7.

- [ ] **5. Drawer de detalhe e formulário de edição**
  - Ficheiro: `frontend/src/components/projects/{ProjectInfoDrawer,ProjectInfoForm,EnvironmentFields,projectInfoFormSchema}.ts(x)`
  - Skill: `frontend-design-system` (React Hook Form + Zod, padrão Drawer), `frontend-error-handling`
  - Tier: `sonnet`
  - Aceite quando: clicar num cartão abre o drawer (modo ver) com ciclo de vida, ambientes (URL, hosting, painel, logs, health, custo), código/infra, domínio, links e notas; **Editar** abre o formulário com os mesmos campos; ambientes adicionam-se/removem-se (máx. 5); URLs não `http(s)` dão erro por campo; hosting é `AutoComplete` com as sugestões da §4.4; **Guardar** chama `PUT` e atualiza o cartão sem recarregar; aviso "Não guardes passwords nem tokens aqui" junto às notas; a página aceita `location.state.projectPath` para abrir o drawer desse projeto (usado na 2ª fase).

- [ ] **6. Registar e apagar deploys**
  - Ficheiro: `frontend/src/components/projects/{DeployList,RegisterDeployModal}.tsx`, ligação em `ProjectInfoDrawer.tsx`
  - Skill: `frontend-design-system`, `frontend-error-handling`
  - Tier: `sonnet`
  - Aceite quando: cada ambiente no drawer mostra os seus deploys (data/hora, versão, nota; mais recente primeiro); **Registar deploy** abre um modal com data/hora de agora (editável), versão e nota opcionais; ao confirmar, a lista e o "último deploy" do cartão atualizam; apagar um deploy pede confirmação (`useConfirm`); o 21.º deploy faz sair o mais antigo.

- [ ] **7. Verificação ponta a ponta e fecho**
  - Ficheiro: `docs/product/use-cases.md` (ecrã Projetos), `docs/skills/references/design/*` (se houver padrão visual novo), este ficheiro (§6), `notes/ToDo.md`, `notes/whatIveDone.md`
  - Skill: `run` · [[../skills/references/testing-and-verification]]
  - Tier: `sonnet`
  - Aceite quando: no browser, com o backend real e um `DATA_DIR` de teste (ver `scripts/verify/instance.mjs`): criar a ficha do Worksite com produção + staging, registar dois deploys, recarregar e ver tudo; editar e apagar; um URL `javascript:` é recusado; sem erros na consola; testes do backend, `tsc -b` e lint verdes; docs atualizados; spec marcada ✅.

## 6. Estado atual

> ⚠️ **Atualizar SEMPRE no fim de cada sessão.** É a secção que torna esta spec retomável.

**Feito:** entrevista e desenho (2026-11-08); ADR 0028; passo 1 (schema `projectInfos` em
`state.schema.ts`, 4 testes novos em `stateStore.test.ts`); passo 2 (`backend/src/projectInfo/`, `PROJECT_001-003`,
montado em `app.ts`, 11 testes em `test/projectInfo.routes.test.ts`, suite inteira 527/527; `docs/api.md`,
`docs/database.md` e `docs/code-map.md` atualizados). Rotas verificadas só com `app.inject` — a chamada HTTP real
fica para o passo 7. Passo 3 (`types/projectInfo.ts`, `services/projectInfoService.ts`,
`hooks/useProjectInfos.ts`, `PROJECT_001-003` em `errorMessages.ts`; `tsc -b` e `eslint .` com 0 erros). Passo 4
(`pages/ProjectsPage.tsx`, `components/projects/{ProjectCard,projectInfoFormat,hosting}`, rota `/projects`, item
"Projetos" na nav, `goProjects` no catálogo; verificado no browser com `scripts/verify/projects-page.mjs`, 27/27,
numa instância descartável).
**Em curso:** —
**Próxima ação concreta:** passo 5 — `components/projects/{ProjectInfoDrawer,ProjectInfoForm,EnvironmentFields,projectInfoFormSchema}`.
Fazer o cartão clicável (hoje não é: `ProjectCard` só mostra) e a página abrir o drawer; ela já tem de aceitar
`location.state.projectPath`. Falta também o botão **Adicionar informação** no cartão "Sem informação". `hosting.ts` já
tem `hostingOptions(infos)` para o `AutoComplete`; `useProjectInfos` devolve `save`/`remove`/`registerDeploy`/`removeDeploy`
(a ficha nova, ou `null`/`false` se falharam — o erro já foi notificado). Ler `design/drawers-and-modals.md` e
`design/forms-and-validation.md`; invocar `frontend-design-system` e `frontend-error-handling`. Para verificar, o mesmo
processo: `npm run build` no frontend, `node scripts/verify/instance.mjs start --fresh`, um cenário novo em `scripts/verify/`.
**Desvios ao plano:** `emptyState()` ganhou `projectInfos: []` (o teste do estado vazio foi ajustado). O
`tsc --noEmit` do backend já tinha 1 erro anterior em `test/auth.test.ts:40` (tipos do WebSocket), não
relacionado. O passo 4 não corre testes unitários dos helpers (`lastDeploy`, `primaryEnvironment`, `relativeDeploy`):
o frontend não tem runner; ficam cobertos pelo cenário do browser ("há 3 dias", último deploy, ambiente primário).
Os chips de ciclo de vida mostram contagens, e o ciclo de vida usa a etiqueta neutra (só "Em produção" leva o acento,
porque as cores de estado são dos terminais).
**O que uma sessão nova precisa de saber:**
- O dono quer, no futuro, um ícone ⓘ em cada separador de projeto (`ProjectTabs`) que abre esta ficha
  **na mesma página de Projetos**. Fica de fora desta feature (§2) mas a página deve aceitar
  `location.state.projectPath`.
- O primeiro caso de uso real é o **Worksite** (`...\utad\projetos\Worksite\Worksite`, "em produção"). Os
  8 projetos do registo estão em `C:\Users\jlalv\Desktop\Workflow\Workflow\projects\INDEX.md`.
- O `state.json` só é escrito pelo backend, por `StateStore.update(recipe)` (fila + escrita atómica,
  [[../adr/0009-estado-em-ficheiro-json]]). Não escrever no ficheiro por outra via.
- Esta feature **não** faz nenhum pedido aos URLs guardados. Se alguém pedir ping, é ADR novo.

## 7. Perguntas em aberto

| Pergunta | Bloqueia | Notas |
|---|---|---|
| Custo mensal só em EUR serve? (há hosting cobrado em USD) | Não | Assumido EUR; se aparecer custo em USD, ADR/migração para `{amount, currency}` |
| O dono quer um aviso quando a renovação do domínio estiver perto? | Não | 2ª fase; o campo `renewsAt` já fica guardado |
| Os URLs de health check servem para quê se não há ping? | Não | Ficam guardados para a 2ª fase (ping) e como link rápido |

## Relacionado

[[skill-plan-feature]] · [[skill-implement-todo]] · [[../adr/README]] ·
[[../adr/0028-informacao-de-deploy-por-projeto]] · [[../adr/0009-estado-em-ficheiro-json]] ·
[[../adr/0005-biblioteca-lida-do-disco]] · [[separadores-de-projetos]] · [[../database]]
