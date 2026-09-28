# 🎨 Convenções do frontend — React + Vite + Ant Design

> No projeto gerado vira `docs/frontend-conventions.md`. As regras de base estão também no topo de
> [[skills/skill-frontend-design-system]] (é lá que cada tarefa de UI as lê); os valores visuais
> estão em `design/`.

## As regras de base (frontend)

1. **Strict mode sempre** — nada de `any` sem justificação num comentário.
2. **Naming**: componentes e ficheiros de componente `PascalCase`, hooks `use*`, serviços
   `<domain>Service.ts`, schemas `<domain>FormSchema.ts`, tipos em `types/<domain>.ts`.
3. **Sem `try/catch` nos serviços** — o erro sobe ao componente, que o entrega ao `ErrorHandler`.
4. **Um ficheiro de serviço por domínio**, funções nomeadas (`export async function getX`), sobre a
   instância Axios partilhada, sem lógica de UI.
5. **Formulários sempre Zod + React Hook Form.**
6. **Texto livre com lista branca de caracteres** e `max`; o frontend nunca é mais permissivo do que o
   backend.
7. **Visibilidade de campos por role é sempre perguntada**, e nunca resolvida só no frontend.
8. **Cores, larguras, tokens e ícones vêm de `design/`** (pelo router) — nunca inventar um valor.

E uma que não é de código: **testar no browser antes de dar por feito**.

## Instância HTTP (`src/api.ts`)

- **Uma** instância Axios, `baseURL` de `VITE_API_URL`, `withCredentials: true`.
- Interceptores: (1) `FormData` → remover `Content-Type` para o browser pôr o boundary;
  (2) erro chegado como `Blob` num download → reconverter em JSON para o `errorCode` ser legível;
  (3) 401 → refresh uma vez com fila para pedidos concorrentes, exceto pedidos marcados
  `noRefreshRetry` (login); se falhar, limpar a sessão guardada e ir para `/login`;
  (4) notificação de erro **só se ninguém reclamou o erro** (ver [[design/services-and-error-handling]]).
- Flags por pedido: `noRefreshRetry`, `skipErrorNotification`.
- Sem `console.log` de pedidos em produção.

## Estado

- Transversal: React Context (`AuthContext` via `useAuth()`, `ConfirmDialogContext` via `useConfirm()`).
- Lista: hook local que é dono dos dados, loading, paginação e filtros e expõe as ações.
- Chamada avulsa: `useApiCall()` (`{ execute, loading, error }`).

## Paginação

Um normalizador partilhado (`utils/springPage.ts` → `normalizeSpringPage<T>()`) aceita a forma
embrulhada e a plana. O índice da página é **0** no servidor e **1** no componente de paginação.
Constantes em `config/pagination.ts`.

## Rotas

Segmentos em inglês, `kebab-case`. Rotas protegidas debaixo de uma raiz com
`<PrivateRoute><AppLayout /></PrivateRoute>`. A guarda verifica sessão; gates de role vivem nas
páginas/menu **e** no backend.

## Estilo

Ant Design para componentes, Tailwind para estilo próprio, tokens CSS como fonte de verdade
(`--wfa-*` em `index.css`), `theme.ts` a espelhá-los. Nunca hex hardcoded.

## Específico deste projeto

- **Versões** (scaffold de 2026-09-28): React 19 + **antd 6** (suporta React 19 sem o patch que o antd 5
  exigia), Vite 7, TypeScript 6, Tailwind 4, react-router 8. Porque não o Vite 8 nem o TypeScript 7:
  [[commands]] → Armadilhas dos comandos (Smart App Control).
- **O backend não é Spring.** A secção "Paginação" acima (normalizador `springPage.ts`) vem da stack e
  **não se aplica** enquanto a API não paginar ([[api]] → Paginação). Não criar `springPage.ts`.
- **Sem refresh token**: a sessão é de servidor ([[adr/0003-auth-utilizador-unico]]). O interceptor de
  401 limpa o estado e vai para `/login` — o ponto (3) da "Instância HTTP" fica reduzido a isso.
