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

Conceito (PT, na UI e nos docs) → identificador (EN, no código). ✅ Confirmado no `/design-database`
(2026-09-28) — ver [[../../database]].

| Conceito (PT) | No código (EN) | Estado |
|---|---|---|
| Terminal (a correr) | `Terminal` | ✅ processo `claude` num PTY, em memória |
| Terminal guardado / parado | `SavedTerminal` | ✅ `state.json` → `terminals`; parado = guardado mas sem processo |
| Terminal fechado (histórico) | `ClosedTerminal` | ✅ `state.json` → `closedTerminals` (últimos 200, com resumo) |
| Pasta recente / favorita | `Folder` | ✅ `state.json` → `folders` |
| Sessão gravada do Claude Code | `ClaudeSession` | ✅ lida de `~/.claude/projects/`, não é da app |
| Entrada da biblioteca (stack, design, skill) | `LibraryEntry` (`kind`: `stack` · `theme` · `skill`) | ✅ só leitura, de `library/` |
| Quota / uso | `UsageSnapshot` | ✅ calculada, não guardada — fonte por decidir |
| Projeto | `Project` | futura (painel de projetos é ideia, não MVP) |

### Termos que parecem sinónimos e não são

| Termo | O que é | Não confundir com |
|---|---|---|
| **Terminal** | Um processo `claude` a correr agora, num PTY da app | **Sessão gravada** — a conversa que o Claude Code guardou em disco e que se pode retomar |
| **Fechar** um terminal | Matar o processo e passá-lo ao histórico; a sessão fica gravada | **Terminar** — o processo saiu sozinho (ex.: `/exit`) · **Parado** — guardado, sem processo porque o backend reiniciou |
| **Reabrir** | Relançar um terminal **parado** com `--resume <claudeSessionId>` | **Retomar** — escolher uma sessão gravada qualquer da pasta |
| **Retomar** | Abrir um terminal novo com `--resume <uuid>` | **Religar** — voltar a ligar o browser a um terminal que nunca parou |
| **Quota** | Uso da subscrição (janela de 5h, tecto semanal) — da conta | Rate limits da API (não se aplicam — não se usa a API) |
| **Biblioteca** | `library/` do Workflow (só leitura) | O vault deste projeto |
