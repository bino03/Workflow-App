# Plano — 2026-11-21 moldura-tipo-ide

**Estado**: concluído (2026-11-21, as 4 fases)
**Âmbito escolhido**: o redesign "mais profissional, tipo VS Code" pedido pelo dono a 2026-11-20
**Orçamento da sessão**: sem limite
**Modelo**: fase 2 `sonnet` · fase 3 `opus` (decidir o branch) + `sonnet` · fase 4 `opus` (modelo de dados) + `sonnet`

> Escrito para uma sessão **sem o histórico da conversa**. Ler primeiro o
> [[../../../docs/adr/0036-moldura-tipo-ide-e-seletor-de-projeto|ADR 0036]] e a entrada de 2026-11-21 do
> [[../../whatIveDone]].

## Onde está o desenho

- **Canvas do Claude Design** (privado, do dono): https://claude.ai/artifact/R3oG66QvDxj6TRqQu6wkNk
  - `Main` (A · compacto) e `B-ActivityBar` (B) — propostas rejeitadas, ficam como referência.
  - `C-Workspaces` — **a escolhida**, interativa (Play): barra de título, marca, nome do utilizador, seletor de
    projeto aberto por omissão, **painel de tarefas** (fechado por omissão; abre no botão "☑ 3/5" ao lado do nome
    do projeto) e a **grelha densa 2×2**.
  - `Logo` — as 5 marcas; a escolhida é a **2 · Em paralelo**.
- Os protótipos são **referência, não código** (CLAUDE.md, regra 5). Para os ler: Artifact tool, `action: read`,
  `path: project/C-Workspaces.dc.html`.

## Esclarecimentos já obtidos (do dono)

- Mantém **Violeta + Geist** (ADR 0008); só muda a estrutura e a densidade.
- Proposta **C**, com: célula da marca alinhada com a lateral; **sem separadores de projeto**; navegação toda à
  esquerda; **nome do utilizador** ao lado do ícone; marca **"Em paralelo"** (detestava o losango).
- Mudar de projeto: botão no nome do projeto **e** `Alt+B`. Aceitou que o `Alt+B` deixe de ser "recuar uma
  palavra" no shell. Depois pediu para **esconder a dica `Alt+B`** da lateral (feito, `c476d38`).
- **Tarefas por projeto**: lista pessoal só para se guiar, **nada a ver com o vault** (`notes/ToDo.md`). Adicionar,
  marcar como feita, apagar. Lugar: painel à direita, aberto por um botão no cabeçalho do projeto na lateral.
- Apagar uma tarefa: proposto "Desfazer" em vez de diálogo de confirmação (exceção à regra das ações destrutivas)
  — o dono disse "perfeito" ao protótipo, mas **confirmar** antes de implementar.
- **Fase 3 (2026-11-21, sessão 2)**: o **branch entra**, lido pelo backend (reinicia a 7400 — combinar o momento);
  **botões Ampliar e Fechar** no cabeçalho do painel, como no protótipo (revê a decisão de 2026-09-29 de cabeçalho
  sem botões); a **tag de estado fica**, mais pequena (a decisão final continua no item dos ícones de estado);
  alcance: grelha **e** modo foco/dividido a 26 px, painéis colados por 1 px sem margens, e o `TerminalsHeader`
  passa aos 36 px do `PageHeader`.
- **Fase 4 (2026-11-21, sessão 3)**: atalho **`Alt+K`** (id novo no `catalog.ts`); **sem reordenar** — ordem de
  criação; painel aberto/fechado **global, em `localStorage`** (não vai ao `state.json`); apagar com **"Desfazer"**
  (sem diálogo — exceção à regra das ações destrutivas, a registar).

## Ordem

1. [x] **Moldura + seletor** — concluída 2026-11-21 (commits `06f972c` ADR, `454b5e9` feat, `c476d38` dica
   escondida). Barra de 32 px, `--wfa-sidebar-width` (272 px), `ParallelMark` + favicon, lateral do projeto ativo,
   `ProjectSwitcher` (só ativa, não cria terminal), ação `projectSwitch` = `Alt+B`. Testes: keybindings 14/14;
   `smoke` 6/6, `project-switcher` 31/31, `accounts-terminals` 41/41.
