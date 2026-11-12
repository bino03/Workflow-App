# 🔁 Feedback ao Workflow — dúvidas sobre o que veio herdado

**O que foi herdado e atrapalhou.** Este vault foi gerado pelo Workflow ([[provenance]]); quando um
ficheiro, skill, referência ou regra que veio de lá confunde, contradiz outro, não se aplica ou falta,
regista-se aqui. O Workflow lê este ficheiro com `/absorb-feedback` e corrige a **origem**, para o próximo
projeto não tropeçar no mesmo.

**Não é para**: armadilhas de ferramentas (→ [[learning]]), bugs da app (→ [[bugs]]), práticas boas que este
projeto inventou (→ `/harvest-project` no Workflow).

**Quem escreve aqui**: o Claude, no momento em que tropeça (regra no `CLAUDE.md`) · `/implement-todo` Fase 7
· tu.

## Formato

```
- **AAAA-MM-DD — <resumo numa linha>** · `<ficheiro deste vault>` · tipo: ambíguo | errado | falta | sobra | placeholder
  - O que aconteceu: <o que se estava a fazer e onde encalhou>
  - Como se resolveu: <a resposta encontrada, ou "por resolver"> — é muitas vezes o próprio patch
```

`tipo`: **ambíguo** (dá para ler de duas maneiras) · **errado** (contradiz o código, a stack ou outro doc) ·
**falta** (precisava de uma instrução que não existe) · **sobra** (não se aplica a este projeto) ·
**placeholder** (ficou um marcador ou texto de molde por preencher).

---

## Abertas

- **2026-10-26 — O `/plan-feature` pede "a skill a seguir" em cada passo, mas o projeto não tem skill de backend** · `docs/skills/process/skill-plan-feature.md` (Passo 4) · tipo: falta
  - O que aconteceu: ao partir a spec `upwork` em passos, os de backend (Fastify) não tinham skill — o SKILLS-INDEX só tem skills de frontend e de processo (a stack `node-fastify` foi criada na hora pelo `/create`, sem `add-backend-feature`).
  - Como se resolveu: os passos de backend apontam para `docs/backend-conventions.md`; uma skill de backend fica por criar quando o padrão se repetir (`/create-new-skill`).

- **2026-10-25 — O `drawers-and-modals.md` põe "importar" na lista dos Modals, contra "nunca um formulário num Modal"** · `docs/skills/references/design/drawers-and-modals.md` (secção "Modals — só utilitários curtos") · tipo: ambíguo
  - O que aconteceu: ao desenhar o drawer **Importar** da Biblioteca (um pedido com campos que mudam com o tipo e
    a origem), a lista de Modals dizia "importar, exportar em passos" — lido à letra, era um Modal; a regra logo a
    seguir proíbe formulários completos de entidade em Modals.
  - Como se resolveu: ficou Drawer, com uma nota no próprio doc — "importar" ali é importar um ficheiro de dados em
    passos (escolher, pré-visualizar, confirmar), não um pedido com formulário. Na origem convinha dizê-lo.

- **2026-10-23 — O `operations.md` dá o Playwright como via das regressões no browser, mas nada o instala nem o usa** · `docs/operations.md` ("Testes no browser" e pré-requisitos do deploy) · tipo: errado
  - O que aconteceu: ao passar o driver de verificação a `scripts/verify/`, o doc herdado dizia "Regressões e fluxos críticos → Playwright headless" e "Playwright instalado nos projetos que o usem", enquanto este projeto fez todas as verificações (mais de 10 sessões) com Chrome headless por CDP direto, sem dependências — o `testing-and-verification.md` também não fala de Playwright. Uma sessão nova lê o `operations.md` e procura um Playwright que não existe.
  - Como se resolveu: nota na linha da tabela a apontar para `scripts/verify/` ([[../docs/commands|commands]] → "Verificação no browser"). Na origem: o `operations.md` (ou o `testing-and-verification.md`) devia dizer que a ferramenta headless é uma escolha do projeto, e o `/implement-todo`/`run` apontar para onde o projeto guarda o seu driver.

