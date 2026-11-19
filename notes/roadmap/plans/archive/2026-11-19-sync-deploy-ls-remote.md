# Plano — 2026-11-19 sync-deploy-ls-remote

**Estado**: concluído
**Âmbito escolhido**: os dois bullets de "Projetos" (ADR + implementação do sync por ls-remote e hook)
**Orçamento da sessão**: sem limite
**Modelo**: tarefa 1 `opus` · 2 `sonnet` (sessão em Opus, faz as duas)

## Esclarecimentos já obtidos
- Gatilho do hook: `git push` ou `gh pr merge` no comando Bash (sem analisar a branch).
- Página /projects recarrega ao voltar ao separador (foco/visibilidade), nunca por temporizador.
- Botão "Atualizar do git" fica.
- Canal hook → backend: marcador `session-state/<id>/push.json` `{at}` (nunca o comando), lido por `fs.watch` no backend (debounce, fechar no `onClose`).
- `force` e `skipped` saem da rota git-sync (único cliente é o nosso frontend).
- Terminal → projeto: `SavedTerminal.cwd` (não o `cwd` do hook) igual à pasta do projeto ou dentro dela; sem chamadas ao git.
- Sem retries (`gh pr merge --auto`, push em background): aceita-se; o próximo abrir/foco apanha.
- ls-remote: sem a branch → exit 0 com stdout vazio → `no-branch`; filtrar a linha com ref exatamente `refs/heads/<b>`; validar o hash.

## Ordem confirmada
1. [x] `opus` ADR 0035 (+ índice, nota no 0034) — concluída
2. [x] `sonnet` Implementação (backend, hook, watcher, frontend, testes, docs, instância descartável) — concluída (619/619, project-git-sync.mjs 41/41)

## Próximo passo
Nada. Por ver no uso real: um push feito por um `claude` de verdade num terminal da 7400, depois de a pôr na versão nova.