- **Visibilidade por role**: não há roles; a regra 7 não se aplica.
- **O `api.ts` deste projeto** (✅ 2026-09-28): `baseURL` e URL do WebSocket vêm de
  `src/config/apiBase.ts` (`API_BASE_URL`, `apiWebSocketUrl(path)`) — relativos à página quando
  `VITE_API_URL` está vazia; nunca escrever um endereço do backend noutro sítio. O redirect para
  `/login` decide-se pelo **código `AUTH_002`**, não pelo 401 (o `AUTH_001` de password errada também
  é 401). Flags: `skipErrorNotification` e `skipAuthRedirect` (o `/auth/me` do arranque); não há
  `noRefreshRetry`. O `AuthContext` regista com `setSessionExpiredHandler` como limpar a sessão e
  navegar. O interceptor de `Blob` (2) fica por fazer até haver um download.
- **Toasts**: `notificationService` usa a instância do `<App>` do antd, ligada por
  `NotificationBridge` dentro do `<App>` — o `notification` estático do antd 6 não herda o tema.
- **Terminais**: um `TerminalView` por terminal aberto — monta o xterm.js + `FitAddon`, abre o WebSocket
  (`apiWebSocketUrl(...)`, com cookies), envia `resize` quando o contentor muda
  (`ResizeObserver` → `fit()`), e **desmonta tudo** ao sair (`dispose()` do xterm.js, `close()` do
  socket). A instância do xterm.js e o socket não vão para Context nem para estado de React.
- **Teclado**: com um terminal em foco, o teclado é dele (Ctrl+C, Esc, setas, Tab são do Claude Code).
  Atalhos da app só com combinações que o Claude Code não usa — confirmar antes de fixar.
- Portas: dev server em **7401** com `strictPort` (não colidir com os dev servers dos projetos abertos
  dentro dos terminais).

## Armadilhas

- **Campo validado como vazio apesar de ter texto** — `{...register('x')}` num `<Input>` do antd (o
  `ref` é um `InputRef`, não o DOM). → `Controller` ([[skills/references/design/forms-and-validation]] §2.1).
- **Componentes do antd sem bordas/margens** — o preflight do Tailwind 4 ganhou ao CSS-in-JS do
  antd. → Ordem `@layer theme, base, antd, components, utilities` + `<StyleProvider layer>`
  ([[skills/references/design/tokens-and-colors]] → Tailwind e antd).
- **Type-check "limpo" que não analisou nada** — `tsc --noEmit` com `tsconfig` de referências.
  → `tsc -b` ([[commands]]).
- **Chamadas à API falham como se fosse auth** — o Vite saltou de porta e a origem não está no
  CORS. → Libertar a porta.
- **Lista vazia, sem mensagem, spinner parado** — `try/finally` sem `catch` à volta da chamada; o
  erro sobe como promise rejeitada não tratada. → `catch` com `ErrorHandler.handle`.
- **Cada erro aparece duas vezes** (mensagem PT do componente + mensagem crua do backend) — o
  interceptor e o componente notificam os dois. → O handler reclama o erro; o interceptor adia um
  tick e cala-se se o erro já tem dono ([[design/services-and-error-handling]]).
- **"0 resultado(s)" com linhas na tabela / "undefined"** — lê-se `totalElements` na forma plana
  quando o backend embrulha a página. → Normalizador partilhado.
- **Lista abre na página errada** — índice 0 no servidor vs. 1 no `Pagination`.
- **"Confirmar eliminação" numa ação que não elimina** — defaults do diálogo de confirmação. →
  Passar `title` e `actionLabel`.
- **Clicar "Editar" numa linha clicável também navega** — falta `stopPropagation` no contentor das
  ações (o `ListActions` já o faz).
- **Download de erro ilegível** — com `responseType: 'blob'` o `{errorCode}` chega como Blob. →
  Interceptor que o reconverte.
- **Import default de um módulo que só tem named export** — compila com o type-check errado e
  rebenta em runtime ao abrir o ecrã.
- **Animação de saída do AntD não termina com a janela do browser sem foco** (verificação
  automática) — o DOM diz "modal aberto" para sempre. → Decidir abrir/fechar de modais por
  screenshot e clicar com o rato real (`verify-in-browser` (não incluída)).
