# Plano — 2026-10-23 scripts-verify-e-upload-real

**Estado**: concluído
**Âmbito escolhido**: Tudo (2 itens do ToDo)
**Orçamento da sessão**: sem limite

## Esclarecimentos já obtidos
- Scripts: onde vivem → `scripts/verify/` na raiz, versionado; a pasta de execução (dados, roots, credenciais) fica fora do repo (`%TEMP%` ou argumento).
- Login de teste → o start gera password aleatória + hash argon2 a cada arranque, na pasta de execução; o driver lê-os de lá.
- Cenários → só infra + 1 cenário de exemplo (login + smoke). Os antigos (`verify-tabs-grid`, `verify-kb`, `verify-rc`) não se portam.
- Decidido por omissão (no plano, sem objeção): ESM `.mjs` com WebSocket/fetch globais do Node 24 (sem dependências); a instância anula `TELEGRAM_BOT_TOKEN` (vazio → `undefined`) e usa `SESSION_SECRET` próprio; paragem pelo PID que escuta na porta com `taskkill /T /F` e confirmação por `/api/health`; sementes como opções do start; `docs/operations.md` passa de "Playwright" para o CDP direto.
- Upload real → feito pela sessão, com a instância de teste a apontar ao `WORKFLOW_PATH` real, login de teste pelo formulário, stack `tauri`; o dono aprova o prompt de escrita na pasta partilhada. Limpeza: apagar o ficheiro, `git checkout -- library/stacks/tauri/STACK.md` e apagar a pasta `skills/` vazia que o `mkdir` cria.

## Ordem confirmada
1. [x] `scripts/verify/` — driver CDP, start/stop da instância de teste, cenário de exemplo, docs — concluída (smoke 6/6, stop sem órfãos)
2. [x] Upload de skills, passo 6 contra a biblioteca real (com os scripts do passo 1), limpeza, fecho da spec — concluída (18/18 contra a biblioteca real, limpa)

## Próximo passo
Nada — plano concluído.
