# Drawers & Modals

> 🚧 Convenção prospetiva — ainda sem código neste projeto que a valide.

> Parte de [[../frontend-visual-consistency]]. Porquê: [[../../../../frontend/ux-patterns]] §1.

## Drawers

**Larguras por escala** — constante partilhada (`config/drawer.ts`), nunca um número por domínio:

| Tamanho | Largura | Uso |
|---|---|---|
| Small | `600` | Formulário simples |
| Medium | `900` | Criar/editar uma entidade |
| Large | `1300` ou `"80%"` | Visualização completa |

- `maskClosable`: o valor por omissão do AntD — não o definir explicitamente.
- Título: kicker (`<h6>`, cor de acento) + `<h2>`.
- Rodapé: `<Space>` alinhado à direita; cancelar/fechar primeiro, ação primária mais à direita.
- Texto dos botões via i18n (`t('common.cancel')`, `t('common.save')`), nunca hardcoded.
- Drawer de detalhe carrega por `id` (`open={!!id}`), mostra `<Spin>` enquanto carrega.

```tsx
export function OrderViewDrawer({ id, onClose }: Props) {
  const [item, setItem] = useState<Order | null>(null);
  useEffect(() => {
    if (!id) return;
    getOrderById(id).then(setItem).catch((e) => ErrorHandler.handle(e));
  }, [id]);
  return (
    <Drawer open={!!id} onClose={onClose} width={DRAWER_WIDTH.large}
            title={<><h6>Encomenda</h6><h2>{item?.name}</h2></>}>
      {item ? <OrderDetails item={item} /> : <Spin />}
    </Drawer>
  );
}
```

## Modals — só utilitários curtos

- **Drawer**: criar/editar/ver uma entidade (padrão dominante).
- **Modal**: seletor de pesquisa, visualizador de documento, histórico, reordenar, importar,
  exportar em passos (`Steps size="small"` no topo, rodapé troca Cancelar/Continuar por
  Voltar/Descarregar). Largura típica `min(640px, 94vw)`, `max-height: 88vh`, cabeçalho e rodapé fixos
  com lista a fazer scroll no meio.
- **Nunca** um formulário completo de entidade num Modal.
- Seletor sobre uma árvore grande: navegar **um nível de cada vez** (pai → filhos → netos), com
  pesquisa em todo o ramo aberto — achatar a árvore numa lista de centenas de linhas confunde.

## Confirmações

`useConfirm()` — nunca `Popconfirm`. `Modal.confirm` só quando a confirmação precisa de mais
contexto do que o diálogo partilhado permite. Ver [[buttons-and-icons]].

## Drift encontrado — não copiar

_Nenhum ainda._ Vigiar: um formulário de entidade dentro de um Modal; larguras soltas por domínio.

## Relacionado

[[cards]] · [[buttons-and-icons]] · [[forms-and-validation]]
