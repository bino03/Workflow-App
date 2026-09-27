# Padrões de UX (back-office)

**When to use**: ao desenhar ou construir qualquer ecrã de uma app de gestão. Independente da
biblioteca de componentes — a concretização está em `stacks/<frontend>/design/`.

> Estes padrões nasceram numa ferramenta interna densa, usada em portátil. Para uma montra
> pública ou uma app móvel, rever cada um em vez de copiar.

---

## 1. Contentores: Drawer, Modal, confirmação

| | **Drawer** (painel lateral) | **Modal** (caixa centrada) | **Diálogo de confirmação** |
|---|---|---|---|
| Altura | Sempre a altura toda | Cresce com o conteúdo | Pequeno |
| Estrutura | Cabeçalho e rodapé fixos, corpo com scroll | Corpo único | Mensagem + 2 botões |
| Uso | **Criar, editar ou ver uma entidade** — o padrão dominante | Utilitário curto e autocontido: seletor de pesquisa, pré-visualizar documento, importar, reordenar, exportar em passos | Ações destrutivas (ou irreversíveis) |
| Nunca | — | Um formulário completo de entidade | Popover de confirmação agarrado ao botão |

- O rodapé fixo do Drawer é o detalhe prático: num formulário longo, "Cancelar / Guardar" ficam
  sempre visíveis. Num Modal alto desaparecem.
- **Larguras de Drawer por escala**, não um número por domínio: Small (formulário simples),
  Medium (criar/editar), Large (visualização completa).
- Botões do rodapé alinhados à direita, ação primária mais à direita, cancelar primeiro. Texto via
  i18n, nunca hardcoded.
- Um assistente de criação de entidade com passos continua a ser Drawer; um utilitário curto com
  passos (exportar: escolher → resumo → descarregar) pode ser Modal com `Steps` no topo.

## 2. Confirmação

- **Toda a ação destrutiva passa por confirmação.** Nenhuma apaga direto.
- **Um diálogo partilhado** (ex.: `useConfirm()`), não um por ecrã.
- ⚠️ **Os defaults do diálogo são de eliminação** ("Confirmar eliminação" / "Eliminar"). Numa ação
  **não** destrutiva, passar título e rótulo — senão o utilizador lê "Confirmar eliminação" ao
  marcar algo como enviado. Aconteceu em quatro sítios.

## 3. Páginas de lista

```
[Breadcrumb]                         (só em páginas aninhadas)
[← Voltar]                           (só em páginas aninhadas)
KICKER (secção/contexto, pequeno, cor de acento)
Título da página (h1)                              [+ Ação principal]
[pesquisa ▢] [filtro ▾] [Limpar]
─────────────────────────────────────────────────────────────
tabela (moldura com linha de topo; pele global, nunca por ficheiro)
─────────────────────────────────────────────────────────────
N resultado(s)                                       ‹ 1 2 3 ›
```

- O **kicker** é contexto (secção, ou o nome do pai numa página aninhada), não um subtítulo em prosa.
- A página **não** repete o padding que o layout já aplica.
- **Colunas definidas inline** na própria página (array memoizado quando depende de `t`/estado).
- **Célula identificadora** (nome, número) com a fonte de títulos e peso 600; valores monetários
  com o mesmo tratamento. Célula vazia: `"—"` simples.
- **Estados/categorias como tags** com classes partilhadas, não badges com estilo por ficheiro.
- **Loading** no próprio componente de tabela; **empty** discreto (ícone simples + descrição).
- **Paginação com constantes partilhadas** (tamanho por omissão, opções). Listas curtas por natureza
  (filhos de um pai) não paginam.
- **Lista mestre-detalhe** (cartões à esquerda + painel à direita) quando o registo tem um corpo
  longo para ler e o volume é baixo; para volumes altos, tabela + drawer.

## 4. Coluna de ações

