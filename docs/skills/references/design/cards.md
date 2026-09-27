# Cards

> 🚧 Convenção prospetiva — ainda sem código neste projeto que a valide.

> Parte de [[../frontend-visual-consistency]].

## O padrão

- **Card base** partilhado em `components/common/` (ex.: `BlueprintCard` / classe `.card`): caixa com
  borda hairline, raio do tema, elevação por classe. Props: `kicker` (rótulo pequeno em caixa alta),
  `elevation`, `style`.
- **Card de secção com cabeçalho** (`SectionCard`): card base + ícone em cor de acento + título.
  Usado nos formulários por secções e nos detalhes (view/edit) dentro de drawers.
- Antes de escrever um `<Card>` do AntD com `bodyStyle` à mão, verificar se o card base resolve.
- Visual: `surface-1`, borda hairline `border`, raio `lg`, **sem sombra** (a elevação é por
  luminosidade). O kicker usa `var(--wfa-color-accent)`.
- Acentos de estado num sub-card: fundo `state-*-subtle` + borda `state-*-border` (ex.: o aviso "Está
  a trabalhar agora" no diálogo de fechar). **Nunca gradientes.**
- **Cartão de terminal (modo grelha)**: fundo `term-bg`, raio `lg`, cabeçalho de 40 px em `surface-1`
  (ícone de estado + nome + pasta em mono + tag de estado). Borda `accent` se tem o teclado; se está à
  espera, borda `state-wait-border` + anel de 3 px `state-wait-subtle`. Um terminal terminado ou
  desligado ganha uma faixa em baixo (`-subtle`) com a ação "Retomar" / "Reiniciar".
- **Criar e editar usam o mesmo sistema visual** — um drawer não pode mudar de estilo a meio ao
  carregar em "Editar".

## Drift encontrado — não copiar

_Nenhum ainda._

## Relacionado

[[tokens-and-colors]] · [[drawers-and-modals]] · [[forms-and-validation]]
