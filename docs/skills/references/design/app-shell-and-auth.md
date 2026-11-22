# Rotas, menu e verificação de role

> ✅ Baseado em `frontend/src/{main.tsx,layouts/AppLayout.tsx,pages/login/LoginPage.tsx,contexts/}`,
> verificado em Chrome headless a 2026-09-28. O que ainda não existe está marcado 🚧.

> Parte de [[../frontend-visual-consistency]]. Porquê: [[../../../../frontend/ux-patterns]] §8.

## 1. Superfície de rotas

`main.tsx` define tudo. Públicas: `/login` e as do fluxo de conta (`/forgot-password`,
`/reset-password`, `/accept-invite` quando existem). Protegidas debaixo de uma raiz com
`<PrivateRoute><AppLayout /></PrivateRoute>`.

| Rota | Página |
|---|---|
| `/login` | `pages/login/LoginPage.tsx` — pública; com sessão, volta para a rota de onde veio |
| `/terminals` | `pages/TerminalsPage.tsx` — 🚧 estado vazio até à feature Terminais |
| `/projects` | `pages/ProjectsPage.tsx` — a ficha de cada projeto do registo ([[../../../features/informacao-dos-projetos]]) |
| `/library` | `pages/LibraryPage.tsx` — 🚧 estado vazio até à feature Biblioteca |
| `/new-project` | `pages/NewProjectPage.tsx` — criar um projeto pelo `/create` do Workflow ([[../../../features/novo-projeto-guiado]]) |
| `/_tokens` | `pages/dev/TokenPreviewPage.tsx` — **só em dev** (fora do bundle de produção), pública |
| `/_guided` | `pages/dev/GuidedPreviewPage.tsx` — **só em dev**, pública: os componentes da sessão guiada com dados falsos |
| `*` | → `/terminals` |

Esta tabela vive **só** aqui.

Segmentos novos sempre em inglês.

## 2. Menu de navegação

`layouts/AppLayout.tsx` é a **única fonte de verdade** da navegação persistente.

- **Barra de título de 32 px** (moldura tipo IDE, [[../../../adr/0036-moldura-tipo-ide-e-seletor-de-projeto|ADR 0036]];
  canvas do Claude Design, proposta C): à esquerda uma **célula da marca** com a largura da lateral dos Terminais
  (`w-[var(--wfa-sidebar-width)]`, 272 px, `surface-1`, borda à direita — as duas leem-se como uma coluna), com o
  `Wordmark` (marca **"Em paralelo"** — `ParallelMark`, uma linha que se divide em três, só `accent` — + "WORKFLOW"
  12/600, maiúsculas, `.16em`; link para `/terminals`). Logo a seguir **toda a `<nav>`**: Terminais · Projetos ·
  Biblioteca · Upwork · Novo projeto (`NAV_ITEMS`, 12.5px; ativo `text-1` com sublinhado interior de 2 px em
  `accent`, os outros `text-3`). Espaço, e à direita só o menu de utilizador (separado por uma borda). Borda de baixo
  `border`. O `favicon.svg` é a mesma marca.
- Se uma sessão **fora de vista** (de outro projeto, escondida da grelha, ou com outra página aberta) precisa de
  ti ou está à tua espera, o item "Terminais" da nav ganha um losango `state-wait`: cheio se alguma precisa de
  ti, vazio (`.is-idle`) se só há à tua espera, com o número no tooltip ([[tokens-and-colors]] §3). Lê a lista
  do `TerminalsProvider`, que vive no `AppLayout` (uma só releitura, partilhada com a página dos Terminais).
- **Páginas** (Projetos, Biblioteca, Upwork, Definições, Novo projeto): começam pelo `PageHeader` de 36 px, fixo
  por baixo da barra de título, com o kicker alinhado com a marca ([[tables-and-lists]] §2). As alturas da moldura
  são tokens ([[tokens-and-colors]] §5 → "Densidade da moldura"). O `<main>` tem `scroll-padding-top` com a altura
  do cabeçalho.
- **Barra de estado de 24 px** em baixo (mono 11px), em todos os ecrãs autenticados: "Teclado em `<terminal>`" à
  esquerda e a lista de atalhos `Alt+…` à direita ([[buttons-and-icons]]).
  **Hoje** (sem terminais, decisão do dono: omitir o que não existe): à esquerda o estado da ligação ao
  backend (ponto `success`/`error` + texto, `GET /api/health` a cada 15 s, `useBackendHealth`), à
  direita a versão (`__APP_VERSION__`, do `package.json`). A quota também ainda não aparece no header.
