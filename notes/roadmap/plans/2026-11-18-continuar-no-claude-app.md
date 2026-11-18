# Plano — 2026-11-18 continuar-no-claude-app

**Estado**: em curso
**Âmbito escolhido**: o item "Continuar no Claude app" (MVP), dividido em 3
**Orçamento da sessão**: sem limite
**Modelo**: tarefa 1 `opus` · 2 `sonnet` · 3 `opus` (sessão em Opus)

## Esclarecimentos já obtidos
- O feed vazio do spike: bug do script `backend/scripts/guided-rc-spike.ts:80` (`CLAUDE_CONFIG_DIR=` vazio → `projects` relativo). O `buildFeed` sobre o `.jsonl` da 4.ª corrida já mostra a mensagem do app e a resposta à pergunta. Faltam só as permissões aprovadas no app (`permissionDecision` na linha do tool_result, `source: user_temporary`).
- Retomar (backend reiniciou / terminal morreu) → limpa o `remote`; perguntas e permissões voltam à página.
- Esconder/Manter → no ficheiro de controlo (`display`), trocável depois ("Mostrar a conversa" / "Esconder").
- Permissões do app no feed → linha de permissão com a marca "no Claude app".
- Escondido → cabeçalho (estado, Permissões, Ver terminal, Cancelar) + cartão "A responder no Claude app — há um terminal a correr em fundo"; o painel final aparece como sempre.
- Por omissão: o estado mantém o real (`working`/`needs-you`/`waiting-text`) + `remote: true` na vista; só `create`; `GUIDED_005` = já está no app; fora de `waiting-text` → `GUIDED_004`; o seletor Perguntar/Automático fica; `SavedTerminal.remoteControl` fica `false`; desligar o remote fica fora (ADR 0033).

## Ordem confirmada
1. [x] `opus` Backend (controlo, rota, hook, Retomar, feed, claudeArgs, testes, docs) — concluída (614/614)
2. [x] `sonnet` Frontend (botão, escolha, cartão, estado) + browser numa instância descartável — concluída (guided-claude-app.mjs 28/28)
3. [ ] `opus` Pôr na 7400 + verificação real no Claude app, com o dono — por começar

## Próximo passo
Tarefa 3, com o dono: commit + push, reiniciar o backend da 7400 (mata os terminais — o dono escolhe o momento), uma criação real → Continuar no Claude app → pergunta, permissão aprovada **e uma recusada** no app → ver o feed (Manter aberto) e o aviso (Esconder aqui). Confirmar o formato da recusa no `.jsonl` (`permissionDecision.decision: reject`?).
