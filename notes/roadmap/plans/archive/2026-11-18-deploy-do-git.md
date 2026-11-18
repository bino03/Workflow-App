# Plano — 2026-11-18 deploy-do-git

**Estado**: concluído
**Âmbito escolhido**: secção Projetos do ToDo (deploy automático a partir do git)
**Orçamento da sessão**: sem limite
**Modelo**: tarefa 1 `opus` · 2 `sonnet` (sessão em Opus para as duas)

## Esclarecimentos já obtidos
- Bloco `> Decidido (via refine-idea, 2026-11-18)` do bullet do ADR — campo "Branch de deploy", histórico com origem `git`, sync ao abrir /projects (≤1×/5 min) + botão, data do commit em `origin/<branch>`, segurança como o ADR 0019.
- Pasta que não é a raiz do repo → `git -C <pasta>` sobe sozinho; a raiz (`rev-parse --show-toplevel`) tem de estar dentro de `ALLOWED_ROOTS`, senão aviso.
- Duplicados / deploy apagado / fora dos 20 → cada ambiente guarda o último hash sincronizado; só entra deploy quando o topo muda.
- Disparo em fundo → o frontend chama `POST .../git-sync` por projeto com branch; limite de 5 min em memória no backend; o botão ignora o limite.
- Fetch → `fetch --no-tags --no-write-fetch-head -c gc.auto=0 origin <branches>`, `GCM_INTERACTIVE=never`, `credential.interactive=false`, SSH `BatchMode=yes`; falhas = aviso.
- Por omissão (confirmado no plano): só `origin`; um fetch por projeto; data = `%cI`; resposta `{ info, warnings[] }` por ambiente; branch validada por regex zod (partilhada com o frontend) + `--end-of-options`; timeouts 15 s fetch / 5 s log; git em falta = aviso.

## Ordem confirmada
1. [x] `opus` ADR 0034 — deploy automático a partir do git — concluída
2. [x] `sonnet` Implementar (schema, projectGit.ts, rota, testes com repo temporário, UI, docs) — concluída

## Próximo passo
Nenhum — as duas tarefas estão feitas (2026-11-18).