- **Um componente partilhado** para a coluna de ações — hierarquia definida uma vez:
  primária (botão por omissão, "Ver detalhes"), secundária (texto, "Editar"),
  destrutiva (texto em cor de acento com opacidade, "Eliminar").
- **Texto visível**, não só ícones — ninguém deve ter de passar o rato para descobrir o que um
  botão faz. Só ícone + tooltip fora das colunas de ação, onde o espaço é curto e a ação óbvia.
- **`stopPropagation` no contentor** — numa linha clicável, clicar numa ação não dispara também a
  navegação da linha (era um bug real).
- A coluna de ações não tem cabeçalho.

## 5. Botões

| Uso | Forma |
|---|---|
| Ação principal da página | Primário, tamanho normal (não "large"), com ícone `+` quando cria |
| Ação secundária | Texto, pequeno |
| Destrutiva fora de tabelas | Texto, cor de acento, opacidade reduzida |
| Voltar | Texto, pequeno, ícone ←, sem padding à esquerda, opacidade reduzida |

**Uma família de ícones por ecrã** (não misturar duas bibliotecas de ícones no mesmo ecrã).

## 6. Formulários

- **Schema declarativo + biblioteca de formulários** (ex.: Zod + React Hook Form) — nunca validação
  espalhada em `if`s.
- **O frontend nunca é mais permissivo do que o backend.** Obrigatório no DTO → obrigatório no schema,
  sem perguntar. **Só** os campos opcionais no backend são pergunta para o utilizador ("passa a
  obrigatório só na UI?").
- **Texto livre com lista branca de caracteres** + `max`; email com o validador da biblioteca;
  números com limites explícitos.
- **Mensagens de validação são chaves i18n** (com `i18n`), nunca strings fixas — uma string fixa é
  um buraco de tradução silencioso.
- **Um componente de erro de campo partilhado**, em cor de erro semântica — não o bloco
  `{errors.x && …}` copiado campo a campo (num caso real, um deles era cinzento e ninguém o lia como erro).
- **Submit**: `disabled` enquanto inválido + `loading` enquanto submete (validação `onChange` para a
  validade atualizar ao escrever). Cancelar `disabled` durante o submit.
- **Criar e editar partilham as secções do formulário** quando os campos são os mesmos (o editar
  recorta o schema com `pick`), com props para as diferenças — em vez de dois formulários que
  divergem de sistema visual a meio do mesmo drawer.
- **Perguntar a visibilidade por role** de cada campo antes de construir (padrão `roles-and-permissions` do Workflow — não incluído, sem roles).

## 7. Erros e notificações

- Todo o `catch` de chamada à API passa pelo handler centralizado ([[../principles/error-model]]).
- **Um canal de notificações** (toasts), não dois.
- Erros por campo vindos da API aplicam-se aos campos do formulário quando possível.

## 8. Navegação (app shell)

- **O layout é a única fonte de verdade da navegação persistente.** Uma rota **de topo** nova precisa
  de um item no menu — um card na home não chega. Rotas de detalhe (`:id`, sub-recursos) não entram
  no menu.
- Agrupar rotas de topo relacionadas num dropdown quando o cabeçalho passa de ~5 entradas.
- **Um único menu de utilizador** à direita (conta, definições, idioma, sair), não ícones soltos
  cujo único rótulo é o `title`. O idioma ativo aparece marcado.
- O gatilho do menu é um `<button>` com `aria-label` — alcançável por teclado.
- **Responsivo é decisão explícita**: se a app não trata ecrã pequeno, isso fica escrito; quem
  introduzir a primeira media query documenta a convenção.

## 9. Markdown de utilizador

Renderizado com uma biblioteca de markdown **sem HTML em bruto** — nunca `dangerouslySetInnerHTML`.

## Relacionado

`design-system-principles` (biblioteca do Workflow) · [[project-vocabulary]] · [[../principles/error-model]] · [[../stacks/react-vite-antd/design/README]]