## Tratadas pelo Workflow

<!-- O /absorb-feedback move para aqui as entradas que tratou, com "✅ <commit do Workflow>" ou "➖ não muda nada: <razão>". -->

- ✅ 48e838b · **2026-09-30 — a `verify-in-browser` assume a extensão do Chrome, que já falhou 4 sessões seguidas** · `docs/skills/references/design/*` e a skill `verify-in-browser` da biblioteca · tipo: falta
  - O que aconteceu: a skill (que este projeto nem chegou a importar) diz "através da extensão Claude in Chrome" e não tem plano B. A extensão falha com `"No group with id"` desde 2026-09-28 — 4 sessões, 3 delas acabaram com a verificação adiada para o dono. O que bloqueava não era só a extensão: era também o login precisar da password real, que a skill não resolve.
  - Como se resolveu: duas voltas, ambas reutilizáveis e agora no [[learning]] — (1) driver CDP de ~120 linhas sobre o `WebSocket` global do Node (`chrome.exe --headless=new --remote-debugging-port`); (2) **uma segunda instância do backend com `APP_PASSWORD_HASH` gerado na hora** e `WORKFLOW_PATH`/`DATA_DIR` próprios, a servir a SPA do `frontend/dist` — login a sério sem password nenhuma do dono, e o fluxo destrutivo a correr contra uma cópia dos dados. Deu 39/39. **Sugestão para a origem**: a `verify-in-browser` devia ter estas duas voltas como caminho alternativo, não como último recurso.

- ✅ 48e838b · **2026-09-30 — "Formulários sempre Zod + React Hook Form" não cobre um drawer sem campos de texto** · `docs/skills/frontend/skill-frontend-design-system.md` (regra 5) e `design/forms-and-validation.md` (§1) · tipo: ambíguo
  - O que aconteceu: o drawer de upload de skills tem um `Select` e um ficheiro, e mais nada. A regra diz "sempre", mas não há nada para validar do lado do cliente — o que torna o ficheiro válido está *dentro* dele e quem decide é o backend. Montar RHF + zodResolver à volta de `{stackId, file}` era cerimónia sem ganho.
  - Como se resolveu: estado local, botão `disabled` enquanto faltar um dos dois, e a justificação escrita no componente e em `design/forms-and-validation.md` §4.1. **Sugestão para a origem**: a regra devia dizer "sempre que há campos com regras de validação do lado do cliente", e nomear a exceção (escolha + ficheiro, validação no servidor).


- ✅ 48e838b · **2026-09-28 — "o AppLayout já aplica padding" não era verdade** · `docs/skills/references/design/tables-and-lists.md` · tipo: errado
  - O que aconteceu: ao construir a `LibraryPage` (1l), a referência dizia "sem `padding` no contentor da página — o `AppLayout` já aplica", mas o `<main>` do `AppLayout` só faz scroll; as páginas aplicam o seu (o `PagePlaceholder` já usava `p-8`).
  - Como se resolveu: a referência passou a dizer que cada página aplica o padding do protótipo (`px-10 pt-7` na Biblioteca).
- ✅ 48e838b · **2026-09-28 — regras de i18n num projeto sem i18n** · `docs/skills/frontend/skill-frontend-design-system.md`, `docs/skills/references/design/drawers-and-modals.md` · tipo: sobra
  - O que aconteceu: a skill pede "mensagens de erro de Zod como chaves i18n" e o drawer pede "texto dos botões via i18n (`t('common.cancel')`)", mas o ADR 0007 decidiu sem i18n (texto PT direto).
  - Como se resolveu: ignorado (a skill tem "(se `i18n`)" num sítio, mas não no outro); texto PT direto nos componentes.
