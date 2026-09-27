# Buttons & Icons

> 🚧 Convenção prospetiva — ainda sem código neste projeto que a valide.

> Parte de [[../frontend-visual-consistency]].

## Tipos de botão

| Uso | Como |
|---|---|
| Ação principal da página | `<Button type="primary" icon={<PlusOutlined />}>` — tamanho por omissão, **não** `size="large"` |
| Ação principal numa linha | `<ListActionPrimary>` ([[tables-and-lists]]) |
| Secundária | `<Button type="text" size="small">` |
| Destrutiva | `<ListActionDanger>` em tabelas; fora delas `type="text"` + `color: var(--wfa-color-error)` |
| Confirmar ação destrutiva (no diálogo) | `<Button type="primary" danger>`: fundo `error`, texto `on-accent`; rótulo = a ação real ("Fechar terminal") |
| Ação no cabeçalho de um painel | Botão contornado pequeno (altura 26, borda `border`, `text-2`, raio `sm`) com o atalho em `.kbd` ("Dividir `Alt+\`") |
| Voltar | `<Button type="text" size="small" icon={<ArrowLeftOutlined />} style={{ paddingLeft: 0, opacity: .7 }}>` |

**Não simular botões preenchidos com estilo inline** (`background`/`border`/`boxShadow` +
`onMouseEnter` a escrever `style`). Aparência própria vem do tema ou de uma classe CSS.

## Confirmação — `useConfirm()`, nunca `Popconfirm`

```tsx
const confirm = useConfirm();
confirm({
  message: `Eliminar "${record.name}"? Esta ação não pode ser desfeita.`,
  onConfirm: () => handleDelete(record.id),
});
```

⚠️ **Os defaults são de eliminação** (`title` "Confirmar eliminação", `actionLabel` "Eliminar"). Numa
ação **não destrutiva**, passar os dois:

```tsx
confirm({ title: "Marcar como enviada?", actionLabel: "Marcar", message: "…", onConfirm });
```

**Toda a ação destrutiva passa por confirmação.**

## Atalhos de teclado

A app usa **`Alt+…`**: Ctrl+… pertence ao Claude Code e ao browser, e Ctrl+Alt+… é AltGr num teclado PT
(@, €, [ ]), o que partia a escrita no terminal.

| Atalho | Ação |
|---|---|
| `Alt+1…9` | Saltar para o terminal N |
| `Alt+N` | Novo terminal |
| `Alt+\` | Dividir / juntar (modo foco dividido) |
| `Alt+W` | Fechar terminal (com confirmação) |
| `Alt+R` | Renomear |

O atalho aparece junto da ação, em `.kbd`, e a lista completa na barra de estado de baixo. Um atalho
novo confirma-se primeiro contra os do Claude Code.

## Ícone + texto vs. só ícone

- Texto visível nas colunas de ação.
- Só ícone + `<Tooltip>` fora das colunas de ação, quando o espaço é curto e a ação é óbvia.

## Biblioteca de ícones

`@ant-design/icons` por omissão (integra com `icon={…}` e `prefix`). Não misturar duas famílias no
mesmo ecrã. Os **ícones de estado** (arco, losango, quadrado, ✕) não vêm da biblioteca: são formas
CSS (`.state-icon`, [[tokens-and-colors]] §3).

## Drift encontrado — não copiar

_Nenhum ainda._

## Relacionado

[[tables-and-lists]] · [[drawers-and-modals]] · [[tokens-and-colors]]
