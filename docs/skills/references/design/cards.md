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
- Acentos de estado num sub-card: classes de tag ou tokens de acento/neutro — **não gradientes
  claros por cor de estado**.
- **Criar e editar usam o mesmo sistema visual** — um drawer não pode mudar de estilo a meio ao
  carregar em "Editar".

## Drift encontrado — não copiar

_Nenhum ainda._

## Relacionado

[[tokens-and-colors]] · [[drawers-and-modals]] · [[forms-and-validation]]
