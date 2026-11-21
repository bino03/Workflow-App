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
- **Painel de terminal (grelha e foco dividido)** — revisto 2026-11-21, grelha densa do
  [[../../../adr/0036-moldura-tipo-ide-e-seletor-de-projeto|ADR 0036]] (`TerminalPane.tsx`): sem raio nem margem —
  os painéis ficam **colados por 1 px** (`gap-px` + anel `0 0 0 1px border` em cada mosaico; o fundo da grelha
  fica `bg`, para um lugar sem painel não ficar cinzento). Cabeçalho de `--wfa-row-height` (26 px) em
  `surface-1`: ícone de estado · nome (12 px, 600) · `pane-N · branch` em mono 10,5 px `text-3` (N = o
  `Alt+N`; o branch vem do `TerminalView.branch`, sem repositório fica só `pane-N`) · selos (conta, RC,
  pré-visualização) em `.tag-sm` · à direita a tag de estado em `.tag-sm` e os botões Ampliar e ✕ (ver
  [[buttons-and-icons]]). Com o teclado: `surface-2` + linha de 2 px `accent` no topo
  (`inset 0 2px 0`), em vez da borda `accent` de antes. Um terminal terminado ou desligado ganha uma faixa em
  baixo (`-subtle`) com "Reabrir" / "Continuar noutra conta".
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
