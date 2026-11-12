# Known Bugs & Issues

**Bugs conhecidos que ainda não têm correção acionável.** Com correção clara → promove-se a [[ToDo]];
corrigido → "Fixed" com data e link para o [[whatIveDone]].

---

## Active Issues

- **`npm test` do backend: `Worker exited unexpectedly` raro** #backend (visto 2026-10-23; de novo a 2026-10-25,
  **depois** das correções abaixo — 1 em 22 corridas). Um worker do projeto `processes` morre no fim de um
  ficheiro (os testes passaram; `Test Files 32 passed (33)`). Sem código de saída: o Vitest não o mostra; um
  patch temporário ao `emitUnexpectedExit` (em `node_modules/vitest/dist/chunks/cli-api.*.js`) regista
  `code`/`signal`, mas em 15 corridas com o patch não voltou a acontecer. Hipótese (não provada): o `kill()`
  do node-pty sobre um PID morto e reutilizado — o caminho do `killProcessTree` foi fechado, mas o próprio
  node-pty pode chamá-lo noutro sítio. **Porque não está corrigido**: não se reproduz a pedido. Próximo passo
  quando voltar: o patch acima (`code` 0xC0000005 = crash nativo; 1 = `TerminateProcess` de fora).
  > **2026-10-26** (spec Upwork, passo 3): **muito mais frequente** — 3 em 4 corridas com as alterações do passo 3, e
  > **1 em 3 no `HEAD` sem elas** (stash de `backend/src` + `backend/test`): não é do passo 3. Mesmo sintoma
  > (`40 passed (41)`, sem asserção a falhar). Talvez carga da máquina; vale a pena o patch do `emitUnexpectedExit`
  > na próxima vez que se mexer nisto.

- **`guidedHook.test.ts` → "a new destination inside a root…" falhou uma vez** #backend (2026-10-26, spec Upwork passo
  5) — numa corrida do `npm test` completo; passou nas outras 5 completas e 4 vezes sozinho. A mensagem do erro não
  ficou guardada (a corrida filtrava só o resumo). O teste exercita o `PermissionRequest`, que o passo 5 não tocou
  (só acrescentou o evento `SessionStart`). Suspeita: os `waitFor` de 10 s do `asks` sob a carga da suite. **Próximo
  passo quando voltar**: guardar a saída inteira da corrida (`npm test > run.txt`) para ver a asserção.

- **`npm run typecheck` do backend com 1 erro em `test/auth.test.ts:40`** (visto a 2026-10-22, no passo 2 da spec
  bot-telegram) — `TS2769`: o handler do `app.get(..., { websocket: true }, …)` devolve o `WebSocket` e os tipos
  atuais do `@fastify/websocket` exigem `void | Promise`. Só tipos de um teste; `npm test` e `lint` passam. Já existia
  antes da alteração (stash → mesmo erro). Não corrigido por estar fora do âmbito da spec; a correção provável é o
  handler não devolver nada (bloco `{ … }` em vez de expressão).

---

## Fixed Issues (Archive)

- **`npm test` do backend com falhas intermitentes** #backend — corrigido 2026-10-25 (`/implement-todo`).
  Causa: os hooks fecham PTYs reais a ~1,6 s cada (powershell + o node-pty reporta a saída ~1 s tarde), com o
  `hookTimeout` de omissão (10 s) e ~7 ficheiros com processos em paralelo; com a CPU carregada passava dos
  10 s. Reproduzido com 6 processos de CPU em ciclo (1 falha). Correção: `hookTimeout` 30 s; os 9 ficheiros com
  processos reais num projeto Vitest `processes` com `maxWorkers: 3`; `removeDir` com retries (EPERM);
  `killProcessTree` já não chama o `kill()` do node-pty num processo morto. Prova: 5/5 corridas seguidas com
  6 processos de carga, e 1/1 com 9 (antes: 2 falhas). Detalhe no work log.
  > Registo original:
  > - **`npm test` do backend com falhas intermitentes** (visto a 2026-10-22, spec bot-telegram passos 4 e 6) — em ~10
  > corridas, 3 deram 1-4 testes a menos (`277/278`, `293/294`, `290/294`) e a corrida seguinte passou toda; não se
  > reproduziu em 4 corridas seguidas para ver o nome. Suspeita: testes com PTYs reais (`fakeClaude`, `waitFor` de 10 s)
  > sob carga. Próximo passo: `npx vitest run --reporter=verbose > log` em ciclo até falhar, e ver o ficheiro.
  > **2026-10-23** (spec pré-visualização, passo 4): mais uma, com outro sintoma — `Error: [vitest-pool]: Worker forks
  > emitted error … Worker exited unexpectedly`, `30 passed (31)` / `330 passed (339)`, sem nome de ficheiro; as duas
  > corridas seguintes passaram 339/339. Mesma suspeita (um worker com PTYs reais a morrer sob carga).
  > **2026-10-23** (passo 5), **com nomes**: `Hook timed out in 10000ms` em `terminalManager.test.ts` > "enforces
  > MAX_TERMINALS" (hook em `:9`), `terminalsService.test.ts` > "MAX_TERMINALS → TERMINAL_002" (hook em `:80`) e
  > `telegramBot.test.ts` > "a chosen session whose terminal is stopped…" (hook em `:143`) — esses ficheiros levaram
  > 53-79 s (normal ~20 s); as duas corridas seguintes 349/349. São todos `afterEach`/`beforeEach` que fecham PTYs reais
  > (`closeGracefully`: Ctrl+C, até 3 s de graça, `powershell` para a árvore) — sob carga, passa dos 10 s do hook.
  > Hipótese de correção: `hookTimeout` maior nesses ficheiros, ou `closeGraceMs` curto no `TerminalManager` dos testes.
  > **2026-10-23** (passo 6): **a piorar** — 11 falhas numa corrida de 115 s (normal ~70 s; browser e um `java` a pesar no
  > CPU, sem processos órfãos dos testes), todas timeouts de testes/hooks com PTYs reais (`terminals.gateway`,
  > `terminals.routes` + um `EPERM` a apagar a pasta temporária dele, `listeningPorts` real, `telegramBot`,
  > `terminalManager`, `terminalsService`); as duas corridas seguintes 355/355. Já vale a pena corrigir (ToDo).

---

## How to Use

- Bug novo no topo de "Active Issues": descrição, como reproduzir, impacto, e **porque ainda não está corrigido**
- Tag `#backend` / `#frontend`
