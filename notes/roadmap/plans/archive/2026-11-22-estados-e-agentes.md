# Plano — 2026-11-22 estados-e-agentes

**Estado**: concluído
**Âmbito escolhido**: tema Terminais — ícones de estado + UI dos agentes (os dois bullets divididos em 3; `lastAction` fica no ToDo à parte)
**Orçamento da sessão**: sem limite
**Modelo**: tarefa 1 `opus` · 2-3 `sonnet` (mudar com `/model` entre os blocos, ou retomar noutra sessão)

## Esclarecimentos já obtidos
- Investigação: o redesign de 2026-11-21 (ADR 0036) não implementou nada; `activity`/`agents` chegam ao frontend (`useTerminals`, 10 s) e nenhum componente os lê. A lateral já só mostra o projeto ativo; o sítio com vários projetos é o `ProjectSwitcher` (`:147-150`). Classes reaproveitáveis em `frontend/src/index.css:597-641` (`.is-work`, `.is-wait`, `.is-stop`, `.is-run`); falta o losango vazio.
- Tag "A correr"/"Terminado"/"Parado" do cabeçalho (`TerminalPane.tsx:210`) → **sai**; o ícone à esquerda mostra a activity e o tooltip diz o estado.
- Estado mais urgente por projeto (número no tooltip) → **nos três**: seletor de projeto, ao lado do nome do projeto ativo na lateral, losango ao lado de "Terminais" na navegação de topo.
- Losango em "Terminais" → **só sessões fora de vista** (outro projeto ou escondidas); cheio = precisa de ti, vazio = à tua espera.
- Lista TERMINAIS → ícone pela activity, com o ponto `.is-run` como reserva para `activity: null`; o `pane-N` fica.
- Terminal escondido em precisa de ti / à tua espera → destaque (fundo `-subtle` + borda `-border`) **entra já**.
- Chips de filtro e contagens do `TerminalsHeader` não mudam (decidido a 2026-11-13).
- Agentes → **os dois**: contador no cabeçalho com lista curta + sublinhas na lista TERMINAIS.
- Agentes mostrados → **só os a correr**. Tempo → **duração** (há quanto tempo está a correr).
- Sessões guiadas (encontrado na tarefa 1) → **alinhar na tarefa 2**: pergunta/permissão/`needs-you` = losango cheio "Precisa de ti"; `waiting-text` = losango vazio `.is-idle` "À tua espera". Mapas em `GuidedConversation.tsx:22-25,120`, `ImportBanner.tsx:20`, `ApplicationDetail.tsx:172`; doc em `design/guided-session.md:23`; `TokenPreviewPage.tsx:45`.
- Por omissão (ditos ao dono, sem objeção): urgência precisa de ti > à tua espera > a trabalhar; o contador de agentes aparece também no cabeçalho compacto; `lastAction` fora (item próprio no ToDo).

## Ordem confirmada
1. [x] `opus` Contrato visual dos estados (tokens §3: renomear o losango cheio, losango vazio, urgência, losango da navegação, escondido) — concluída (só doc)
2. [x] `sonnet` Ícones de estado (cabeçalho sem tag, lista, seletor, nome do projeto, losango da navegação, escondido, **guiadas alinhadas**) + browser em foco e em grelha — concluída (session-state-icons 46/46 + 9 cenários antigos; Importação/Upwork pendentes no browser). A lista de terminais está agora num `TerminalsProvider` no `AppLayout` (`useSharedTerminals`)
3. [x] `sonnet` Agentes (contador + lista no cabeçalho e no compacto, sublinhas na lateral) + browser — concluída (terminal-agents 37/37 ×3 + 7 cenários antigos; prova real: model e description chegam preenchidos). **Prova real a mais** (pergunta do dono, 2026-11-22): lançar um agente **em background** a partir de um terminal da app e ver se `model` e `description` vêm preenchidos — o `PostToolUse` de um agente em background chega logo ao lançar e pode não trazer `agentId`/`resolvedModel` (`backend/src/terminals/sessionState.ts:96-104`); se vierem vazios, a UI tem de aguentar só com o tipo, e fica um bullet no ToDo.

4. [x] `sonnet` Nome do projeto ativo na barra dos Terminais (sempre visível, ícone do mais urgente, abre o seletor) — concluída (header-project-name 31/31 ×3 + 6 cenários antigos); depois da 3 (o `TerminalsPage` pode ser tocado pelas duas). Pedido do dono a meio da sessão.

## Próximo passo
Nenhum — plano concluído (2026-11-22). Seguem no ToDo → Terminais: WebSocket de eventos (`opus`) e `lastAction` dos agentes (`opus`).