- Uma rota **de topo** nova precisa de um item aqui (com gate de role quando for o caso). Rotas de
  detalhe (`:id`, sub-recursos) não entram.
- Mais de ~5 entradas → agrupar as relacionadas num `Dropdown`, com o gatilho aceso quando o
  `pathname` começa por uma das suas rotas.

### Menu de utilizador — um só ponto de entrada à direita

Um `Dropdown` cujo gatilho é o cartão de perfil (avatar + nome + tag de role):

| Item | Faz |
|---|---|
| Definições | ✅ Navega para a página `/settings` (`SettingsPage`, já não é um drawer): um índice fixo à esquerda e as secções seguidas — **layout dos terminais** (foco dividido / grelha), **atalhos** ([[../../../features/atalhos-editaveis|atalhos-editaveis]]) e **passkeys**. As secções saem de uma só lista (`settingsSections.ts`): cada definição nova traz o seu título e a sua entrada no índice. Sair de `/terminals` perde os separadores abertos e o foco/divisão em memória (como a Biblioteca); os terminais continuam a correr. Separado de "Terminar sessão" por um divisor |
| Terminar sessão | `useConfirm()` (`title` "Terminar sessão?", `actionLabel` "Sair", `danger: false`) → logout |

Sem "Minha conta" (um só utilizador, sem perfil) e sem idioma (só pt-PT). O gatilho é o avatar (20 px,
`surface-3`, com um **ícone de utilizador**, não iniciais) + o **nome do utilizador** (`APP_USERNAME`, vindo do
`/auth/me` — 12.5px, `font-medium`, `text-1`, cortado com reticências acima de 140 px; desde 2026-10-20, tamanhos
do ADR 0036) + `▾`.
Sem tag de role (não há roles).

- Ação transversal nova entra neste menu, **não** como mais um ícone no header.
- O gatilho é um `<button>` com `aria-label`.
- **Responsivo: não há tratamento.** Só desktop/portátil, a partir de **1280 px** de largura
  ([[../../../adr/0008-identidade-visual]]). Não escrever media queries para ecrã pequeno; quem mudar
  isto escreve um ADR novo.

### Layout dos terminais — dois modos, escolhidos nas Definições

