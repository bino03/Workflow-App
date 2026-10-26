# Sessão guiada (conversa, cartões de escolha, cartão de permissão)

> ✅ Baseado em `frontend/src/components/guided/*`, `components/common/Markdown.tsx`, `pages/NewProjectPage.tsx` e
> nas classes da secção "Sessão guiada" do `index.css`; verificado em Chrome headless (DOM + estilos computados +
> capturas: `/_guided` 30/30, `/new-project` 30/30) a 2026-10-26.

> Parte de [[../frontend-visual-consistency]]. Feature: [[../../../features/novo-projeto-guiado]] ·
> [[../../../adr/0020-sessoes-guiadas]].

Uma vista que substitui o terminal quando o Claude conversa com o dono: de cima para baixo a **conversa**, e no
fundo **o que o estado pede** (um cartão de pergunta, um de permissão, a caixa de resposta, um aviso). Não foi feita
no Claude Design — o dono preferiu-a a partir dos tokens e dos padrões que já existiam (faixa de estado, card,
tags de estado).

## Coluna

- Uma coluna de **760 px** centrada (`mx-auto max-w-[760px] px-6 py-8`), `gap-6` entre a conversa e o painel do
  fundo. A página desce sozinha quando chega uma entrada nova ou o estado muda.
- Cabeçalho como o resto da app: `kicker` + `text-display`, e à direita a **tag de estado** (cor + forma, de
  [[tokens-and-colors]] §3: a trabalhar `tag-work` · à tua espera `tag-wait` · parada `tag-stop` · criado `tag-run` ·
  falhou `tag-err`), **Ver terminal** (`size="small"`, ícone `CodeOutlined`) e **Cancelar** (`type="text" danger`,
  com confirmação). Ver terminal está sempre lá: é o escape para o que a vista não sabe mostrar.
- Antes de Ver terminal, enquanto a sessão não terminou: **Permissões** (rótulo `text-3` 12.5 px) + `Select`
  `size="small"` de 120 px com **Perguntar** · **Automático** ([[../../../adr/0021-permissoes-das-sessoes-guiadas]]).
  Troca na hora, sem confirmação (volta-se no mesmo sítio); o `title` de cada opção explica-a. As perguntas
  continuam a ser cartões em Automático.

## A conversa (`GuidedFeed`)

`role="log"`, `aria-live="polite"`, `gap-4` entre entradas.

| Entrada | Aspeto |
|---|---|
| Texto do Claude (`AssistantMessage`) | **Sem bolha**: `kicker` "Claude" e o Markdown (`.md`) a toda a largura — as propostas têm tabelas e árvores que precisam de espaço |
| Texto do dono (`UserMessage`, o brief incluído) | **Bolha** à direita, até 85 %: `.chat-user` — `accent-subtle` + borda `accent-border`, raio `lg`, `white-space: pre-wrap` (as quebras de linha ficam) |
| Pergunta respondida (`AnsweredQuestion`) | Compacta: barra à esquerda `border-l-2 accent-border`, a pergunta em `text-3` 12.5, a resposta em `text-1` 13.5/500 — o label sem "(Recommended)" |
| Permissão decidida (`PermissionLine`) | `.feed-line`: ✓ `success` "Permitido" / ✕ `error` "Recusado" + o alvo em mono (`.feed-target`) |
| Atividade (`ActivityLine`) | `.feed-line`: ícone `ToolOutlined` + o resumo ("Leu 6 ficheiros · Fez 2 pesquisas") em `text-3` 12.5 |

Uma pergunta **por responder** não aparece na conversa: está no cartão do fundo.

### Markdown (`components/common/Markdown.tsx`, `.md`)

`react-markdown` + `remark-gfm`, **`skipHtml`** e sem `rehype-raw` (HTML do modelo nunca é interpretado),
**sem imagens** (`disallowedElements: ['img']` — um `![](url)` faria o browser pedir um URL alheio), links com
`target="_blank" rel="noopener noreferrer"`. O estilo é só tokens: títulos 20/16/14, listas com marcador `text-3`,
código inline mono 12.5 em `surface-2` com borda, blocos `pre` em `surface-1` com borda e raio `md`, citação com
barra `accent-border`, tabelas com hairline `border` e cabeçalho `surface-1` em `text-2`. Reutilizável (o resumo do
fim usa-o; a revisão da importação pode passar a usá-lo).

## Cartão de pergunta (`QuestionCard`)

- `.card p-4`, uma secção por pergunta (`fieldset`): `kicker` com o `header`, a pergunta em 16/24 600, e a dica
  "Escolhe uma." / "Podes escolher várias." em `text-3` 12.
- **Cada opção é um cartão clicável** (`.option-card`, `button` com `role="radio"` ou `"checkbox"` e
  `aria-checked`): `surface-1`, borda `border`, raio `md`; hover `surface-2` + `border-strong`; foco com contorno
  `accent`; **escolhida** = `accent-subtle` + borda `accent`. À esquerda a **marca** (`.option-mark`): **círculo**
  numa escolha única, **quadrado** numa múltipla — forma e cor, nunca só cor —, cheia de `accent` com um ponto
  `on-accent` quando escolhida. Label 14/500, descrição 13 `text-3`.
