# Plano — 2026-11-07 aviso-limite-por-conta

**Estado**: concluído
**Âmbito escolhido**: um item da Manutenção — "O OK do aviso de limite não distingue contas"
**Orçamento da sessão**: sem limite

## Esclarecimentos já obtidos
- Migração dos OK antigos (sem conta) → atribuir à `primary` (era a única conta antes da feature).
- OK de contas removidas → podar ao escrever as entradas cujo `resetsAt` já passou; sem depender da lista de contas.
- Conta ativa ainda desconhecida (`active === null`) → o modal não avisa até haver conta.
- Fonte da quota → `active.usage` do `useAccounts` (vem na mesma resposta que `activeAccountId`), não `useUsage().usage`.

## Ordem confirmada
1. [x] OK do aviso de limite por conta — concluída (40/40 no Chrome headless)

## Próximo passo
Nenhum: plano concluído (2026-11-07).
