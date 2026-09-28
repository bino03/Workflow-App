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
| `/library` | `pages/LibraryPage.tsx` — 🚧 estado vazio até à feature Biblioteca |
| `/_tokens` | `pages/dev/TokenPreviewPage.tsx` — **só em dev** (fora do bundle de produção), pública |
| `*` | → `/terminals` |

Esta tabela vive **só** aqui.

Segmentos novos sempre em inglês.

## 2. Menu de navegação

`layouts/AppLayout.tsx` é a **única fonte de verdade** da navegação persistente.

- **Header de 48 px** (protótipo [[../../../design/handoff-2026-09-27/README|handoff 2026-09-27]]):
  wordmark "WORKFLOW" à esquerda (losango contornado em `accent` + display 13/600, maiúsculas,
  `letter-spacing: .18em`, link para `/terminals`), `<nav>` logo a seguir (Terminais · Biblioteca;
  ativo com sublinhado interior de 2 px em `accent`), espaço, e à direita a **quota** (quando a
  lateral não a mostra) e o menu de utilizador. Borda de baixo `border`.
- Se um terminal escondido está à espera, o item "Terminais" da nav ganha um losango `state-wait`.
- **Barra de estado de 26 px** em baixo, em todos os ecrãs autenticados: "Teclado em `<terminal>`" à
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
| Definições | ✅ Abre o drawer `SettingsDrawer` (Small, 540): **layout dos terminais** (foco dividido / grelha). Separado de "Terminar sessão" por um divisor |
| Terminar sessão | `useConfirm()` (`title` "Terminar sessão?", `actionLabel` "Sair", `danger: false`) → logout |

Sem "Minha conta" (um só utilizador, sem perfil) e sem idioma (só pt-PT). O gatilho é o avatar (26 px,
`surface-3`) + `▾` — com um **ícone de utilizador**, não iniciais: o `/auth/me` não devolve nome.

- Ação transversal nova entra neste menu, **não** como mais um ícone no header.
- O gatilho é um `<button>` com `aria-label`.
- **Responsivo: não há tratamento.** Só desktop/portátil, a partir de **1280 px** de largura
  ([[../../../adr/0008-identidade-visual]]). Não escrever media queries para ecrã pequeno; quem mudar
  isto escreve um ADR novo.

### Layout dos terminais — dois modos, escolhidos nas Definições

| Modo | Por omissão | O que é |
|---|---|---|
| **Foco dividido** | ✅ | Lateral de 288 px (`surface-1`: kicker **"Projetos"** + "N abertos", botão Novo terminal, contagens por estado, **os terminais agrupados por projeto (pasta)** — cabeçalho do projeto com estrela, "Retomar…" e **+** —, "Reabrir todos" quando há parados, quota no fundo) + área principal com **um** terminal em foco; `Alt+\` divide em dois lado a lado e volta a juntar. O painel com o teclado tem o cabeçalho em `surface-2` e "⌨ TECLADO AQUI" em `accent`; o outro fica em `surface-1`. |
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
`{ status, login, logout }`, com `status` = `checking` | `authenticated` | `anonymous`. Sem
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

O login mostra **todos** os erros inline por baixo do campo (password errada, rate limit, sem ligação)
— nunca em toast.

## Drift encontrado — não copiar

_Nenhum ainda._

## Relacionado

[[services-and-error-handling]] · `permissions-and-auth` (não incluída — sem roles)
