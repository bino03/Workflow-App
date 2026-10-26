# Feature: Upwork — candidaturas com pacote gerado, até passarem a projeto

| | |
|---|---|
| **Estado** | 📋 Planeada |
| **Criada** | 2026-10-26 |
| **Última sessão** | 2026-10-26 |
| **Passos** | 0 / 11 concluídos |

> Escrita para uma sessão que **não viu a conversa que a originou**. Se algo só faz sentido com contexto
> externo, falta escrevê-lo.

Nasceu do pedido do dono (2026-10-26, `/plan-feature`): "criar uma secção na minha aplicação dedicada à
Upwork […] eu quero candidatar-me a um trabalho, eu coloco a descrição, crio um novo projeto, tu crias-me logo
o necessário para enviar, ou seja, uma mensagem para me candidatar, o que é que preciso e tudo mais." E na
entrevista: "só deve chamar o /create se a candidatura for aceite; o processo de criar uma candidatura deve ser
uma skill à parte, apenas dedicada a isto."

Há **dois repositórios** envolvidos:
- **App** — este.
- **Workflow** — `WORKFLOW_PATH` (`C:\Users\jlalv\Desktop\Workflow\Workflow` nesta máquina), com o seu git,
  `CLAUDE.md`, ADRs (o próximo livre é o **0012**) e skills (`docs/skills/skill-*.md` + ponteiro
  `.claude/skills/<nome>/SKILL.md`). A skill nova vive lá. Ler o `CLAUDE.md` do Workflow antes de lhe mexer.

**Base que já existe e se reutiliza**: as sessões guiadas ([[../adr/0020-sessoes-guiadas|ADR 0020]],
[[novo-projeto-guiado]]) — terminal `hidden`, hooks bloqueantes, perguntas em cartões, permissões
Permitir/Recusar, conversa lida do `.jsonl`, caixa de texto, modo Perguntar/Automático
([[../adr/0021-permissoes-das-sessoes-guiadas|ADR 0021]]). E o ecrã **Novo projeto** (`/api/creations`), que
é o fim do caminho de uma candidatura ganha.

---

## Contexto: como funciona a Upwork (pesquisa de 2026-10-26)

O que a feature tem de respeitar, do lado do freelancer:

1. **Perfil** — título, resumo, competências, portefólio (a Upwork diz que perfis com portefólio são
   contratados ~9× mais), tarifa horária. O dono **está a começar: 0 reviews, sem Job Success Score** — as
   propostas têm de compensar com portefólio e projetos próprios.
2. **Anúncio (job post)** — descrição, preço fixo ou à hora, nível de experiência, por vezes **perguntas de
   triagem** (screening questions), e dados do cliente (pagamento verificado, gasto total, taxa de contratação,
   país). Também há **convites** diretos.
3. **Proposta** — custa **Connects** (~$0,15 cada; 1–16 por job conforme o job; 10 grátis/mês na conta Basic).
   Tem: carta (o cliente vê só as **2–3 primeiras linhas** na lista; 200–300 palavras é o recomendado), respostas
   às perguntas de triagem (o cliente lê-as **antes** da carta), valor (fixo + milestones, ou tarifa), anexos.
   Opcional: **Boost** — leilão de Connects pelos 4 primeiros lugares; só cobrado se ficar no top 4 ou o cliente
   interagir.
4. **Entrevista** — mensagens/chamada com o cliente; depois **oferta**, que se aceita ou recusa.
5. **Contrato** — preço fixo: cada milestone financiada em escrow, entrega por *Submit work*, 14 dias para o
   cliente aprovar; só há proteção com a milestone financiada e a entrega pela plataforma. À hora: Work Diary,
   faturado à segunda. (2.ª fase desta feature.)
6. **Fim** — fecho do contrato, feedback público dos dois lados → Job Success Score. Taxa de serviço variável
   (0–15% por contrato).

**Regra que molda tudo: a Upwork proíbe automação fora da API aprovada** — scraping, extensões que fazem
pesquisas ou vigiam páginas, envio automático de propostas → aviso, restrição ou bloqueio da conta. Escrever
com IA e o **humano rever e enviar** é aceite. Por isso **a app nunca fala com a Upwork**: o dono cola o anúncio
e copia o resultado à mão.

