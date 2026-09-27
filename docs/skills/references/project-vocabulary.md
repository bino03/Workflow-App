# Vocabulário de UI

**When to use**: ao descrever código existente a uma pessoa, ou ao ler um pedido em prosa para
decidir o que construir. Os termos abaixo têm significados **exatos** — usar o errado manda quem
lê para o sub-ficheiro de design errado.

No projeto gerado, este ficheiro junta-se à tabela de domínio (conceito PT → identificador EN) num
só `project-vocabulary.md`.

---

## Contentores

| Termo | O que é |
|---|---|
| **Drawer** / painel lateral | Overlay que desliza de um bordo, altura toda, cabeçalho e rodapé fixos |
| **Modal** | Overlay centrado, cresce com o conteúdo |
| **Diálogo de confirmação** | O diálogo partilhado de confirmar ações (`useConfirm()` ou equivalente) |
| **Página** | Tem rota no router |
| **Lista / tabela** | Tabela + coluna de ações partilhada |
| **Card** | Bloco de conteúdo dentro de uma página ou drawer |
| **Notificação / toast** | O canal único de mensagens transitórias |

**Drawer vs. Modal é a confusão mais comum** — até documentação escorrega ("use Drawers for
modals"). Trocar os termos numa conversa corrige-se em silêncio; só se assinala quando a diferença
muda o que vai ser escrito.

## Estilo

| Termo | O que é |
|---|---|
| **Token** | Uma variável do ficheiro de tokens — a fonte de verdade da paleta |
| **Classe utilitária** | Classe partilhada (`.card`, `.tag`, `.elev-sm`) |
| **Kicker** | Rótulo pequeno em caixa alta por cima de um título, que dá contexto |
| **Drift** | Código que contraria uma convenção já decidida |
| **Prospetivo** | Convenção combinada que ainda nenhum código validou |

## Como referir um componente sem ambiguidade

O mais fiável não é acertar no termo — é **dar uma âncora**:
- o **nome do ficheiro** — "o `OrderItemPickerModal`"
- o **caminho até lá** — "o painel que abre quando clico Associar na lista"
- a **rota** — "o ecrã em `/orders/:id`"

## Relacionado

[[ux-patterns]] · [[../principles/naming-conventions]]

---

## Vocabulário do domínio — Workflow App

Conceito (PT, na UI e nos docs) → identificador (EN, no código). **Proposta** — a entrevista deixou as
entidades em aberto ("decido mais tarde"); confirmar no `/design-database`.

| Conceito (PT) | No código (EN) | Estado |
|---|---|---|
| Terminal / sessão aberta | `Terminal` | proposta — processo `claude` num PTY, vive em memória |
| Sessão gravada do Claude Code | `ClaudeSession` | proposta — lida de `~/.claude/projects/`, não é da app |
| Entrada da biblioteca (stack, design, skill) | `LibraryEntry` (`kind`: `stack` · `theme` · `skill`) | proposta — só leitura, de `library/` |
| Quota / uso | `UsageSnapshot` | proposta — fonte por decidir |
| Projeto | `Project` | ❓ talvez (painel de projetos é ideia, não MVP) |

> A6: "aqui ainda não sei, decido mais tarde" — **nenhuma destas está confirmada**. O `/design-database`
> decide, e pode concluir que não há base de dados.

### Termos que parecem sinónimos e não são

| Termo | O que é | Não confundir com |
|---|---|---|
| **Terminal** | Um processo `claude` a correr agora, num PTY da app | **Sessão gravada** — a conversa que o Claude Code guardou em disco e que se pode retomar |
| **Fechar** um terminal | Matar o processo; a sessão fica gravada | **Terminar** — o processo saiu sozinho (ex.: `/exit`) |
| **Retomar** | Abrir um terminal novo com `--resume <uuid>` | **Religar** — voltar a ligar o browser a um terminal que nunca parou |
| **Quota** | Uso da subscrição (janela de 5h, tecto semanal) — da conta | Rate limits da API (não se aplicam — não se usa a API) |
| **Biblioteca** | `library/` do Workflow (só leitura) | O vault deste projeto |
