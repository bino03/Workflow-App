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

- Header em três secções: wordmark à esquerda (link para a home — substitui um "Início"), `<nav>` ao
  centro, ações à direita. Os dois lados com `flex: 1 1 0` iguais para a nav ficar no centro real.
- Uma rota **de topo** nova precisa de um item aqui (com gate de role quando for o caso). Rotas de
  detalhe (`:id`, sub-recursos) não entram.
- Mais de ~5 entradas → agrupar as relacionadas num `Dropdown`, com o gatilho aceso quando o
  `pathname` começa por uma das suas rotas.

### Menu de utilizador — um só ponto de entrada à direita

Um `Dropdown` cujo gatilho é o cartão de perfil (avatar + nome + tag de role):

| Item | Faz |
|---|---|
| Minha conta | Abre o drawer do perfil |
| *Definições* (grupo) | Configuração do produto (só as entradas que a role pode usar) |
| Idioma ▸ pt / en | (i18n) muda e guarda; o ativo aparece `disabled` |
| Terminar sessão | `useConfirm()` → logout |

- Ação transversal nova entra neste menu, **não** como mais um ícone no header.
- O gatilho é um `<button>` com `aria-label`.
- **Responsivo**: decidir e escrever aqui. Se não há tratamento de ecrã pequeno, fica dito; quem
  introduzir a primeira media query documenta a convenção.

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
