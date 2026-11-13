# Plano — 2026-11-13 terminais-estados-grelha-stop

**Estado**: em curso
**Âmbito escolhido**: tema Terminais (sem os ícones de estado — o dono escolhe o design depois)
**Orçamento da sessão**: sem limite
**Modelo**: tarefa 1 `opus` · 2-5 `sonnet` (mudar com `/model` depois da 1, ou retomar noutra sessão)

## Esclarecimentos já obtidos
- Estados — ligação hook → terminal → **variável por terminal** `WFA_TERMINAL_ID` no ambiente do PTY (não o `session_id`; aguenta `/clear` e `/resume`). O spike confirma que o hook a herda. Prefixo fora da lista negra do `spawnClaude.ts:20-48`.
- Estados — regresso de "Precisa de ti" a "A trabalhar" → **`PostToolUse` não bloqueante grava atividade** (serve também os agentes).
- Estados — quem ganha estado → **só os terminais normais** (sem `importId`/`guidedId`, não escondidos); login e `/run` ficam sem estado.
- Estados — antes do primeiro evento (abrir / retomar) → **"À tua espera"**; o evento antigo limpa-se ao abrir/reabrir.
- Estados — campo novo (`activity`), o `status` não muda (bot, `runningCount`, filtros dependem dele). (proposta do investigador, assumida)
- Estados — distinguir permissão de "parado 60 s": `notification_type` se o spike o confirmar; senão a heurística do guiado ("Notification logo a seguir a Stop ignora-se", `guidedFiles.ts:164`).
- Agentes — bullet partido: o spike e o contrato `agents[]` no ADR 0031 vão na tarefa 1 (`opus`); a implementação é a tarefa 2 (`sonnet`).
- Ícones — **design por escolher pelo dono** → fora deste plano (⚠️ no ToDo). Chips de filtro e contagens do cabeçalho **não mudam**.
- Grelha — só os caminhos do bullet (`handleCreate`: "+" da lateral, "Noutra conta", Novo terminal, Retomar sessão, atalho) vão para o 1.º lugar livre; `focusTerminalId` (Novo projeto, importações, Upwork), "Ver terminal", menu Ampliar, Alt+N e duplo clique continuam a ampliar. Lugar livre = `null` **ou** id que já não existe, saneado com os terminais do projeto alvo (pode não ser o ativo).
- `/stop` (passo 7) → **os três filhos**: Workflow App, Gestao-Sock, PortFolio. Antes, commit à parte da atualização pendente do Workflow (`15c58e8` → `b55f327`) que está por gravar nesta app.
- Passo 8 da correr-a-app → **nesta sessão, no fim**.

## Ordem confirmada
1. [x] `opus` Estado das sessões (backend): spike único (estados + agentes) → ADR 0031 (muda o 0012; contrato `activity` + `agents[]`) → `session-hook.cjs` + leitor → `activity` no `TerminalView` → testes com stdin real → terminal real nos 4 estados → `protocol.ts`, `api.md`, spec Terminais §2, frontend `types/terminal.ts` — concluída (ADR 0031; spike e check reais; commit a seguir)
2. [ ] `sonnet` Agentes por terminal (backend) — era `opus`: a decisão foi para a 1 — por começar
3. [ ] `sonnet` Terminal novo no primeiro lugar vazio da grelha + spec estilos-de-grelha §2 + cenário verify — por começar
4. [ ] `sonnet` correr-a-app passo 7: commit da atualização pendente; `/upgrade-project` com o `/stop` nos três filhos — por começar
5. [ ] `sonnet` correr-a-app passo 8: verificação real no browser — por começar

## Próximo passo
Tarefa 2 (`sonnet` — `/model` para Sonnet se quiseres): agentes no `session-hook.cjs` — `SubagentStart`/`PostToolUse(Agent)`/`SubagentStop` em `DATA_DIR/session-state/<id>/agents/` (um ficheiro por evento), `TerminalView.agents`, limpeza dos `done` num `UserPromptSubmit` que não seja `<task-notification>` (ADR 0031 pontos 5-6).
