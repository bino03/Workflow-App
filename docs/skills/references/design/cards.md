# Cards

> 🚧 Parcialmente validada: `.card` (index.css) e `components/common/SectionCard.tsx` (props `title`, `icon`, `kicker?`, `extra?`) existem e foram verificados a 2026-09-28; o cartão de terminal ainda não.

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
- **Faixa de estado** (2026-10-25, `components/library/ImportBanner.tsx`, verificada em Chrome headless com
  capturas): uma linha por cima do conteúdo de um ecrã para **uma** coisa a decorrer em fundo (a importação
  aberta, na Biblioteca). Classe `.status-banner` + `.is-work|is-wait|is-run|is-stop|is-err`: fundo
  `state-*-subtle` (ou `accent-subtle` em `is-run`) e borda `state-*-border`, raio `md`, `px-4 py-2.5`;
  o texto fica `text-1` e a cor vai **só** para o `.state-icon` à esquerda (forma + cor). À direita, as ações
  do estado em botões `size="small"`: a principal `primary` quando o estado pede o dono ("Ver terminal" à
  espera, "Rever" pronto), a destrutiva `type="text" danger` com confirmação. `role="status"` +
  `aria-live="polite"`: quem usa leitor de ecrã ouve as mudanças. Desaparece quando a coisa acaba — não é um
  histórico.
- **Criar e editar usam o mesmo sistema visual** — um drawer não pode mudar de estilo a meio ao
  carregar em "Editar".

## Drift encontrado — não copiar

_Nenhum ainda._

## Relacionado

[[tokens-and-colors]] · [[drawers-and-modals]] · [[forms-and-validation]]
