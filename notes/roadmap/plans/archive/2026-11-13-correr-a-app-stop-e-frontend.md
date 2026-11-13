# Plano — 2026-11-13 correr-a-app-stop-e-frontend

**Estado**: concluído
**Âmbito escolhido**: spec [[../../../docs/features/correr-a-app|correr-a-app]], passos 2, 5 e 6
**Orçamento da sessão**: sem limite
**Modelo**: tarefa 1 `opus` · 2-3 `sonnet` (mudar com `/model` entre os blocos, ou retomar noutra sessão)

## Esclarecimentos já obtidos
- Como o `/stop` noutra conversa confirma que um processo é do projeto → PID pela porta; lê `CommandLine`/`ExecutablePath` desse PID e dos pais (`ParentProcessId`); se algum tem o caminho do projeto, mata; senão mostra PID/nome/linha de comando e pergunta. Linux: `/proc/<pid>/cwd`.
- Modos do `/stop` → IDs das tarefas se a conversa os tem; depois confirma sempre por fora que as portas fecharam; o que ainda escutar vai pelo modo das portas.
- `docker compose down` noutra conversa → `docker compose ps` na pasta; se há serviços de pé, mostra e pergunta. Na conversa do `/run` faz `down` sem perguntar.
- `status` da skill → `prospective` até o passo 8 a provar; depois `proven`.
- Decidido sem perguntar (técnico): o `/stop` pode usar `{{RUN_PORTS_REGEX}}`; nota no `/upgrade-project` (os `RUN_*` de uma skill nova tiram-se da `skill-run.md` do filho); peças sem porta só pelos IDs.
- Investigação (Workflow): `/create` (render.mjs:458-468) e `upgrade-report.mjs:243-254` apanham a skill sozinhos por `applies-when: always`; só o `/adopt-project` tem lista à mão (`skill-adopt-project.md:182-189, 279`). Validadores: `node tools/audit-library.mjs`, `node tools/dry-run.mjs`.
- A app está a correr em dev (7400/7401) nesta sessão — não editar o backend sem avisar (regra 8 / watch).

## Ordem confirmada
1. [x] `opus` Passo 2 — skill `/stop` no Workflow + ADR 0013 (fecha o passo 1) — concluída (`6904f56` no Workflow, sem push; audit/dry-run 0 erros, upgrade-report oferece o `stop`)
2. [x] `sonnet` Passo 5 — `TerminalsHeader` comum à grelha e ao foco — concluída (terminal-menu.mjs 42/42)
3. [x] `sonnet` Passo 6 — `AppRunControl` (tipo, serviço, hook, componente) + verificação no browser — concluída (app-run-ui.mjs 26/26)

## Próximo passo
Nada — plano concluído. A spec continua no passo 7 (levar o `/stop` aos projetos) e no 8 (verificação real).
