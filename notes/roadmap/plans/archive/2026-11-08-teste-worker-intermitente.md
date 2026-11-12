# Plano — 2026-11-08 teste-worker-intermitente

**Estado**: concluído (2026-11-12 — fechar e vigiar; o residual ficou no ToDo como "Vigiar o node-pty")
**Âmbito escolhido**: só o tema Manutenção (teste intermitente "Worker exited unexpectedly")
**Orçamento da sessão**: sem limite

## Esclarecimentos já obtidos
- Abordagem → medir e corrigir (instrumentar, apanhar o ficheiro e o exit code, depois corrigir a causa)
- Quantas corridas → ~10 isoladas do `terminalsService.test.ts` + ~5 da suite inteira, em background

## Ordem confirmada
1. [x] Teste intermitente no backend: "Worker exited unexpectedly" do pool de forks — concluída (beta.18 + guard do pid 0; residual a vigiar)

## Medições (2026-11-08)
- `terminalsService.test.ts` isolado ×10: worker nunca morreu; 2/10 com `Cannot create process, error code: 87` (ConPTY) em testes diferentes.
- Suite inteira ×5: worker morreu em 3/5 (uma com 491/512); erro 87 em 1/5.
- Só projeto `processes` (verbose) ×6: worker morreu em 2/6, **sempre no `terminalsService.test.ts`** (p2: a meio, 99/121; p3: no fim, 121/121 mas worker caiu); p5: 3 timeouts em 3 ficheiros (carga).
- `--maxWorkers=1` ×6: worker morreu em 2/6 (terminalsService, telegramBot, terminalManager), sem timeouts → **não é carga nem interferência entre workers**.
- `taskkill` com PID reutilizado a atingir o worker (instrumentação temporária, já revertida) ×8: nenhum alvo era um PID de worker; worker morreu em 2/8 → **hipótese refutada**.
- `--pool=threads` ×8: **4/8 terminam com exit 139 = SIGSEGV**. Segfault nativo em pontos aleatórios, sempre em ficheiros que abrem/fecham PTYs (telegramBot, terminalManager, terminalsService, imports.routes, gateway).
- **Causa**: crash nativo do node-pty 1.1.0 (ConPTY) em Node v24.16.0 / Windows. node-pty `latest` = 1.1.0; existe `1.2.0-beta.18`.
- O erro 87 (`Cannot create process`) é o mesmo componente (ConPTY) a falhar de forma não fatal.

## Decisão (2026-11-12)
Utilizador escolheu **A: adaptar à node-pty 1.2.0-beta.18** (com ADR). Downsides aceites: dependência nativa beta, 2 testes do terminalManager a adaptar, ADR novo. Reversível (1 linha no package.json).

## Medições com node-pty 1.2.0-beta.18 (2026-11-12)
- Causa dos 2 testes do terminalManager: `pty.pid` é 0 logo após o spawn e após a saída (não era o kill). Corrigido (Terminal guarda o último pid; `isAlive` recusa pid <= 0; `closeGracefully` ignora pid 0).
- Suite por omissão ×4: 4/4 passam (46 ficheiros, 527/527).
- `--pool=threads` ×8: 7/8 passam; **1/8 morreu com exit 134 (SIGABRT)**, saída filtrada, causa por apurar. Melhorou (1.1.0: 4/8 com exit 139) mas **não está eliminado**.
- tsc --noEmit: 1 erro, igual antes e depois (typing do WebSocket).

## Medições — exit 134 apanhado com saída completa (2026-11-12, 2.ª sessão)
- `--pool=threads` ×8 (beta.18): 7/8 limpas (527/527); **1/8 exit 134** — total da beta em threads: **22/24**.
- A saída completa mostra que o SIGABRT **não tem frames do node-pty**: é uma asserção do Node em
  `node::fs::ReadFileUtf8` (`src\node_file.cc:2770`, `Assertion failed: (0) == (uv_fs_close(...))`), num
  `readFileSync` do loader CJS a carregar `@fastify/cookie/index.js`. Ou seja, o `close` de um ficheiro acabado
  de abrir falhou — típico de **outro código no mesmo processo ter fechado esse handle** (fecho duplo, com o
  número do handle já reutilizado). Em threads todos os ficheiros partilham o processo; em forks (omissão) não.
- Suspeito natural: o código nativo do ConPTY. Lido o `src/win/conpty.cc` da beta.18: os `CloseHandle` estão
  sob mutex e os handles passam a `nullptr` — **sem fecho duplo evidente**. Hipótese não provada.
- Node v24.16.0; node-pty `latest` continua 1.1.0 (nada além da beta.18). Backend 7400 parado: uso real não
  verificável nesta sessão. O Event Log do Windows não tem crashes do `node.exe` em 21 dias — nem os dos testes
  de 2026-11-08, por isso não é prova de nada.
- Log: `threads-1.log` no scratchpad da sessão (não versionado).

## Próximo passo
Nenhum — plano concluído. O que falta (1.2 estável, uso real) está no ToDo → Manutenção.
