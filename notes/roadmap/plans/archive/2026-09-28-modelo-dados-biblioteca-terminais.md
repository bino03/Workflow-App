# Plano — 2026-09-28 modelo-dados-biblioteca-terminais

**Estado**: concluído (2026-09-28)
**Âmbito escolhido**: Tudo (Modelo de dados + MVP). "Antes de sair de `127.0.0.1`" adiado para `notes/ideas.md` com contexto.
**Orçamento da sessão**: sem limite

## Esclarecimentos já obtidos
- Vida dos PTYs sem browser → continuam até Fechar ou reinício do backend
- `MAX_TERMINALS` → 8 (omissão atual); só os vivos contam (parados do `state.json` não); a grelha faz scroll depois de 6
- Scrollback → 1 MiB cru + `term.reset()` + resize ±1 para forçar redesenho
- Estados "a trabalhar"/"à tua espera" → fora do MVP (só a correr / terminado / parado); já estão em `ideas.md`
- `claude` que saiu sozinho sem Fechar → fica terminado em `terminals`, banner com Reabrir (`--resume`) no mesmo painel
- Reabrir com `.jsonl` em falta → erro próprio `TERMINAL_*`, o terminal fica parado e pode ser fechado
- "Continuar a última" → o backend descobre a sessão mais recente da pasta e usa sempre `--resume <uuid>` (nunca `--continue`); retomar uma sessão já aberta noutro terminal é recusado
- Terminais escondidos → xterm e WebSocket ficam montados
- Biblioteca, camada → coluna/filtro por `layer` só na tab Stacks; Skills filtram por `category`; Designs sem camada
- Biblioteca, maturidade → 3 chips (Provado = proven; Parcial = partial/adapted; Rascunho = planned/draft/prospective); a tag mostra o valor original
- Biblioteca, detalhe → só frontmatter (ADR 0005); sem "Usado em"; corpo Markdown fica na ideia "ler os docs completos"
- Biblioteca, agentes/placeholders → sem agentes (glob do ADR 0005 à letra); placeholders `{{…}}` crus
- Quota, fonte → status line injetada pela app: `claude --settings` com um `statusLine` fixo que grava o JSON (`rate_limits.five_hour`/`seven_day`) em `DATA_DIR`
- Quota sem valor fresco → último valor a cinzento + "há X min"; "—" depois da hora de reposição
- Exposição → adiada para `ideas.md`
- Terminais → spec via `/plan-feature` em `docs/features/terminais.md`, que inclui Terminais guardados, Pastas, Retomar sessões, Definições e Quota
- Na entrevista da spec (2026-09-28): histórico dos fechados só na lista Retomar; favoritas/recentes por cima do navegador de pastas; clicar na grelha amplia temporariamente; se o spike não confirmar `rate_limits`, a quota sai da spec
- Nome de utilizador no login (pedido a 2026-09-28, a meio da tarefa 2) → logo a seguir à Biblioteca; `APP_USERNAME` no `.env` (valor `bino03`), obrigatório e validado no arranque; username ou password errados dão o mesmo `AUTH_001`; ADR novo (muda o contrato do ADR 0003)
- Defaults técnicos anunciados (sem objeção): `DATA_DIR` criada se faltar e tem de ser absoluta; falha de escrita após retries → log, estado em memória até à próxima escrita; `Alt+…` intercetados antes do PTY; pastas fora de `ALLOWED_ROOTS` escondidas; o diálogo de trust aparece no próprio terminal

## Ordem confirmada
1. [x] `StateStore` (item 1 de "Modelo de dados") — concluída
2. [x] Biblioteca (backend `/api/library/*` + ecrã 1l/1m) — concluída (2026-09-28; ver whatIveDone)
3. [x] Nome de utilizador no login (`APP_USERNAME`, ADR 0011) — concluída (2026-09-28)
4. [x] Spec `docs/features/terminais.md` via `/plan-feature` — concluída (2026-09-28; 17 passos, ADR 0012)
5. [x] Executar a spec (Terminais, Terminais guardados, Pastas, Retomar sessões, Definições, Quota) — concluída (2026-09-28; 17/17; lateral por projetos a pedido do dono)

## Commits

Tarefas 1-3 commitadas a 2026-09-28 (sem push): `ff3bdec` StateStore · `a7e1787` Biblioteca · `9210eb3` nome de utilizador.

## Próximo passo
Nenhum — plano concluído. O que falta está no `notes/ToDo.md`.
