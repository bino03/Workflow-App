# Tables & Lists

> 🚧 Parcialmente validada: `components/common/ListActions.tsx` verificado a 2026-09-28 (`stopPropagation`, `minWidth` 110, `Danger` em `accent` .75); cabeçalho, tabela só de leitura, pesquisa com `/` e chips de filtro baseados em `pages/LibraryPage.tsx`, verificado em Chrome headless a 2026-09-28. Paginação ainda sem código.

> Parte de [[../frontend-visual-consistency]]. Porquê: [[../../../../frontend/ux-patterns]] §3-4.

## Colunas

Array inline no próprio ficheiro (dentro de `useMemo` quando depende de `t`/estado), tipado
`ColumnsType<T>`. Não extrair para um `columns.ts` separado.

## 1. Coluna de ações — `components/common/ListActions.tsx`

```tsx
import { ListActions, ListActionPrimary, ListActionSecondary, ListActionDanger } from "@/components/common/ListActions";

{
  title: "", key: "actions", width: 170,
  render: (_, record) => (
    <ListActions>
      <ListActionPrimary onClick={() => onView(record)}>Ver detalhes</ListActionPrimary>
      {canEdit(record) && <ListActionSecondary onClick={() => onEdit(record)}>Editar</ListActionSecondary>}
      {isAdmin() && <ListActionDanger onClick={() => confirmDelete(record)}>Eliminar</ListActionDanger>}
    </ListActions>
  ),
}
```

| Componente | AntD | Uso |
|---|---|---|
| `ListActionPrimary` | `<Button size="small">` | "Ver detalhes" |
| `ListActionSecondary` | `<Button type="text" size="small">` | "Editar" |
| `ListActionDanger` | `type="text" size="small"` + `opacity .75` + `color: var(--wfa-color-accent)` | "Eliminar" |

O componente já resolve: botões empilhados, alinhados à esquerda, `minWidth: 110`,
**`stopPropagation` no contentor**, hover pelo tema.

## 2. Cabeçalho da página — kicker + `h1`

```tsx
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "var(--wfa-space-6)" }}>
  <div>
    <h6 className="kicker">Biblioteca</h6>
    <h1 style={{ margin: 0 }}>Workflow</h1>
  </div>
  {/* à direita: a ação principal, ou a pesquisa (320 px, atalho "/") numa lista só de leitura */}
</div>
```

- Kicker: 11/600, maiúsculas, `letter-spacing: .12em`, cor `var(--wfa-color-accent)`. **Não**
  `accent-700`, que no tema escuro é quase preto ([[tokens-and-colors]] §2).

- O `AppLayout` **não** aplica padding (o `<main>` só faz scroll): cada página aplica o do protótipo — `px-10 pt-7` (40/28) na Biblioteca.
- Páginas aninhadas: `<Breadcrumb>` antes; botão "Voltar" por cima do kicker; o kicker leva o nome do pai.

## 3. Tabela — moldura e estados

```tsx
<div style={{ borderTop: "1px solid var(--wfa-color-border)" }}>
  <Table rowKey="id" columns={columns} dataSource={items} loading={loading} pagination={false}
         locale={{ emptyText: <Empty description="Sem encomendas" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }} />
</div>
```

- Célula identificadora: nomes técnicos (stack, skill, pasta) em `var(--wfa-font-mono)` 13/500 `text-1`;
  nomes em prosa em `var(--wfa-font-display)` 600.
- Célula vazia: `"—"`.
- Estado/categoria: `<span className={`tag ${cls}`}>` com um mapa `STATUS_MAP` no ficheiro. Não `<Badge>`.
  Maturidade: `.tag-ok` / `.tag-mid` / `.tag-draft` (forma + cor, [[tokens-and-colors]] §3).
- Numa lista só de leitura (Biblioteca), a coluna de ações é um link de texto "Ver" em `accent` 13/600,
  alinhado à direita.

## 3.1 Chips de filtro e pesquisa (lista só de leitura)

- **Chips** (`.filter-chip` em `index.css`): `<button aria-pressed>` — o selecionado leva `accent-subtle` +
  `accent-border` + `text-1`. Na Biblioteca ficam em `tabBarExtraContent` das `Tabs`: Todas / Provado / Parcial /
  Rascunho, cada um com `<span className="mat-glyph is-ok|is-mid|is-draft">` (a mesma forma das tags `.tag-*`).
- **Pesquisa**: `Input` com `max-w-[320px]`, `SearchOutlined` a .5, `suffix={<span className="kbd">/</span>}`, `allowClear`.
  O atalho `/` foca-a com `preventDefault` (o `/` não fica escrito) e é ignorado se o foco já está num campo.
- Filtro por agrupamento (camada, categoria): `Select allowClear` de 200 px à esquerda da pesquisa, só na tab onde
  o campo existe; limpa-se ao mudar de tab.
- Rodapé: contagens do total da tab (`6 stacks · 3 provados · …`) + ` · a mostrar N` quando há filtro.
- Linhas clicáveis (`onRow` → abre o drawer) e `rowClassName` com `ant-table-row-selected` para a linha aberta.

## 4. Rodapé de contagem e paginação

```tsx
<div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
  <p style={{ fontSize: 12, opacity: 0.6, margin: 0 }}>{total} resultado(s)</p>
  <Pagination current={page + 1} total={total} pageSize={pageSize} onChange={(p) => onPageChange(p - 1)} />
</div>
```

`DEFAULT_PAGE_SIZE`/`PAGE_SIZE_OPTIONS` de `config/pagination.ts`. Atenção ao `+1`/`-1` (0-based no servidor).

## 5. Barra de pesquisa/filtros

`<Input prefix={<SearchOutlined style={{opacity:.5}}/>} style={{maxWidth: 320}} allowClear />` + filtros +
botão "Limpar". Pesquisa avançada com muitos filtros → Modal de filtros com contagem no ícone e "Limpar filtros".

## 6. Mestre-detalhe (sem tabela)

Coluna de cards clicáveis à esquerda + painel de detalhe à direita, quando o registo tem corpo longo
e o volume é baixo. Card selecionado com `border: 1px solid var(--wfa-color-accent)`.
Markdown com `react-markdown` + `remark-gfm`, **sem `rehype-raw`**.

## Drift encontrado — não copiar

_Nenhum ainda._ Vigiar: ações horizontais só-ícone; estilos de botão repetidos por ficheiro; `padding` a duplicar o do layout.

## Relacionado

[[buttons-and-icons]] · [[tokens-and-colors]] · [[services-and-error-handling]]
