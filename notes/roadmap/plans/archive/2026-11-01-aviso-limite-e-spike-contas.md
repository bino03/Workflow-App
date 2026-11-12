# Plano — 2026-11-01 aviso-limite-e-spike-contas

**Estado**: concluído
**Âmbito escolhido**: Tudo (na prática: aviso dos 90% + spec Várias contas a partir do passo 1; os passos 8 da Pré-visualização e 11 da Upwork são do dono)
**Orçamento da sessão**: sem limite

## Esclarecimentos já obtidos
- Onde se guarda o OK? → no browser (`localStorage`), não no servidor.
- Que avisos? → 5 h aos 90%, 5 h aos 100% e semanal aos 90% (cada um com o seu OK).
- "Mesma janela"? → guarda-se o `resetsAt` avisado; só volta a avisar depois de essa hora passar (imune a oscilações de segundos).
- Valores de uma janela já renovada (`resetsAt <= now`) não avisam. Valores "velhos" (>10 min sem atividade) avisam: o `usedPct` só sobe dentro da janela.
- Sondagem → um `UsageContext` partilhado (o modal e o `QuotaMeter`), prepara o `AccountsContext` da spec de contas.
- Abas → cada aba avisa por si; sem sincronização.
- Spike de contas → o dono está disponível nesta sessão para o login da 2.ª conta.

## Ordem confirmada
1. [x] Aviso de limite da quota (modal só com OK) — concluída (27/27 no Chrome headless)
2. [x] Spec Várias contas — 10/10 passos, passo 10 verificado na app real a 2026-11-07 — concluída

## Próximo passo
Nenhum: plano concluído (2026-11-07).