- **"(Recommended)"/"(Recomendado)"** sai do label e passa a etiqueta `tag-ok` "Recomendado" ao lado. A resposta
  enviada leva o label **tal como veio** (é por ele que o Claude a reconhece).
- **"Outro"** é sempre a última opção (o Claude Code junta-a sempre); escolhida, abre por baixo um `TextArea`
  (`autoSize` 1–6, até 4000). Numa única, escolher "Outro" limpa a outra; numa múltipla, soma-se.
- Várias perguntas no mesmo cartão, **um** botão **Responder** (`primary`, à direita), ativo só quando todas têm
  resposta.

## Cartão de permissão (`PermissionCard`)

A faixa de estado ([[cards]] → "Faixa de estado") em versão bloco: `.status-banner.is-wait p-4` — o dono é que
falta. Linha de cima: losango `state-icon is-wait`, "O Claude pede permissão" 14/600 e a ferramenta numa `.tag`
mono. Por baixo, o que vai correr ou escrever num `.code-line` (mono 12.5 sobre `bg`, borda, quebra palavras
longas). À direita, **Recusar** (secundário) e **Permitir** (`primary`). Nunca mostra o conteúdo a escrever — só o
comando ou o caminho.

## Caixa de resposta (`ReplyBox`)

`.card p-3`: `TextArea` (`autoSize` 3–12, até 8000, foco ao aparecer), erro de campo por baixo, e uma linha com
`.kbd` "Ctrl+Enter" envia à esquerda e **Enviar** (`primary`) à direita. RHF + Zod (`trim().min(1).max(8000)`).
**Sem lista branca de caracteres**: é uma mensagem para o Claude, como escrever no terminal — o backend tira os
caracteres de controlo. Limpa-se só se o envio correu bem.

## Outros painéis do fundo

| Estado | Painel |
|---|---|
| A trabalhar | `.feed-line` com o arco `state-icon is-work` (roda) + "O Claude está a trabalhar…" + a última atividade |
| Precisa de ti (o que a vista não mostra) | Faixa `is-wait` + **Ver terminal** (`primary`) |
| Parada | Faixa `is-stop` + **Retomar** (`primary`) |
| Terminada | `.card p-5`: ponto `is-run` + "Projeto criado", a pasta num `.code-line`, o resumo em Markdown, "Decisões em aberto" (`kicker` + lista), o próximo passo em mono; **Fechar** e **Abrir projeto** (`primary`) |
| Falhou | Faixa `is-err` em bloco: o erro, o resumo se houver, **Ver terminal** e **Fechar** (`primary`) |

## Partilhado: `GuidedConversation` (2026-10-26)

O feed + o painel do fundo de `working`/`question`/`permission`/`waiting-text`/`needs-you` vivem em
`components/guided/GuidedConversation.tsx`, usado pelo Novo projeto e pela Upwork. O que depende do propósito entra por
props: `onSend` (a rota de envio), `endPanel` (o painel de `stopped`/`done`/`failed`) e `copyable`. A tag de estado
(`GuidedStatusTag`, com `labels` para renomear um estado) e o seletor de permissões (`GuidedModeSelect`) também.
Ações do dono: `hooks/useGuidedAct.ts`.

- **Copiar** (`components/common/CopyButton.tsx`): `Button size="small" type="text"` com `CopyOutlined`; depois de copiar
  passa 1,5 s a "Copiado" com `CheckOutlined` em `success` — a confirmação é o próprio botão, sem notificação. Copia o
  Markdown cru. Nas mensagens do Claude (`copyable`) fica à direita do kicker "Claude".
- **Sessão em pausa que acorda ao escrever** (Upwork, ADR 0022): `stopped` não mostra **Retomar** mas a faixa `is-stop`
  ("Em pausa… Escrever aqui retoma a conversa") **e** a `ReplyBox`; enquanto acorda, a faixa troca para o arco
  `is-work` + "A retomar a sessão…". A tag diz "Em pausa", não "Parada". Sem Ver terminal nem Pausar enquanto pausada.

## Pacote da Upwork (`components/upwork/PackageCards.tsx`, 2026-10-26)

Um `.card p-4` por parte, pela ordem de uso (Análise · Carta · Respostas de triagem · Plano técnico · Perguntas ao
cliente): título 14/600, a tag do veredicto só na Análise, "para o cliente"/"para ti" em `text-3` 12, **Copiar** à
direita, e o Markdown. Por cima, uma linha `text-3` com a hora da última revisão e a língua. **A gerar**: os mesmos
cinco títulos em cartões baixos a .6 de opacidade com o arco `is-work` e "em espera", e a conversa logo por baixo —
uma pergunta da skill tem de se ver sem mudar de separador. Com o pacote pronto e o Claude à espera (pergunta,
permissão), uma faixa `is-wait` por cima dos cartões leva à Conversa.

## Drift encontrado — não repetir

_Nenhum ainda._

## Relacionado

[[cards]] · [[tokens-and-colors]] · [[buttons-and-icons]] · [[forms-and-validation]]
