---
tags: [adr]
status: aceite
data: 2026-11-23
---

# 0038 — Canal de eventos das sessões: um WebSocket por separador empurra `activity` e `agents`

**Data**: 2026-11-23 · **Estado**: `aceite` · **Decidido com**: o dono, no `/implement-todo` de 2026-11-23 (plano
`2026-11-23-ws-eventos-das-sessoes`). **Altera** [[0031-estado-das-sessoes-por-hooks]] (o "sem canal de eventos";
a latência deixa de ser a da sondagem). **Cumpre** [[0004-exposicao-e-modelo-de-ameaca]] (sessão + `Origin`).

## Contexto

O estado de cada sessão (`activity`, `agents`) já chega ao backend na hora: o hook do 0031 escreve
`DATA_DIR/session-state/<id>/…` a cada evento. Mas o browser só o vê quando o `useTerminals` volta a pedir
`GET /api/terminals` — de 10 em 10 s. "Precisa de ti" com 10 s de atraso é o caso que mais custa.

Já existe um `fs.watch` recursivo sobre essa pasta: o do `DeployTrigger` ([[0035-sync-do-deploy-por-ls-remote-e-hook]]).

## Opções

| Opção | Prós | Contras |
|---|---|---|
| **A. Um WS global por separador, `/api/terminals/events/ws`, alimentado pelo mesmo `fs.watch` (escolhida)** | Uma ligação parada por separador; mensagens só quando um hook escreve; o hook não muda | Mais uma rota WS para proteger |
| B. Mensagem nova no WS de cada terminal | Nenhuma rota nova | Só os terminais abertos no ecrã têm socket; a grelha e a navegação de topo veem todos |
| C. SSE | Unidirecional, simples | Outro mecanismo de auth (o guard trata o `Origin` só no upgrade WS); nada ganho sobre A |
| D. O hook avisa o backend por HTTP | Sem `fs.watch` | O hook passava a fazer rede: pode demorar e falhar — o 0031 proíbe |
| E. Sondar mais depressa (ex.: 2 s) | Nenhum código novo | Um `GET` completo (ramos, previews, agentes de todos) a cada 2 s por separador, para quase sempre nada |

## Decisão

1. **Rota** `GET /api/terminals/events/ws` (WebSocket). O guard comum já exige sessão **e** `Origin` permitido em
   qualquer upgrade (0004); sem isso, 401/403 antes do upgrade. Fecha com `4401` quando a sessão de login acaba,
   como o WS dos terminais. O cliente não envia nada; texto recebido é ignorado.
2. **Mensagem** (texto, JSON): `{ type: 'terminal', id, activity, agents }` — os mesmos campos e valores do
   `TerminalView` (0031 pontos 4 e 5). Só para terminais **visíveis** (não `hidden`) e **normais**; nunca mais nada
   (nem o prompt, nem o resultado de um agente — o mesmo limite do 0031 ponto 7).
3. **Origem**: um único `SessionStateWatcher` (`fs.watch` recursivo de `session-state/`) partilhado pelo
   `DeployTrigger` e pelo canal. Um ficheiro `<id>/state.json` ou `<id>/agents/*.json` que muda agenda, por
   terminal, uma releitura com ~150 ms de espera (um evento escreve vários ficheiros e o `rename` dispara mais de
   uma vez); só se envia se o par `activity`/`agents` mudou desde o último envio desse terminal. O hook não muda.
4. **Cliente** (`useTerminals`): abre o WS ao montar; cada mensagem aplica-se à lista em memória (um terminal que a
   lista não tem é ignorado — chega com a próxima releitura). Ao **religar** (depois de uma queda, com espera
   crescente de 1 s a 30 s) relê a lista, porque se pode ter perdido eventos. `4401` → não religa.
5. **A sondagem fica como rede**, a 60 s (antes 10 s), e o reler ao voltar à janela (`focus`/`visibilitychange`,
   mínimo 5 s) mantém-se — o bot e os outros separadores continuam a abrir e fechar terminais sem evento próprio.

## Consequências

- "Precisa de ti", "A trabalhar" e os agentes aparecem em menos de 1 s.
- Custo: uma ligação parada por separador; o backend relê só o terminal que mudou. Sem eventos, nada passa.
- Abrir, fechar ou terminar um terminal **não** vem por este canal (continua no `exit` do WS do terminal, nas
  respostas das ações e na sondagem). Alargar o canal a isso é decisão à parte.
- O `fs.watch` recursivo é o mesmo de que o 0035 já depende (Windows e macOS nativos; Linux com Node ≥ 20).
- O 0031 continua válido em tudo o resto; só a linha "Sem canal de eventos" e a latência de "até 10 s" deixam de
  ser verdade.

## Relacionado

[[0031-estado-das-sessoes-por-hooks]] · [[0035-sync-do-deploy-por-ls-remote-e-hook]] ·
[[0004-exposicao-e-modelo-de-ameaca]] · [[../api]] · [[../features/terminais|Terminais]]
