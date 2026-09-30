# Drawers & Modals

> 🚧 Parcialmente validada: o drawer de detalhe baseia-se em `components/library/LibraryEntryDrawer.tsx`, verificado em Chrome headless a 2026-09-28 (600 px, kicker + título mono, `Esc` em `.kbd`, rodapé). Confirmações em código desde 2026-09-28 (`ConfirmDialogContext.tsx`); Modal "seletor" desde 2026-09-29 (`ResumeSessionModal.tsx`, exemplo abaixo) — nenhum dos dois verificado no browser ainda.

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

- **Drawer**: criar/editar/ver uma entidade (padrão dominante). Um drawer que recebe um **ficheiro**
  (zona de arrastar, erro do backend mostrado lá dentro) segue [[forms-and-validation]] §4.1 —
  `UploadSkillDrawer.tsx` é o exemplo.
- **Modal**: seletor de pesquisa, visualizador de documento, histórico, reordenar, importar,
  exportar em passos (`Steps size="small"` no topo, rodapé troca Cancelar/Continuar por
  Voltar/Descarregar). Largura típica `min(640px, 94vw)`, `max-height: 88vh`, cabeçalho e rodapé fixos
  com lista a fazer scroll no meio.
- **Nunca** um formulário completo de entidade num Modal.
- Seletor sobre uma árvore grande: navegar **um nível de cada vez** (pai → filhos → netos), com
  pesquisa em todo o ramo aberto — achatar a árvore numa lista de centenas de linhas confunde.

**Exemplo: seletor de lista** (`components/terminals/new/ResumeSessionModal.tsx`, 2026-09-29) — escolher
uma sessão gravada para retomar, com a pasta já conhecida (nenhum campo de pasta, nome, ou modo, só a
lista):

```tsx
<Modal open={path !== null} onCancel={onClose} width="min(640px, 94vw)"
       title={<>Retomar sessão — <span className="font-mono">{folderName(path)}</span></>}
       footer={<div className="flex justify-end gap-2">
         <Button onClick={onClose}>Cancelar</Button>
         <Button type="primary" disabled={!selected} loading={submitting} onClick={submit}>Retomar sessão</Button>
       </div>}>
  <div className="border border-border rounded-md overflow-hidden max-h-[420px] overflow-y-auto" role="listbox">
    {items.map((item) => (
      <button role="option" aria-selected={item.id === selected} onClick={() => setSelected(item.id)}
              className={`w-full text-left px-3 py-2.5 border-0 border-b border-border last:border-b-0 ${
                item.id === selected ? 'bg-surface-3 shadow-[inset_0_0_0_1px_var(--wfa-color-accent-border)]' : 'hover:bg-surface-2'
              }`}>
        {/* … */}
      </button>
    ))}
  </div>
</Modal>
```

- Cabeçalho e rodapé fixos (o `Modal` do antd já faz isto); só a lista faz scroll (`max-h-[…] overflow-y-auto`).
- Linha selecionada: `bg-surface-3` + contorno interior `shadow-[inset_0_0_0_1px_var(--wfa-color-accent-border)]`
  (nunca `border` a mais — mudava o tamanho da linha).
- `Modal.titleFontSize: 18` já vem do tema (`theme.ts` → `components.Modal`) — não repetir a escala
  20/26 do título do Drawer aqui.
- Nasceu de substituir um Drawer partilhado (pasta + modo + sessão + nome) que só tinha um entry point
  real (o ícone "Retomar" de um projeto já escolhido) — um seletor centrado, sem os campos que esse
  entry point nunca precisava, é menos bloat do que um formulário completo com metade desligada
  ([[../../../features/terminais|terminais]] passo 13, "Substituído 2026-09-29").

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