Fontes: [Upwork — usar bots e automação](https://support.upwork.com/hc/en-us/articles/43342677368467-Use-bots-and-other-automation-properly) ·
[Upwork — proteção de pagamento](https://www.upwork.com/resources/understanding-freelancer-payment-protection) ·
[Upwork — cover letter tips](https://www.upwork.com/resources/cover-letter-tips) ·
[getmany — Connects](https://getmany.com/blog/upwork-connects) · [upcat — Boost](https://upcat.app/upwork-boosted-proposals/) ·
[freelancercalculator — taxas 2026](https://freelancercalculator.com/upwork-fees-2026/). Valores de terceiros
(Connects, taxas) podem mudar — a feature não depende deles.

## 1. O que é e porquê

Candidatar-se a um job na Upwork é sempre o mesmo trabalho: ler o anúncio, decidir se vale os Connects,
escrever uma carta que prenda nas primeiras linhas, responder às perguntas de triagem, pensar na abordagem
técnica e no que perguntar ao cliente — e depois acompanhar a conversa até à oferta. Para quem está a começar,
sem reviews, a qualidade de cada proposta é tudo. Hoje faz-se à mão ou numa conversa solta, sem registo do que
se enviou a quem nem em que estado está cada candidatura. E quando um job é ganho, o projeto começa do zero.

A secção **Upwork** junta isso: cola-se o anúncio, uma skill dedicada do Workflow gera o **pacote de
candidatura**, a candidatura fica numa lista com estado, a mesma conversa ajuda nas mensagens com o cliente, e
quando é **aceite** — só então — passa a projeto pelo `/create` guiado, já com o anúncio, a proposta e o acordo
como brief.

**Como sei que está bem feito:** abro **Upwork**, carrego **+ Nova candidatura**, colo o anúncio de um job
("React dashboard for a logistics startup…") e as duas perguntas de triagem, e carrego **Gerar**. Em menos de
um minuto aparece a **análise** em português — "Vale a pena: sim. Cliente com pagamento verificado e 12
contratações; âmbito claro; o teu projeto Estante mostra exatamente isto. Atenção: prazo de 1 semana é
apertado" — e logo a seguir a **carta** em inglês, as **respostas de triagem**, o **plano técnico** com a
estimativa por partes e **3 perguntas ao cliente**, cada um num cartão com **Copiar**. Copio para a Upwork,
envio lá, e marco **Enviada** (com 12 Connects). Dois dias depois o cliente responde; abro a candidatura, colo a
mensagem dele na conversa e recebo uma resposta proposta, que copio. Marco **Entrevista**, depois **Ganha**;
colo o acordo final (milestones, prazo) e carrego **Criar projeto** — o ecrã Novo projeto abre com o `/create`
a partir daquilo tudo. Nunca abri um terminal nem a app tocou na Upwork.

## 2. Âmbito

### Dentro
- **Página `/upwork`** com entrada **Upwork** na navegação do header (ao lado de Terminais e Biblioteca).
- **Perfil de freelancer** — um Markdown em `DATA_DIR/upwork/profile.md` (fora dos dois repositórios: dados
  pessoais), editado num drawer **Perfil** da página, com um modelo inicial (quem és, título, competências,
  projetos de portefólio com links, disponibilidade, tom, o que nunca prometer). Sem perfil, **Nova
  candidatura** pede para o preencher primeiro.
- **Nova candidatura** — drawer com: anúncio (obrigatório, colado), perguntas de triagem (opcional, uma por
  linha), URL do job (opcional, **só guardado como link** — nunca aberto pela app nem pela skill), e
  **Gerar**. Arranca uma sessão guiada de propósito `upwork` com a skill nova do Workflow.
- **O pacote**, escrito pela skill em ficheiros e mostrado em cartões com **Copiar**:
  - **Análise "vale a pena?"** (em português) — veredicto (candidatar · talvez · não), encaixe com o perfil,
    sinais de alerta (pagamento por verificar, âmbito vago, orçamento irrealista, pedido de trabalho grátis /
    contacto fora da Upwork), e se compensa gastar mais Connects / Boost.
  - **Carta** (na língua do anúncio) — abertura que responde ao problema do cliente nas 2–3 primeiras linhas,
    200–300 palavras, prova a partir do portefólio do perfil **e dos projetos do Workflow**
    (`projects/INDEX.md`), chamada para o próximo passo.
  - **Respostas de triagem** — uma por pergunta, pela ordem colada (língua do anúncio).
  - **Plano técnico** (em português, para o dono) — abordagem/stack e estimativa de esforço por partes, com as
    frases que valem a pena citar na carta.
  - **Perguntas ao cliente** — 2–3, na língua do anúncio, para a proposta ou a entrevista.
- **Rever o pacote pela conversa** ("mais curta", "menos formal", "realça o projeto X") — a skill reescreve os
  ficheiros; os cartões atualizam.
- **Lista de candidaturas com estado**: `Rascunho` (a gerar / gerado) → `Enviada` → `Entrevista` → `Oferta` →
  `Ganha` · `Perdida` · `Retirada`. Mudança **manual**, livre (qualquer estado para qualquer outro), com
  histórico de datas. Campos à mão: Connects gastos, nome do cliente, notas.
- **Ajuda na conversa com o cliente**, na mesma sessão: o dono cola a mensagem do cliente (ou a oferta, ou pede
  "prepara a chamada de amanhã") e a skill propõe a resposta / o guião / a avaliação da oferta. As mensagens do
  Claude na conversa ganham **Copiar**.
- **Sessões que vivem semanas sem ocupar terminais**: ao marcar **Enviada** (e em **Pausar**), o terminal fecha
  e a sessão fica guardada; ao escrever na conversa outra vez, a app **retoma** (`--resume`) sozinha.
- **Criar projeto** — só com o estado `Ganha`: o dono cola o **acordo** (oferta, âmbito e milestones
  combinados, mensagens relevantes), a app compõe o brief (anúncio + carta enviada + plano + acordo) e começa
  uma criação no ecrã **Novo projeto** (`/new-project`). Quando a criação acaba, a candidatura guarda o caminho
  do projeto e mostra **Abrir projeto**.
- **Arquivar** uma candidatura (`Perdida`/`Retirada`/`Ganha` com projeto): fecha a sessão, **guarda o pacote**
  na pasta da candidatura e esconde-a da lista por omissão (filtro "arquivadas").
- **Do lado do Workflow**: skill nova **`/upwork-proposal`** (só candidaturas), com "Modo app" (lê
  `job.md` + `profile.md` da pasta da sessão, escreve o pacote, perguntas por `AskUserQuestion`) e modo terminal
  (o anúncio colado na conversa). ADR 0012 no Workflow.

### ⛔ Fora — não implementar nesta feature
- **Qualquer contacto com a Upwork**: API, login, abrir/ler o URL do job, extensões, enviar propostas, ler
  mensagens. A Upwork proíbe automação fora da API aprovada (ver Contexto). Tudo entra por colar e sai por
  copiar.
- **Preço, milestones e valor líquido depois da taxa.** O dono não os quis na v1: o valor a licitar decide-o ele
  na Upwork. O plano técnico estima **esforço**, não preço.
- **Contrato em curso**: milestones, entregas (*Submit work*), horas, pedidos de alteração, fecho e feedback —
  é a 2.ª fase.
- **Ajuda a montar o perfil da Upwork** (título/resumo do perfil público). O `profile.md` é para a skill, não
  uma cópia do perfil Upwork.
- **Estatísticas** (taxa de resposta, Connects por job ganho, receita).
- **Transições de estado automáticas** ou validadas — o estado é o que o dono diz.
- **Avisos fora do ecrã** (Telegram, notificações) e **lembretes de follow-up**.
- **Várias propostas para o mesmo job**, versões do pacote / histórico de revisões (a conversa é o histórico).
- **Criar projeto sem `Ganha`**, ou o `/create` a correr dentro da sessão da candidatura (é sempre uma criação
  à parte, no ecrã Novo projeto).
- **Layout para telemóvel** (a app é só desktop, [[../adr/0008-identidade-visual|ADR 0008]]).

> Esta lista impede uma sessão futura de expandir o âmbito sozinha.

### Segunda fase (se houver)
- Contrato em curso: milestones da Upwork ↔ passos do projeto criado; mensagem de entrega (*Submit work*) a
  partir do work log do projeto; pedidos de alteração; fecho e pedido de feedback.
- Preço e milestones na proposta, com o valor líquido.
- Estatísticas da secção; aviso no Telegram quando há follow-up a fazer.

## 3. Decisões tomadas

| Decisão | Escolha | Porquê | Alternativa rejeitada |
|---|---|---|---|
| Âmbito da v1 | Candidatura + estados + ajuda na conversa + passar a projeto quando ganha | Escolha do dono | Só candidatura (sem projeto); ciclo completo com contrato (muito maior) |
| Quando corre o `/create` | **Só** com a candidatura em `Ganha`, numa criação à parte (ecrã Novo projeto) | Pedido explícito do dono; uma candidatura não é um projeto até ser aceite | `/create` logo ao candidatar |
| Onde vive a lógica da candidatura | Skill nova e dedicada do Workflow, `/upwork-proposal`, lançada como sessão guiada | Pedido do dono ("skill à parte, só para isto"); a lógica no vault, como o `/create` e o `/import` | Prompt no backend da app; terminal normal |
| Contacto com a Upwork | **Nenhum** — colar e copiar | ToS da Upwork (automação/scraping → bloqueio da conta) | Ler o URL do job; API oficial (exige aprovação; fica fora) |
| Perfil de freelancer | `DATA_DIR/upwork/profile.md`, editado na app, **copiado** para a pasta da sessão no arranque | Dados pessoais fora do git dos dois repositórios; a cópia fixa o que a proposta usou | No vault do Workflow (versionado); perguntar a cada candidatura |
| Prova para quem tem 0 reviews | A skill usa o portefólio do perfil **e** lê `projects/INDEX.md` do Workflow à procura de projetos parecidos | O dono está a começar; os projetos do Workflow são prova real | Só o perfil |
| Conteúdo do pacote | Análise, carta, respostas de triagem, plano técnico, perguntas ao cliente | Escolha do dono | Preço e milestones (não escolhido) |
| Língua | Carta, triagem e perguntas ao cliente **na língua do anúncio**; análise e plano em **português** | Escolha do dono; o cliente lê a dele, o dono lê a sua | Sempre inglês |
| Ajuda na entrevista | Na **mesma sessão** guiada, retomada quando o dono escreve | Escolha do dono; reaproveita o contexto do job e do que foi enviado | Mudar só o estado à mão (2.ª fase) |
| Brief do `/create` | Anúncio + carta enviada + plano + **acordo colado** ao marcar Ganha | Escolha do dono; a negociação muda o âmbito | Só o anúncio |
| Sessão de candidatura vs. `result.json` | O propósito `upwork` **não acaba** com um resultado: o pacote é um conjunto de ficheiros + `package.json` (manifesto), e a sessão continua a aceitar texto | Hoje um `result.json` põe a sessão em `done` e o `/message` recusa (`GUIDED_003`) — a conversa com o cliente precisa de continuar | Uma sessão guiada nova por cada mensagem do cliente (perde o contexto) |
| Terminais ocupados | Ao marcar `Enviada` e em **Pausar**, o terminal fecha (a sessão fica, `stopped`); escrever na conversa retoma-a sozinha | Uma candidatura vive semanas; `MAX_TERMINALS` é 8 | Terminal sempre aberto |
| Várias candidaturas | Várias abertas ao mesmo tempo; **a gerar** (terminal a correr) até ao limite de terminais | Candidatar-se é em volume; o limite real é o dos terminais | Uma de cada vez, como a criação |
| Onde vive na UI | Página própria `/upwork` + entrada no header | A lista e o pacote precisam de espaço; é uma secção, não uma ação | Drawer sobre os Terminais |
| Estado da candidatura | Manual e livre, com histórico | O que acontece na Upwork a app não vê | Máquina de estados validada |

**ADRs gerados** (escritos no passo 1, não agora):
- **App — ADR 0022** "Secção Upwork: candidaturas como sessões guiadas longas, sem contacto com a Upwork":
  nenhum acesso à Upwork (ToS), propósito guiado `upwork` sem fim por `result.json`, pausar/retomar
  automático, dados em `DATA_DIR/upwork/`, criar projeto só com `Ganha` (complementa 0020, 0021, 0012, 0009).
- **Workflow — ADR 0012** "`/upwork-proposal`: a skill de candidaturas": o que gera, o contrato de ficheiros
  com a app (`job.md`, `profile.md`, `package.json`), as regras (nunca abrir o URL, nunca inventar experiência,
  língua do anúncio), e que é a única skill do Workflow fora do ciclo de projetos.

## 4. Desenho técnico

### 4.1 Dados

Sem base de dados ([[../adr/0009-estado-em-ficheiro-json|ADR 0009]]). Tudo em `DATA_DIR/upwork/`:

| Ficheiro | Quem escreve | O quê |
|---|---|---|
| `profile.md` | backend (rota do perfil) | O perfil do dono, Markdown, ≤ 20 000 caracteres |
| `applications/<appId>/application.json` | **só o backend** | O registo (abaixo) |
| `applications/<appId>/package/*` | backend, ao **arquivar** | Cópia final do pacote (a pasta da sessão guiada é apagada) |

`application.json` (zod em `backend/src/upwork/upwork.schemas.ts`, escrito com `atomicWrite`):

```ts
{
  version: 1,
  id: string,                    // UUID
  title: string,                 // do package.json quando chega; até lá, 1.ª linha do anúncio (≤ 120)
  url: string | null,            // só https://www.upwork.com/…; nunca aberto pelo backend
  clientName: string | null,
  status: 'draft' | 'sent' | 'interview' | 'offer' | 'won' | 'lost' | 'withdrawn',
  history: { status, at }[],     // cada mudança, com data ISO
  connectsSpent: number | null,  // 0–500
  notes: string,                 // ≤ 8000
  guidedId: string | null,       // a sessão da candidatura; null depois de arquivada
  agreement: string | null,      // o acordo colado ao criar o projeto
  creationGuidedId: string | null, // a criação começada a partir daqui
  projectPath: string | null,    // do result.json da criação, quando acaba
  archived: boolean,
  createdAt: string, updatedAt: string
}
```

**A sessão guiada da candidatura** (`DATA_DIR/guided/<guidedId>/`, ADR 0020) ganha, para o propósito `upwork`:

| Ficheiro | Quem escreve | O quê |
|---|---|---|
| `job.md` | backend, no arranque | Ficheiro de entrada: o anúncio verbatim, as perguntas de triagem numeradas, o URL (como texto), e o `appId` |
| `profile.md` | backend, no arranque | Cópia do `DATA_DIR/upwork/profile.md` desse momento |
| `package.json` | skill | Manifesto: `{version: 1, title, language, verdict: 'apply'\|'maybe'\|'skip', updatedAt, files: {analysis, coverLetter, screening, plan, clientQuestions}}` — nomes de ficheiros **dentro** da pasta; reescrito a cada revisão |
| `analysis.md`, `cover-letter.md`, `screening.md`, `plan.md`, `client-questions.md` | skill | O pacote. `screening.md` com `## 1. <pergunta>` + resposta, pela ordem do `job.md` |

O estado da sessão continua derivado (ADR 0020). **Mudança no `GuidedService`**: para o propósito `upwork` o
`result.json` é ignorado (não existe); `stopped` com a sessão guardada é normal, não um erro.

### 4.2 Endpoints

Todos com sessão obrigatória (`AUTH_002`), como as outras rotas ([[../security]]).

| Método | Rota | Corpo | Resposta | Erros |
|---|---|---|---|---|
| GET | `/api/upwork/profile` | — | `200 {markdown, updatedAt \| null}` — modelo inicial se não existe | `AUTH_002` |
| PUT | `/api/upwork/profile` | `{markdown}` (1–20 000) | `200 {markdown, updatedAt}` | `AUTH_002` · `COMMON_001` |
| GET | `/api/upwork/applications?archived=<bool>` | — | `200 ApplicationView[]` (mais recente primeiro; omissão `archived=false`) | `AUTH_002` |
| POST | `/api/upwork/applications` | `{job (1–20 000), screeningQuestions: string[] (≤ 15, cada ≤ 1000), url?}` | `201 ApplicationView` — cria o registo **e** a sessão guiada `upwork` | `AUTH_002` · `COMMON_001` · `UPWORK_002` · `LIBRARY_001` · `TERMINAL_002` · `TERMINAL_005` · `TERMINAL_007` |
| GET | `/api/upwork/applications/:id` | — | `200 ApplicationView` (com `guided: GuidedView \| null` e `package`) | `AUTH_002` · `UPWORK_001` |
| PATCH | `/api/upwork/applications/:id` | `{status?, clientName?, connectsSpent?, notes?, url?}` | `200 ApplicationView` — `status` → acrescenta ao histórico; `sent` → pausa a sessão | `AUTH_002` · `COMMON_001` · `UPWORK_001` · `UPWORK_004` |
| POST | `/api/upwork/applications/:id/pause` | — | `200 ApplicationView` — fecha o terminal, mantém a sessão | `AUTH_002` · `UPWORK_001` |
| POST | `/api/upwork/applications/:id/message` | `{text}` (1–8000) | `204` — se a sessão está `stopped`, **retoma-a** (`--resume`) e espera pelo `waiting-text` antes de escrever; senão igual ao `/api/guided/:id/message` | `AUTH_002` · `COMMON_001` · `UPWORK_001` · `UPWORK_005` · `GUIDED_004` · `TERMINAL_*` |
| POST | `/api/upwork/applications/:id/project` | `{agreement}` (1–20 000) | `201 GuidedView` (a criação) — só com `status: 'won'` | `AUTH_002` · `COMMON_001` · `UPWORK_001` · `UPWORK_003` · `UPWORK_004` · `CREATE_001` · `TERMINAL_*` |
| POST | `/api/upwork/applications/:id/archive` | — | `200 ApplicationView` — copia o pacote para `package/`, fecha e apaga a sessão guiada | `AUTH_002` · `UPWORK_001` |
| DELETE | `/api/upwork/applications/:id` | — | `204` — apaga o registo e a sessão | `AUTH_002` · `UPWORK_001` |

As perguntas (`AskUserQuestion`), permissões, o feed e o modo continuam nas rotas genéricas
`/api/guided/:guidedId/*` (já existem).

**Brief do `/create`** (`/project`): o backend compõe um Markdown — "Projeto ganho na Upwork" + anúncio + carta
enviada + plano técnico + acordo — e chama o `CreationService` **por dentro** (o limite de 8000 do corpo HTTP
de `/api/creations` não se aplica; o do ficheiro fica em 60 000). Guarda o `creationGuidedId`; ao ler a
candidatura, se essa criação tem `result.projectPath`, copia-o para `projectPath`.

### 4.3 Tipos / DTOs

- `ApplicationView` = `application.json` sem `version` + `guided: GuidedView | null` + `package: PackageView | null`.
- `PackageView` = `{title, language, verdict, updatedAt, analysis, coverLetter, screening, plan, clientQuestions}`
  (cada um o Markdown lido do ficheiro, ≤ 50 000; ficheiro em falta → `null`). `package.json` inválido → `null` +
  `packageError` com o campo (como o `result.json` inválido).
- Frontend: `frontend/src/types/upwork.ts` espelha-os.

### 4.4 Interface
- **Onde vive**: `frontend/src/pages/UpworkPage.tsx` (`/upwork`), entrada **Upwork** em `AppLayout.tsx`.
- **Layout**: à esquerda a lista (título, cliente, estado como etiqueta, veredicto, data) com filtro por estado e
  "arquivadas"; à direita a candidatura aberta, com separadores **Pacote** (cartões Análise / Carta / Triagem /
  Plano / Perguntas, cada um com **Copiar**; enquanto gera, os cartões em espera e a conversa visível) ·
  **Conversa** (o `GuidedFeed` + `QuestionCard`/`PermissionCard`/`ReplyBox` que já existem, com **Copiar** nas
  mensagens do Claude) · **Dados** (estado com histórico, cliente, Connects, URL como link externo, notas). No
  cabeçalho: estado, **Pausar**, **Criar projeto** (só `Ganha`), **Abrir projeto** (com `projectPath`),
  **Arquivar**, Permissões Perguntar/Automático.
- **Ficheiros**: `components/upwork/{ApplicationList,ApplicationDetail,PackageCards,ApplicationDataForm,NewApplicationDrawer,ProfileDrawer,CreateProjectModal}.tsx`, `hooks/useUpworkApplications.ts`, `services/upworkService.ts`.
- **Estado vazio**: sem perfil → "Preenche o teu perfil primeiro" + **Perfil**; sem candidaturas → "Cola um
  anúncio da Upwork para começar" + **+ Nova candidatura**.
- **Visibilidade por role**: um só utilizador.
- Convenções visuais: [[../skills/references/frontend-visual-consistency]] (tokens, ADR 0008). Ler
  `docs/skills/references/design/guided-session.md` antes de mexer nos cartões.

### 4.5 Códigos de erro novos
| Código | HTTP | Mensagem no frontend |
|---|---|---|
| `UPWORK_001` | 404 | A candidatura não existe. |
| `UPWORK_002` | 409 | Preenche o teu perfil antes da primeira candidatura. |
| `UPWORK_003` | 409 | Só se cria projeto a partir de uma candidatura ganha. |
| `UPWORK_004` | 409 | A candidatura está arquivada. |
| `UPWORK_005` | 409 | A sessão desta candidatura já não existe (arquivada) — não dá para continuar a conversa. |

## 5. Passos

Ordem obrigatória. Tiers: `opus` (desenho, não delegar) · `sonnet` (implementação) · `haiku` (mecânico).

- [ ] **1. ADRs (app 0022, Workflow 0012)**
  - Ficheiros: `docs/adr/0022-seccao-upwork.md`, `docs/adr/README.md`; no Workflow `docs/adr/0012-upwork-proposal.md` + o seu `README.md`
  - Skill: `engineering:architecture` (formato dos ADRs existentes, ex. 0020)
  - Tier: `opus`
  - Aceite quando: os dois ADRs escritos com contexto, opções (as rejeitadas do §3), decisão e consequências; listados nos índices.

- [ ] **2. Skill `/upwork-proposal` no Workflow**
  - Ficheiros: Workflow `docs/skills/skill-upwork-proposal.md`, `.claude/skills/upwork-proposal/SKILL.md`, `docs/skills/SKILLS-INDEX.md`, a allowlist `.claude/settings.json` (ler `projects/INDEX.md`)
  - Skill: `create-new-skill` do Workflow (`docs/skills/skill-create-new-skill.md`)
  - Tier: `opus` — o conteúdo da carta é o produto
  - Conteúdo mínimo: **modo app** (`--app <…/job.md>`): ler `job.md` e `profile.md` da mesma pasta e `projects/INDEX.md`; se faltar algo decisivo, **uma** `AskUserQuestion` (ex. "qual destes projetos mostras?"); escrever os 5 ficheiros + `package.json` (contrato §4.1); depois de cada pedido de revisão, reescrever só os ficheiros afetados e o `package.json`; mensagens do cliente coladas → resposta proposta em Markdown na conversa (não em ficheiro). **Modo terminal**: anúncio colado na conversa, pacote em Markdown. Regras: nunca abrir o URL nem nenhum site da Upwork; nunca inventar experiência, clientes ou números que não estão no perfil/projetos; língua do anúncio para o que vai ao cliente, português para análise/plano; carta 200–300 palavras com o gancho nas 2 primeiras linhas; nunca sugerir contacto/pagamento fora da Upwork.
  - Aceite quando: num terminal do Workflow, `/upwork-proposal` com um anúncio real colado produz as 5 partes; em modo app com uma pasta de teste (`job.md` + `profile.md`) escreve os 6 ficheiros e um `package.json` válido; commit no Workflow.

- [ ] **3. Propósito guiado `upwork` sem fim por resultado**
  - Ficheiros: `backend/src/terminals/claudeArgs.ts` (`GUIDED_COMMANDS.upwork = {command: '/upwork-proposal --app', inputFile: 'job.md'}`), `backend/src/guided/guided.schemas.ts` (`guidedPurposeSchema`), `backend/src/guided/guidedService.ts` (`start` aceita ficheiros extra — `profile.md`; a derivação de estado ignora `result.json` para `upwork`; método `suspend(id)` = fechar o terminal sem apagar a pasta), `backend/test/{claudeArgs,guidedService}.test.ts`
  - Skill: nenhuma de backend no projeto — seguir [[../backend-conventions]] e [[../skills/references/code-best-practices|code-best-practices]]
  - Tier: `sonnet`
  - Aceite quando: testes novos — os argumentos de `upwork` com o caminho validado; uma sessão `upwork` com `result.json` na pasta continua `waiting-text`; `suspend` deixa `stopped` e o `resume` volta a `waiting-text`; os testes de `create` passam sem mudanças.

- [ ] **4. Módulo `upwork` no backend: perfil e registo**
  - Ficheiros: `backend/src/upwork/{upwork.schemas,upworkFiles,upworkService,upwork.routes}.ts`, `backend/src/app.ts`, `backend/src/common/errors.ts` (`UPWORK_001`–`005`), `backend/test/upwork.routes.test.ts`
  - Skill: nenhuma de backend no projeto — seguir [[../backend-conventions]]
  - Tier: `sonnet`
  - Aceite quando: GET/PUT do perfil (com o modelo inicial), POST cria registo + sessão guiada (com `GuidedService` real e o `claude` falso dos testes), GET lista/um, PATCH com histórico, `UPWORK_002` sem perfil, `url` que não é `https://www.upwork.com/` → `COMMON_001`; `npm test` verde.

- [ ] **5. Pacote, conversa retomada, pausa, arquivo**
  - Ficheiros: `backend/src/upwork/{upworkService,upwork.routes,packageReader}.ts`, `backend/test/{upworkService,upwork.routes}.test.ts`
  - Skill: nenhuma de backend no projeto — seguir [[../backend-conventions]]
  - Tier: `sonnet`
  - Aceite quando: `package` lido do `package.json` (inválido → `packageError`; nomes de ficheiro fora da pasta recusados); `PATCH status: 'sent'` pausa; `/message` numa sessão `stopped` retoma e escreve depois do `waiting-text`; `/archive` copia o pacote para `applications/<id>/package/` e apaga a sessão guiada; `DELETE` apaga tudo.

- [ ] **6. Criar projeto a partir de uma candidatura ganha**
  - Ficheiros: `backend/src/upwork/upworkService.ts`, `backend/src/creation/creationService.ts` (aceitar uma descrição interna até 60 000), `backend/test/upwork.routes.test.ts`
  - Skill: nenhuma de backend no projeto — seguir [[../backend-conventions]]
  - Tier: `sonnet`
  - Aceite quando: sem `won` → `UPWORK_003`; com `won` grava `agreement`, compõe o brief (as 4 partes, por esta ordem) e começa uma criação (`CREATE_001` se já há uma); quando o `result.json` da criação tem `projectPath`, a candidatura passa a tê-lo.

- [ ] **7. Frontend: tipos, serviço, hook, página e navegação**
  - Ficheiros: `frontend/src/types/upwork.ts`, `frontend/src/services/upworkService.ts`, `frontend/src/hooks/useUpworkApplications.ts`, `frontend/src/pages/UpworkPage.tsx`, `frontend/src/components/upwork/ApplicationList.tsx`, `frontend/src/main.tsx`, `frontend/src/layouts/AppLayout.tsx`, `frontend/src/errors/errorMessages.ts`
  - Skill: `frontend-design-system` + `frontend-error-handling`
  - Tier: `sonnet`
  - Aceite quando: `/upwork` no header; lista com filtro por estado e "arquivadas"; os dois estados vazios; `tsc -b` e lint limpos.

- [ ] **8. Perfil e Nova candidatura**
  - Ficheiros: `frontend/src/components/upwork/{ProfileDrawer,NewApplicationDrawer}.tsx` (+ schemas zod ao lado)
  - Skill: `frontend-design-system` (padrão Drawer, React Hook Form + Zod)
  - Tier: `sonnet`
  - Aceite quando: o perfil grava e reabre; Nova candidatura sem perfil leva ao Perfil; com perfil cria e abre a candidatura a gerar.

- [ ] **9. Detalhe: Pacote, Conversa, Dados**
  - Ficheiros: `frontend/src/components/upwork/{ApplicationDetail,PackageCards,ApplicationDataForm,CreateProjectModal}.tsx`, `frontend/src/components/guided/GuidedFeed.tsx` (botão **Copiar** nas mensagens do Claude), `docs/skills/references/design/guided-session.md` (se o Copiar for padrão novo)
  - Skill: `frontend-design-system`
  - Tier: `sonnet`
  - Aceite quando: cartões com Copiar (copiam o Markdown cru); os cartões atualizam depois de uma revisão; Conversa reaproveita os componentes guiados; Dados com histórico; Pausar/Arquivar/Criar projeto (só `Ganha`)/Abrir projeto; Criar projeto leva a `/new-project` com a criação a correr.

- [ ] **10. Verificação no browser com a skill simulada + docs**
  - Ficheiros: cenário em scratchpad com `scripts/verify/instance.mjs` (skill simulada que escreve um pacote fixo); docs `api`, `database`, `security`, `architecture`, `code-map`, `product/use-cases`, `product/overview` (Fora de âmbito), `00-INDEX` se preciso
  - Skill: [[testing-and-verification]] · [[../commands]] → verificação
  - Tier: `sonnet` (a verificação corre **inline**, nunca num subagente)
  - Aceite quando: o caminho do "Como sei que está bem feito" passa todo com a skill simulada (pacote, Enviada pausa, mensagem retoma, Ganha → Criar projeto abre `/new-project`, Arquivar), consola limpa; docs atualizados; `notes/whatIveDone.md`.

- [ ] **11. Com o dono: candidatura real**
  - Ficheiros: — (só `docs/features/upwork.md` §6 e `notes/whatIveDone.md`)
  - Skill: `run`
  - Tier: `opus`
  - Aceite quando: com o `/upwork-proposal` real e um anúncio verdadeiro escolhido pelo dono, o pacote sai completo, o dono acha a carta enviável (ajustes vão para a skill no Workflow), e uma mensagem de cliente colada recebe resposta.

## 6. Estado atual

> ⚠️ **Atualizar SEMPRE no fim de cada sessão.** É a secção que torna esta spec retomável.

**Feito:** nada (spec escrita a 2026-10-26).
**Em curso:** —
**Próxima ação concreta:** passo 1 — ler `docs/adr/0020-sessoes-guiadas.md` e `0021`, escrever `docs/adr/0022-seccao-upwork.md`.
**Desvios ao plano:** —
**O que uma sessão nova precisa de saber:** a base é a das sessões guiadas (ADR 0020/0021, código em
`backend/src/guided/`, UI em `frontend/src/components/guided/`). Hoje `result.json` acaba uma sessão (`done`) e o
`/message` recusa sessões `done`/`stopped` — o passo 3 muda isso **só** para `upwork`. Regra de ouro: nada na app
nem na skill abre a Upwork. Não editar o backend a partir de um terminal servido por ele em `npm run dev`
(CLAUDE.md, regra 8).

## 7. Perguntas em aberto

| Pergunta | Bloqueia | Notas |
|---|---|---|
| O modelo inicial do `profile.md` — que secções exatamente? | Passo 4 (modelo) e 2 (o que a skill lê) | Proposta: Quem sou · Título · Competências · Projetos (nome, o que fiz, link) · Disponibilidade · Tom · Nunca prometer. Confirmar com o dono no passo 2 |
| Quanto tempo esperar pelo `waiting-text` ao retomar antes de escrever (`/message` numa sessão parada)? | Passo 5 | Medir: o `--resume` de uma conversa longa. Se passar o limite, devolver `GUIDED_004` e a UI tenta de novo |
| A skill deve propor quantos Connects/Boost em números, ou só "vale / não vale"? | Passo 2 | A pesquisa dá ~$0,15/Connect e Boost só cobrado no top 4; os valores mudam. Default: só qualitativo |

## Relacionado

[[novo-projeto-guiado]] · [[../adr/0020-sessoes-guiadas]] · [[../adr/0021-permissoes-das-sessoes-guiadas]] ·
[[skill-plan-feature]] · [[skill-implement-todo]] · [[../adr/README]]
