# Rotas, menu e verificação de role

> 🚧 Convenção prospetiva — ainda sem código neste projeto que a valide.

> Parte de [[../frontend-visual-consistency]]. Porquê: [[../../../../frontend/ux-patterns]] §8.

## 1. Superfície de rotas

`main.tsx` define tudo. Públicas: `/login` e as do fluxo de conta (`/forgot-password`,
`/reset-password`, `/accept-invite` quando existem). Protegidas debaixo de uma raiz com
`<PrivateRoute><AppLayout /></PrivateRoute>`.

| Rota | Página |
|---|---|
| _(preencher à medida que as páginas nascem — esta tabela vive **só** aqui)_ | |

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
- Uma rota **de topo** nova precisa de um item aqui (com gate de role quando for o caso). Rotas de
  detalhe (`:id`, sub-recursos) não entram.
- Mais de ~5 entradas → agrupar as relacionadas num `Dropdown`, com o gatilho aceso quando o
  `pathname` começa por uma das suas rotas.

### Menu de utilizador — um só ponto de entrada à direita

Um `Dropdown` cujo gatilho é o cartão de perfil (avatar + nome + tag de role):

| Item | Faz |
|---|---|
| Definições | Abre o drawer de definições (hoje: **layout dos terminais**) |
| Terminar sessão | `useConfirm()` (título e rótulo não destrutivos: "Terminar sessão?" / "Sair") → logout |

Sem "Minha conta" (um só utilizador, sem perfil) e sem idioma (só pt-PT). O gatilho é o avatar com as
iniciais (26 px, `surface-3`) + `▾`.

- Ação transversal nova entra neste menu, **não** como mais um ícone no header.
- O gatilho é um `<button>` com `aria-label`.
- **Responsivo: não há tratamento.** Só desktop/portátil, a partir de **1280 px** de largura
  ([[../../../adr/0008-identidade-visual]]). Não escrever media queries para ecrã pequeno; quem mudar
  isto escreve um ADR novo.

### Layout dos terminais — dois modos, escolhidos nas Definições

| Modo | Por omissão | O que é |
|---|---|---|
| **Foco dividido** | ✅ | Lateral de 288 px (`surface-1`: kicker + "N abertos", botão Novo terminal, contagens por estado, lista de terminais, quota no fundo) + área principal com **um** terminal em foco; `Alt+\` divide em dois lado a lado e volta a juntar. O painel com o teclado tem o cabeçalho em `surface-2` e "⌨ TECLADO AQUI" em `accent`; o outro fica em `surface-1`. |
| **Grelha** | | Sem lateral. Cabeçalho da página (kicker "Terminais" + "N abertos" + contagens + Novo terminal) e todos os terminais em cartões 3×2 ([[cards]]), com o último lugar tracejado para "Novo terminal". Um clique amplia o terminal. A quota passa para o header. |

- A escolha fica guardada como **preferência da app**. ⚠️ Onde se guarda (browser ou backend) decide-se no
  `/design-database` (regra: nenhuma persistência fora do modelo). Até lá, fica só em memória, sempre
  com o modo por omissão.
- Em ambos: terminais escondidos continuam vivos; o toast "`<nome>` terminou · Retomar" aparece no canto
  superior direito (`surface-2` + `shadow-overlay`).

### Login

Ecrã sem header: bloco de 360 px centrado em `bg`. Wordmark (losango 12 px + "WORKFLOW" 15/600
`.2em`), kicker "Acesso restrito", título display "Entrar", campo Password (40 px, `surface-1`, borda
`error` no estado de erro), mensagem "✕ Password incorreta. Tenta outra vez." em `error`, botão
primário a toda a largura.

## 3. Role do utilizador autenticado

`hooks/useAuth.ts` expõe `isAdmin()` / `hasRole()`. **Todo** o gate de permissão ou variação de UI
por role passa por aqui — nunca `user.role === "OWNER"` em cru.

Não confundir com **rotular** a role de outro perfil num badge (lê o campo do objeto — legítimo).

## 4. Guarda de rota

`PrivateRoute` verifica se há sessão e redireciona para `/login`. **Não verifica role.** Uma página
exclusiva de uma role tem o gate no backend (`@PreAuthorize`) — esconder o link não é controlo de acesso.

## 5. Sessão

`AuthContext` carrega `/auth/me` no arranque (com a sessão guardada em `sessionStorage` como
cache). No 401 final, o `api.ts` limpa essa cache antes de redirecionar — senão o contexto volta a
tentar `/auth/me` com cookies inválidos e entra em ciclo.

## Drift encontrado — não copiar

_Nenhum ainda._

## Relacionado

[[services-and-error-handling]] · `permissions-and-auth` (não incluída — sem roles)
