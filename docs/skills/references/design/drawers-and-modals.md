# Drawers & Modals

> 🚧 Parcialmente validada: o drawer de detalhe baseia-se em `components/library/LibraryEntryDrawer.tsx`, verificado em Chrome headless a 2026-09-28 (600 px, kicker + título mono, `Esc` em `.kbd`, rodapé). Modals e confirmações ainda sem código.

> Parte de [[../frontend-visual-consistency]]. Porquê: [[../../../../frontend/ux-patterns]] §1.

## Drawers

**Larguras por escala** — constante partilhada (`config/drawer.ts`), nunca um número por domínio:

| Tamanho | Largura | Uso |
|---|---|---|
| Small | `540` | Formulário simples: Novo terminal, Definições |
| Medium | `600` | Ver uma entrada: detalhe da Biblioteca (manifesto) |
| Large | `900` | Visualização completa (nenhum ainda) |

Valores do handoff de 2026-09-27 (Small e Medium vêm dos protótipos; Large é derivado).

- Visual: `surface-1` + `shadow-overlay`, máscara `--wfa-color-mask`, desliza em `--wfa-dur-slow`
  (só opacidade com `prefers-reduced-motion`). Cabeçalho e rodapé com hairline `border`, padding 24.
- O cabeçalho mostra `Esc` em `.kbd` ao lado do ✕.
- `maskClosable`: o valor por omissão do AntD — não o definir explicitamente.
- Título: kicker (`<h6>`, `var(--wfa-color-accent)`) + `<h2>` title 20/26. Nomes técnicos (stack,
  pasta) no título em mono.
- O rodapé pode ter, à esquerda, um resumo do que a ação vai fazer ("Retoma 26 set · 18:42 em
  D:\projetos\api-faturas") em caption `text-3`.
- Rodapé: `<Space>` alinhado à direita; cancelar/fechar primeiro, ação primária mais à direita.
- Texto dos botões via i18n (`t('common.cancel')`, `t('common.save')`), nunca hardcoded.
- Drawer de detalhe carrega por `id` (`open={!!id}`), mostra `<Spin>` enquanto carrega. **Exceção**: se a lista já
  traz a entrada inteira e não há rota de detalhe (Biblioteca), o drawer recebe a entrada (`selected={…}`,
  `open={!!selected}`) — sem segundo pedido.
- antd 6: largura por `size={DRAWER_WIDTH.medium}` (`width` está obsoleto); o `Esc` vai em `extra`.
- Metadados em `<dl>` com grelha `96px 1fr`, 12.5px, rótulo `text-3`, valor `text-2` (mono para caminhos e ids).

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

Visual do diálogo (protótipo "Fechar terminal"): 440 px, `surface-2`, raio `lg`, `shadow-overlay`;
título "Fechar `<nome>`?" 18/24; o texto explica a consequência ("A conversa fica gravada e podes
retomá-la…"); um aviso de contexto opcional em caixa `state-*-subtle` ("Está a trabalhar agora — o
passo em curso é interrompido"); botões Cancelar (contornado) + ação real (`danger`).

**Navegação por teclado (2026-09-29)**: ao abrir, o foco vai para "Cancelar" (a ação mais segura); `←`/`→`
trocam o foco entre os dois botões; `Enter` ativa o que estiver focado (comportamento nativo do
`<button>`, sem código extra). Implementado em `ConfirmDialogContext.tsx` com `afterOpenChange` + `refs`
nos dois botões — vale para **todo** diálogo aberto por `useConfirm()`, não só o de fechar terminal.

## Drift encontrado — não copiar

_Nenhum ainda._ Vigiar: um formulário de entidade dentro de um Modal; larguras soltas por domínio.

## Relacionado

[[cards]] · [[buttons-and-icons]] · [[forms-and-validation]]
