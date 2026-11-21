# Plano — 2026-11-21 moldura-tipo-ide

**Estado**: em curso (fase 1 concluída e em commit; fases 2-4 por começar)
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

## Ordem

1. [x] **Moldura + seletor** — concluída 2026-11-21 (commits `06f972c` ADR, `454b5e9` feat, `c476d38` dica
   escondida). Barra de 32 px, `--wfa-sidebar-width` (272 px), `ParallelMark` + favicon, lateral do projeto ativo,
   `ProjectSwitcher` (só ativa, não cria terminal), ação `projectSwitch` = `Alt+B`. Testes: keybindings 14/14;
   `smoke` 6/6, `project-switcher` 31/31, `accounts-terminals` 41/41.
2. [ ] `sonnet` **Densidade nova nas referências + rever os outros ecrãs** — o dono perguntou "se adicionar um
   novo componente vai ser criado com o estilo que definimos?". Resposta: cores/fontes sim (tokens), **densidade
   não** — `cards`, `tables-and-lists`, `drawers-and-modals`, `forms-and-validation` ainda descrevem a do 0008.
   Passos: (a) fixar a densidade nas referências de `docs/skills/references/design/` (alturas de cabeçalho de
   página, linha de lista, cabeçalho de painel; tamanhos de texto) e passar a tokens as medidas que se repetem,
   como o `--wfa-sidebar-width`; (b) aplicar a Projetos, Biblioteca, Upwork, Definições, Novo projeto. Critério:
   sem cabeçalhos de 48 px soltos, tudo alinhado com a barra de 32 px, cenários de `scripts/verify/` verdes.
   ⚠️ Perguntar ao dono se quer ver primeiro estes ecrãs no canvas (Claude Design) ou se aplica direto.
3. [ ] **Grelha densa** da C — cabeçalhos de painel de 26 px (nome · `pane-N` · branch · tag de estado · ampliar ·
   fechar), painéis colados com 1 px de `border`. ⚠️ Por decidir com o dono: o **branch** no cabeçalho precisa de
   o backend o ler (hoje não existe) — com ou sem ele.
4. [ ] **Tarefas por projeto** — ⚠️ antes, `/design-database` em modo evoluir (CLAUDE.md, regra 4): entidade nova
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
- O `accounts-terminals.mjs` passou a mudar de projeto pelo seletor (`openProject(path)`); cenários novos que
  precisem de outro projeto devem fazer o mesmo — a lateral só mostra o projeto ativo.

## Próximo passo

Fase 2: perguntar ao dono se revê os ecrãs no canvas primeiro ou aplica direto; depois fixar a densidade nas
referências de design.