2. [x] **Concluída 2026-11-21** — aplicada direto, sem canvas (escolha do dono): `PageHeader` de 36 px fixo, alturas
   em tokens (`--wfa-header-height`, `--wfa-control-height`, `--wfa-row-height`, `--wfa-table-row-height` 40…), nos 5
   ecrãs; drawers/formulários ficam na densidade do 0008 de propósito. Cenários verdes (ver [[../../whatIveDone]]).
   Era: `sonnet` **Densidade nova nas referências + rever os outros ecrãs** — o dono perguntou "se adicionar um
   novo componente vai ser criado com o estilo que definimos?". Resposta: cores/fontes sim (tokens), **densidade
   não** — `cards`, `tables-and-lists`, `drawers-and-modals`, `forms-and-validation` ainda descrevem a do 0008.
   Passos: (a) fixar a densidade nas referências de `docs/skills/references/design/` (alturas de cabeçalho de
   página, linha de lista, cabeçalho de painel; tamanhos de texto) e passar a tokens as medidas que se repetem,
   como o `--wfa-sidebar-width`; (b) aplicar a Projetos, Biblioteca, Upwork, Definições, Novo projeto. Critério:
   sem cabeçalhos de 48 px soltos, tudo alinhado com a barra de 32 px, cenários de `scripts/verify/` verdes.
   ⚠️ Perguntar ao dono se quer ver primeiro estes ecrãs no canvas (Claude Design) ou se aplica direto.
3. [x] **Concluída 2026-11-21 (sessão 2)** — **Grelha densa** da C: cabeçalho de painel de 26 px (nome · `pane-N ·
   branch` · tag `.tag-sm` · Ampliar · ✕), painéis colados a 1 px, também no foco dividido; `TerminalsHeader` a 36 px.
   Branch: `TerminalView.branch`, lido do `.git/HEAD` por `backend/src/terminals/gitBranch.ts` (sem correr o git,
   nunca acima da raiz de `ALLOWED_ROOTS`). Testes: backend 624/624; `pane-header` 19/19 (novo), `terminal-menu`
   42/42, `grid-slots` 13/13, `app-run-ui` 26/26, `accounts-terminals` 41/41, `project-switcher` 31/31, `smoke` 6/6.
4. [x] **Concluída 2026-11-21 (sessão 3)**: ADR 0037, coleção `projectTasks` e `/api/project-tasks`, painel `ProjectTasksPanel` com `Alt+K`. Testes: backend 630/630; `project-tasks` 41/41 (novo), `settings` 21/21, `project-switcher` 31/31, `pane-header` 19/19, `smoke` 6/6. Era: **Tarefas por projeto** — ⚠️ antes, `/design-database` em modo evoluir (CLAUDE.md, regra 4): entidade nova
   projeto → tarefas no `state.json` (ADR 0009) → ADR novo → rotas (`/add-backend-feature`) → painel à direita de
   300 px com `Alt+T` (verificar no `catalog.ts` que não colide: `Alt+T` é do Claude Code — "thinking" — escolher
   outra, ex. `Alt+K`, e perguntar). ⚠️ Por decidir: reordenar arrastando; o painel aberto/fechado guardado por
   projeto; "Desfazer" vs confirmação ao apagar.

## Armadilhas desta sessão

- **Editar `backend/` com a app em `npm run dev` na 7400 reinicia-a e mata os terminais** — perguntar ao dono
  antes (ele autorizou uma vez para o `catalog.ts`).
- As instâncias de teste (`scripts/verify/instance.mjs start`) morriam quando o comando que as lançava acabava;
  arrancá-las num Bash em background (`run_in_background`) com um `sleep` longo a seguir, e parar com
  `instance.mjs stop --clean` + parar a tarefa.
- A lateral só mostra o projeto ativo: os cenários mudam de projeto com `openProject(page, path)` do `cdp.mjs`
  (a fase 1 tinha partido o `terminal-menu` e o `app-run-ui` sem ninguém ver — corrigidos na fase 3).
- O `tsx watch` só vigia os ficheiros que o servidor importa: um ficheiro novo em `backend/src` e o seu teste
  podem escrever-se e testar-se sem reiniciar a 7400; só a ligação (o import) reinicia.

## Próximo passo

Nada. O plano está concluído e foi arquivado.
