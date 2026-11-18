# Plano — 2026-11-18 indice-mensagens

**Estado**: concluído
**Âmbito escolhido**: só o item "Índice das minhas mensagens" (MVP)
**Orçamento da sessão**: sem limite
**Modelo**: tarefa 1 `sonnet` (a sessão corre em Opus)

## Esclarecimentos já obtidos
- O bloco `> Decidido (via plan-feature, 2026-11-18)` do bullet (forma DeepSeek, entradas, scroll condicional, botão ↓).
- O envio do próprio dono (mensagem ou resposta a pergunta) leva sempre ao fim → sim.
- Pergunta respondida no índice → respostas unidas por " · ", com `displayLabel`.
- Upwork: o índice aparece nos dois separadores (Conversa e Pacote) → sim, é o mesmo componente.
- Decidido na implementação (investigação): o índice monta no `GuidedFeed` (cobre o `/_guided`); o contentor de scroll é o primeiro ascendente com `overflow-y: auto|scroll`, com fallback para a janela; o accent é `--wfa-color-accent` (o `--wfa-accent` do bullet não existe).

## Ordem confirmada
1. [x] `sonnet` Índice das mensagens + auto-scroll condicional + botão ↓ — concluída (82/82 ×3; `upwork.mjs` 47/47)

## Próximo passo
Nenhum — falta só ver numa sessão real ([[../../verificacao-browser-pendente]]).