| Modo | Por omissão | O que é |
|---|---|---|
| **Foco dividido** | ✅ | Lateral **do projeto ativo** (ADR 0036), com `--wfa-sidebar-width` (`surface-1`: kicker **"Projeto"** (sem a dica do atalho à vista — o dono pediu para a esconder a 2026-11-21; fica só no `title` do botão); o **nome do projeto é o botão do seletor de projeto**; o botão **"☑ por fazer/total"** ao lado do nome, que abre e fecha o **painel de tarefas** à direita ([[../../../adr/0037-tarefas-por-projeto|ADR 0037]]: `--wfa-tasks-panel-width`, cabeçalho de `--wfa-header-height` com o kicker "Tarefas", filtros `.filter-chip` Por fazer/Feitas/Todas, lista, a barra "Tarefa apagada · Desfazer" durante 6 s e o campo "Nova tarefa… (Enter)" no fundo; também abre com `Alt+K`; aberto/fechado em `localStorage`; mudar de projeto com o painel aberto não lhe dá o foco); caminho + estrela, "Retomar…", **+** e "noutra conta"; chips de estado só com mais de um estado; "Reabrir todos" quando há parados em qualquer projeto; e depois os grupos recolhíveis da proposta C (`SidebarGroup`: cabeçalho de 24 px com ▸, título em caixa alta e contagem; linhas de `--wfa-row-height`). Esses grupos são **TERMINAIS** (uma linha: estado · nome · `pane-N`, ou "Parado"/"Terminado" a cinzento; o detalhe e o `Alt+N` ficam no `title`; o visível em `accent-subtle` com filete `accent`; a tag da conta só com mais de uma conta), **BRANCHES** (só para ver, o atual primeiro com o ícone a `accent`; não aparece fora de um repositório) e **SESSÕES GRAVADAS** (as 5 mais recentes que não estão abertas, título + "14:30"/"ontem"/"18 nov"; clicar retoma na conta da conversa; "Ver todas…" abre o modal Retomar). No fundo fica o botão primário **"+ Novo terminal"**, com o ▾ "noutra conta" ao lado. A **quota já não vive aqui**: está na barra de título, compacta (`5h 42% ↻14:30  sem 81% ↻seg`, mono 11 px, a percentagem a `warning` a partir de 80 %, tooltip com as horas de reposição), antes do menu do utilizador. A barra de estado dos Terminais mostra "Teclado em <terminal>" (o nome a `accent`) e as dicas `Alt+N novo · Alt+ dividir · Alt+B projeto · Alt+K tarefas`, lidas do catálogo de atalhos; o seletor de projeto tem "Abrir outra pasta…" (um modal que navega pelas raízes, favoritas e recentes) ao lado de "Novo projeto…"). Sem separadores de projeto: muda-se pelo seletor (`ProjectSwitcher` — pesquisa, ↑↓, Enter, Esc, clique fora; projetos com terminais primeiro, depois favoritas; escolher **só ativa**, não cria terminal) ou `Alt+B`. Área principal com **um** terminal em foco; `Alt+\` divide em dois lado a lado e volta a juntar. O painel com o teclado tem o cabeçalho em `surface-2` e "⌨ TECLADO AQUI" em `accent`; o outro fica em `surface-1`. |
| **Grelha** | | Sem lateral. Cabeçalho da página (kicker "Terminais" + "N abertos" + contagens + quota + Novo terminal) e todos os terminais em mosaicos 3 colunas × 2 linhas à vista (scroll depois de 6), com o último lugar tracejado para "Novo terminal". Um clique **amplia temporariamente** (não muda a preferência); volta-se com "Voltar à grelha", `Alt+\` ou `Esc` **fora** do terminal (dentro, o `Esc` é do Claude Code). |

- ✅ A escolha fica no `localStorage` do browser (`workflow-app.layout`: `focus` | `grid`), lida por
  `hooks/useLayoutMode.ts` (`useSyncExternalStore`, partilhado entre a página e o drawer).
- Em ambos: terminais escondidos continuam montados e ligados; o toast "`<nome>` terminou · Reabrir"
  aparece quando um terminal **fora do ecrã** termina.
- Implementação: `pages/TerminalsPage.tsx` + `components/terminals/` — ver [[../../../features/terminais]] e
  [[../../../code-map]].

### Login

Ecrã sem header: bloco de 360 px centrado em `bg`. Wordmark (losango 12 px + "WORKFLOW" 15/600
`.2em`), kicker "Acesso restrito", título display "Entrar", campo Password (40 px, `surface-1`, borda
`error` no estado de erro), mensagem "✕ Password incorreta. Tenta outra vez." em `error`, botão
primário a toda a largura.

## 3. Role do utilizador autenticado

**Não há roles** ([[../../../adr/0003-auth-utilizador-unico]]). `useAuth()` expõe só
`{ status, username, login, loginWithPasskey, logout }`, com `status` = `checking` | `authenticated` |
`anonymous` e `username` = `null` até o `/auth/me` responder (não vai para a cache de sessão). Sem
`isAdmin()`/`hasRole()`.

## 4. Guarda de rota

`PrivateRoute` verifica a sessão: `checking` → spinner, `anonymous` → `/login` com `state.from` (o
login devolve lá depois). Não há gates de role.

## 5. Sessão

`AuthContext` chama `/auth/me` no arranque (com `skipAuthRedirect` + `skipErrorNotification`; o 401
resolve como "sem sessão", não como erro). Uma cache em `sessionStorage` (`workflow-app.session`) só
evita piscar o `/login` num refresh — o `/auth/me` confirma logo a seguir. O `AuthContext` regista no
`api.ts` (`setSessionExpiredHandler`) o que fazer num `AUTH_002` a meio da sessão: limpar a cache e
passar a `anonymous`; o `PrivateRoute` trata do redirect. Logout limpa a sessão local mesmo que a
chamada falhe. Backend inacessível no arranque → um toast "Sem ligação ao backend" + `/login`.

O `sessionStorage` é **por tab**: num tab novo a cache está vazia. Se o `PrivateRoute` redireciona logo,
um tab novo cai no `/login` com a sessão válida (já aconteceu) — com a cache vazia, mostrar um estado de
carregamento até o `/auth/me` responder, e só então decidir.

O login mostra **todos** os erros inline por baixo do campo (password errada, rate limit, sem ligação)
— nunca em toast.

## Drift encontrado — não copiar

_Nenhum ainda._

## Relacionado

[[services-and-error-handling]] · `permissions-and-auth` (não incluída — sem roles)
