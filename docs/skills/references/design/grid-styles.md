# Grid Styles

> 🚧 Código verificado por tipo/lint; **sem verificação visual no browser ainda** — ver
> [[../../../../notes/verificacao-browser-pendente|verificacao-browser-pendente]]. Baseado em
> `frontend/src/components/terminals/{gridStyle.ts,GridStylePicker.tsx,TerminalGrid.tsx}`, escrito na spec
> [[../../../features/estilos-de-grelha|estilos de grelha]] (2026-09-29). Sem protótipo do Claude
> Design — desenhado só com tokens.

> Parte de [[../frontend-visual-consistency]].

## Quando usar

Um modo Grelha com vários arranjos escolhíveis por quem usa — cada arranjo com um número fixo de
"lugares", um lugar vazio mostra um "+" para criar/ocupar ali mesmo, e um item a mais do que lugares
disponíveis fica de fora (continua a existir, só não aparece na grelha).

## Estrutura

O botão de escolha é um `Dropdown` do antd (mesmo padrão do menu de utilizador, `AppLayout.tsx`), com a
opção atual marcada:

```tsx
<Dropdown trigger={['click']} menu={{ items, selectedKeys: [activeKey], onClick }}>
  <button className="h-8 flex items-center gap-1.5 px-2.5 rounded-md border border-border bg-surface-1 text-text-2 text-[13px] hover:bg-surface-2 hover:text-text-1">
    <AppstoreOutlined /> {activeLabel} <DownOutlined style={{ fontSize: 9 }} />
  </button>
</Dropdown>
```

O contentor da grelha muda de `className`/`style` por arranjo, mas **nunca muda quem é filho de quem** —
todos os lugares (mosaicos + "+" vazios) são filhos diretos do mesmo contentor plano, posicionados só por
CSS (`order`, ou `grid-column`/`grid-row` explícito quando os lugares não são todos do mesmo tamanho):

```tsx
// columns (N iguais lado a lado): flex + order
<div className="flex-1 min-h-0 flex gap-3">…</div>
// cada filho: style={{ order: index }}

// quad (2×2): grid + order (auto-placement em ordem respeita `order`)
<div className="flex-1 min-h-0 grid grid-cols-2 grid-rows-2 gap-3">…</div>

// spotlight (1 grande + 2 pequenos empilhados): grid + posição explícita — não cabe só com `order`
<div className="flex-1 min-h-0 grid gap-3" style={{ gridTemplateColumns: '2fr 1fr', gridTemplateRows: '1fr 1fr' }}>…</div>
// lugar 0: { gridColumn: 1, gridRow: '1 / span 2' } · lugar 1: { gridColumn: 2, gridRow: 1 } · lugar 2: { gridColumn: 2, gridRow: 2 }
```

Um lugar vazio (`slotIds[i] === null`):

```tsx
<button aria-label="Abrir terminal aqui" style={slotPlacement(style, index)}
        className="min-h-0 min-w-0 flex items-center justify-center rounded-lg border border-dashed border-border-strong text-text-3 hover:bg-surface-2 hover:text-text-1">
  <PlusOutlined style={{ fontSize: 20 }} />
</button>
```

- **Nunca aninhar o DOM por estilo** (ex.: uma coluna lateral com dois filhos dentro dela): mesmo quando o
  resultado visual "parece" pedir aninhamento (o `spotlight`), resolve-se com posição CSS explícita sobre
  o contentor plano — reestruturar o DOM por trocar de estilo desmontaria e remontaria o que já lá estava
  montado (aqui, um WebSocket ligado), e é exatamente isso que este padrão evita.
- **`order` chega** para lugares todos do mesmo tamanho (`columns`, `quad`); só faz falta
  `grid-column`/`grid-row` explícito quando um lugar é maior do que os outros (`spotlight`).
- **Lugar vazio**: mesma borda tracejada + "+" ao centro, do tamanho do lugar (não da página toda).

## Drift encontrado — não copiar

_Nenhum ainda._

## Relacionado

[[tokens-and-colors]] · [[buttons-and-icons]] · [[browser-tabs]] · [[../../../features/estilos-de-grelha]]