- ✅ 48e838b · **2026-09-28 — o template da spec pede um bloco SQL num projeto sem base de dados** · `docs/features/_TEMPLATE.md` · tipo: sobra
  - O que aconteceu: §4.1 "Dados" traz ` ```sql -- tabelas e colunas concretas`; aqui o estado é um `state.json` (ADR 0009).
  - Como se resolveu: na spec Terminais, §4.1 descreve as coleções do `state.json` e os ficheiros em `DATA_DIR` em prosa e tabela.

- ➖ não muda nada: fraco (um projeto) e o README das specs já avisa · **2026-09-29 — secção 6 "Estado atual" de uma spec pode ficar desatualizada sem ninguém notar** · `docs/features/_TEMPLATE.md` (secção 6) · tipo: falta
  - O que aconteceu: a spec `separadores-de-projetos` tinha os passos 1-7 marcados `[x]` no código (confirmado pelos ficheiros no disco), mas a secção 6 só falava dos passos 1-2 — uma sessão anterior avançou os checkboxes da secção 5 sem atualizar a 6, apesar do aviso "Atualizar SEMPRE no fim de cada sessão" já escrito lá. O aviso é só texto; nada compara os `[x]` da secção 5 com o que a secção 6 diz.
  - Como se resolveu: corrigido à mão nesta sessão, comparando os checkboxes com os ficheiros que existem no disco e com o `git status`. Por resolver na origem — talvez um lembrete mais forte (ex.: `/implement-todo` "Modo spec" comparar as duas secções antes de confiar na 6), mas isso é decisão do Workflow, não deste projeto.


- **2026-10-22 — A spec exige uma skill por passo, mas não há nenhuma skill de backend** · `docs/skills/process/skill-plan-feature.md` · tipo: falta
  - O que aconteceu: ao partir a spec do bot de Telegram em passos, o campo "Skill a seguir" pedia uma skill para os 5 passos de backend; a stack `node-fastify` é 📋 (criada na hora) e o `SKILLS-INDEX` não tem nenhuma skill de backend. Cheguei a escrever `add-backend-feature`, que não existe.
  - Como se resolveu: "Skill: — ([[../backend-conventions]])" nesses passos. Na origem: o `skill-plan-feature` devia dizer o que pôr quando a camada não tem skill (apontar para as convenções da stack).
- **2026-10-26 — "Texto livre restringe caracteres (lista branca)" não serve para texto que vai para o Claude** · `docs/skills/frontend/skill-frontend-design-system.md` (regra 6) · tipo: ambíguo
  - O que aconteceu: na caixa de resposta da sessão guiada e no "Outro" de uma pergunta, o dono escreve uma mensagem ao Claude — caminhos (`C:\…`), código, Markdown são respostas normais. A regra pede lista branca em **todo** o texto livre; aplicá-la partia o uso.
  - Como se resolveu: sem lista branca nesses campos, só `trim().min(1).max(8000)`; a defesa está no backend (tira os caracteres de controlo antes do PTY, ADR 0020) — justificado em `design/guided-session.md` e na spec §6. Sugestão para a origem: a regra distinguir "texto que vira dado guardado/mostrado" de "mensagem para um agente".
  - 2026-10-26, outra vez: o anúncio colado na **Nova candidatura** da Upwork (traz "$50/hr", `{}`, `<>`). Mesmo tratamento; a exceção ficou escrita em `design/forms-and-validation.md` §4.2 ("texto colado de fora"), para não se redescobrir a cada campo.
- **2026-11-12 — O preflight procura specs 🚧, mas uma spec a meio pode continuar em "📋 Planeada"** · `docs/skills/process/skill-implement-todo.md` (Fase 0, ponto 5) · tipo: ambíguo
  - O que aconteceu: a spec `correr-a-app` tinha o passo 3 a meio (commit `b8be99c`), mas a tabela do topo dizia `📋 Planeada` e `0 / 8 concluídos`; o grep por 🚧 apanhou o `_TEMPLATE.md` e specs já fechadas, e não esta. Só a encontrei pelo ToDo e pelo work log.
  - Como se resolveu: por resolver na origem. Sugestão: o preflight lê a linha **Estado** de cada spec (`📋`/`🚧`) **e** a secção 6, e ignora o `_TEMPLATE.md`; ou o `plan-feature`/`implement-todo` passa o estado a 🚧 ao começar o 1.º passo.
