# Plano — 2026-10-25 testes-intermitentes

**Estado**: concluído
**Âmbito escolhido**: só um item — "Acabar com as falhas intermitentes do `npm test` do backend"
**Orçamento da sessão**: sem limite

## Esclarecimentos já obtidos
- Correção só nos testes (nada em `backend/src/`) → sim: fábrica de `TerminalManager` de teste com
  `closeGraceMs` curto, esperar pelo `ready` antes de fechar, `hookTimeout` 30 s como rede, `rmSync` com
  retries; medir primeiro onde vão os segundos.
- Serializar os ficheiros com PTYs reais → só se as 5 corridas ainda falharem depois de encurtar os tempos.

## Investigação (resumo)
- `backend/vitest.config.ts`: sem `hookTimeout` (omissão 10 s), sem limites de paralelismo (~7 workers).
- Todos os `TerminalManager` dos testes usam `closeGraceMs` 3000 (só um teste usa 400).
- `closeGracefully` = powershell (lista descendentes) + Ctrl+C ×2 + até 3 s + taskkill.
- Testes MAX_TERMINALS fecham PTYs que ainda não deram `ready`.
- `rmSync` sem `maxRetries` em todo o lado (EPERM em `terminals.routes`).

- (2026-10-25, a meio) Corrigir o `killProcessTree` em `src/` → **sim** (o dono aprovou): não cair no
  `kill()` do node-pty quando o processo já saiu.

## Medições
- `closeGracefully` ~1,6 s mesmo com o fake pronto: 0,35 s de powershell + 0,25 s + ~1 s de o node-pty
  reportar a saída (`FLUSH_DATA_INTERVAL`). Encurtar a graça **não** poupa nada e punha o teste do "exit 130"
  a correr contra o taskkill → revertido.
- Base com 6 processos de carga: 1 falha (`Hook timed out in 10000ms`). Com `hookTimeout` 30 s: 4/4 passam com
  6; com 9, 2 falhas → limitar paralelismo: projeto Vitest `processes` (`maxWorkers: 3`, `groupOrder: 1`).
- `Worker exited unexpectedly` aparece também em repouso (1/6, depois 1/6 e 0/10 após a correção). Provado:
  `killProcessTree` chamava o `kill()` do node-pty num PID morto (teste novo). Por provar: que é isso que mata
  o worker.

## Ordem confirmada
1. [x] Medir, corrigir os testes, 5 corridas seguidas (com carga simulada) — concluída

## Próximo passo
Nada — concluído (2026-10-25). Vitest reposto, diagnóstico retirado do config.
