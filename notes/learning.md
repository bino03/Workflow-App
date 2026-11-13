# 🧠 Learning — armadilhas de ferramentas e de processo

**O que custou tempo e não era da app.** Uma entrada por lição, datada: o que aconteceu → o que se faz
diferente. Se a lição é sobre a *aplicação*, o sítio é `docs/`.

**Quem escreve aqui**: `/implement-todo` Fase 7 pergunta "algo custou tempo que não fosse da app?".

---

## Herdado do Workflow

Lições de outros projetos que valem para este desde o primeiro dia:

- **Editar ficheiros do vault com tabelas Markdown ou CRLF** — `perl`/`sed` multi-linha corrompem ou nem
  casam; `sed -i` por número de linha aponta à linha errada depois de outra edição. → Usar a ferramenta
  Edit; `sed -i` só para substituições de uma linha, por padrão único, sem `\` no texto novo; ler o
  `git diff` antes de dar por feito, e compilar depois de cada `sed` em código.
- **Reescrever um ficheiro do vault por `cp`/redireção** pode ser bloqueado como destrutivo. → Edições cirúrgicas.
- **Nem sempre há `python3`** no Windows — um heredoc `python3 - <<EOF` termina sem erro e sem fazer nada.
  → `node -e`, ou as ferramentas Edit/Write.
- **Um ficheiro do vault só sobrevive se um passo do ciclo lhe escrever.**

---

## Ferramentas

- **2026-09-28 — Smart App Control bloqueia binários nativos novos, e o npm culpa-se a si próprio.** O
  Vitest 5 falhou com "Cannot find native binding… npm has a bug related to optional dependencies"; apagar
  `node_modules` não resolveria — o binding do `rolldown` estava lá, bloqueado pelo Windows. → Perante um
  "native binding" em falta, `node -e "require('<pacote-do-binding>')"` primeiro: mostra o erro real
  ("An Application Control policy has blocked this file"). Saída: versão anterior sem esse binário.
- **2026-09-28 — O Bash desta sessão estraga heredocs e backslashes.** Heredocs com `<<'EOF'` longos
  falharam com "unexpected EOF while looking for matching `''" (nada foi escrito), e um caminho
  `C:\Users\…\bin` passado dentro de `node -e "…"` perdeu as barras (`\b` virou backspace). → Para
  scripts ou texto com `\`, `$` ou aspas: escrever o script com a ferramenta Write num ficheiro do
  scratchpad e correr `node ficheiro.cjs`; confirmar o resultado com `od -c` ou lendo o ficheiro.
- **2026-09-28 — Extensão do Chrome sem responder ("No group with id") → Chrome headless via CDP.**
  Um driver de ~80 linhas (`chrome.exe --headless=new --remote-debugging-port=…` + o `WebSocket` global
  do Node 24; `Runtime.evaluate`, `Input.insertText`, `Page.captureScreenshot`, `Fetch` para simular
  `/auth/me` ou falhar a rede) verificou o frontend por DOM, estilos computados, rede e screenshot. A
  password real nunca entra: sessão simulada com `Fetch.fulfillRequest`. Ficou no scratchpad da sessão —
  se voltar a fazer falta, passa a script do projeto.
- **2026-09-28 — O Vite reinicia a cada gravação do `vite.config.ts`.** Duas edições seguidas (a
  primeira usava `readFileSync`, a segunda importava-o) → reiniciou com a config partida e ficou a servir
  a antiga (`__APP_VERSION__ is not defined` no browser). → Mudar a config numa só escrita, ou reiniciar
  o Vite depois e ler o log (`server restart failed`).
- **2026-09-28 — Verificar os terminais com o `claude` real sem tocar no backend do dono.** Uma segunda
  instância (`PORT=7498 APP_USERNAME=e2e APP_PASSWORD_HASH=<hash de teste> DATA_DIR=<tmp> ALLOWED_ROOTS=<pasta de
  confiança> FRONTEND_DIST=<frontend/dist> npx tsx src/server.ts`, sem `watch`) serve a SPA do build — mesma
  origem, sem CORS. Três armadilhas que custaram corridas:
  - **limpar o estado entre corridas**: reiniciar a instância e apagar o `DATA_DIR`, porque terminais e
    recentes da corrida anterior mudam o que o cenário vê;
  - **modais e drawers do antd em headless**: esperar que a animação de saída acabe antes do clique
    seguinte, senão a máscara apanha-o;
  - **`a?.b ?? ''` dentro de uma expressão** precisa de parênteses antes de `.includes`.

  O ecrã do xterm.js lê-se em `.xterm-rows` (renderer DOM), e `CSS text-transform` muda o `innerText`. O
  driver e os cenários ficaram em `%TEMP%\wfa-verify` (`cdp.cjs`, `verify-*.cjs`, `restart-backend.ps1`).
- **2026-09-28 — `injectWS` perde os primeiros frames** se os listeners forem ligados depois de o `await`
  resolver (o servidor manda o `ready` logo na abertura). → `app.injectWS(url, ctx, { onInit: (ws) => … })`.

- **2026-09-29 — Extensão do Chrome sem responder, mesmo com o Chrome já aberto.** `tabs_context_mcp`
  falhou 5× seguidas com `"No group with id: <N>"` (id diferente a cada tentativa) — antes e depois de
  arrancar o `chrome.exe` de novo (não estava a correr nenhuma instância). Não é o mesmo caso de
  2026-09-28 acima (aquele tinha o Chrome de pé, só a extensão sem grupo); aqui nem o processo existia. →
  Confirmar `Get-Process chrome` antes de insistir na extensão; se falhar mesmo com o Chrome de pé, o
  CDP direto (driver do caso de 2026-09-28, acima) é a alternativa — mas só serve para DOM/estilos/rede
  simulados, nunca para um fluxo que precise da password real (login), porque aí a sessão simulada não
  chega às rotas autenticadas a sério.
- **2026-09-28 — `cmd | grep … && git commit` passa com testes a falhar.** O `&&` vê o código do `grep` (encontrou a
  linha "Tests … failed"), não o do Vitest — dois commits entraram assim (lint da quota, teste do fecho). → Correr os
  testes sozinhos e testar `$?` (`npx vitest run > log; code=$?`), e só depois `grep` o log para ler o resumo.
- **2026-09-29 — Smart App Control voltou a bloquear um binário nativo, desta vez o Rollup do Vite
  (`npm run dev` do frontend).** Mesmo sintoma do caso de 2026-09-28 acima (Vitest/rolldown), pacote
  diferente: `Error: Cannot find module @rollup/rollup-win32-x64-msvc` → "npm has a bug related to optional
  dependencies", mas a causa real (visível só ao ler o log completo) é "An Application Control policy has
  blocked this file". Apagar `node_modules`/`package-lock.json` **não resolve** (não é instalação
  corrompida, é uma política do Windows a bloquear o ficheiro `.node`); ao contrário do caso do Vitest, não
  há aqui uma versão anterior do Vite sem Rollup nativo para contornar — fica pendente do dono destravar a
  política. → Perante qualquer erro do npm sobre "optional dependencies" num binário nativo, ler o log
  completo antes de tentar reinstalar; se aparecer "Application Control policy", é sempre o dono a
  desbloquear, nunca um `npm install`/`rm -rf node_modules`.
  **Atualização (mesmo dia, sessão seguinte)**: o `npm run dev` do frontend arrancou sem nenhuma ação
  daqui — o bloqueio já não estava lá. Não há como saber o que mudou do lado do dono (Smart App Control
  aprendeu o ficheiro, uma exceção manual, um reboot); registado para não se assumir "resolvido para
  sempre" nem "só o dono desbloqueia manualmente sempre" — vale a pena tentar arrancar de novo antes de
  reportar como bloqueado outra vez.
- **2026-10-21 — Caminhos Windows dentro de seletores CSS partem o `querySelector` (CDP).**
  `section[data-project="C:\Users\…"]` dá "is not a valid selector": as barras invertidas são escapes de
  CSS (e um `JSON.stringify` duplo deixa aspas a mais). → Montar o seletor dentro da página com
  `'[data-project="' + CSS.escape(path) + '"]'`, ou comparar `el.dataset.project === path` num
  `querySelectorAll`. Custou uma corrida.
- **2026-10-21 — `CLAUDE_CONFIG_DIR` próprio na instância de teste.** O `ClaudeSessions` lê as sessões
  gravadas de `<CLAUDE_CONFIG_DIR>/projects/<cwd codificado>/*.jsonl` (`cwd` com tudo o que não é
  `[A-Za-z0-9]` trocado por `-`), e o filho herda essa variável. Com uma pasta própria dá para semear
  `.jsonl` falsos (uma linha `user` + uma `assistant` chegam) e testar o `ResumeSessionModal` sem escrever
  no `~/.claude` do dono. O `claude` lá dentro não tem login, mas fica vivo (`running`), que é o que os
  testes de UI precisam — desde que nenhum cenário mande um prompt.
- **2026-10-22 — Parar a instância de teste: o `TaskStop` mata a shell, não o `node`.** O backend de teste (`npx tsx
  src/server.ts` lançado em background) continuou a responder na 7498 depois do `TaskStop`. → Matar pelo PID que escuta
  na porta: `netstat -ano | grep "127.0.0.1:7498 .*LISTENING"` → `taskkill //PID <pid> //T //F` (leva os `claude`
  filhos), e confirmar com `curl …/api/health` → `000`. **Nunca** filtrar processos por `CommandLine -like '*<texto>*'`
  para os matar: apanha a própria shell que corre o comando (o texto está na linha de comando dela).
- **2026-10-22 — `Get-CimInstance … CommandLine` mostra `·` como `�`.** É o *codepage* da consola, não o argumento. →
  `[Console]::OutputEncoding=[Text.Encoding]::UTF8;` antes, quando se compara texto não-ASCII. O driver CDP desta
  verificação (`verify-rc.mjs`, cenário do RC) ficou no scratchpad da sessão `0708f6fc-…` — mais um para o item do ToDo
  de passar o driver a scripts do projeto.
- **2026-10-23 — O driver CDP e a instância de teste já são scripts do projeto.** `scripts/verify/`
  ([[../docs/commands|commands]] → "Verificação no browser") substitui os drivers de scratchpad citados acima
  (`%TEMP%\wfa-verify`, `063b02f3-…`, `0708f6fc-…`). Ao lançar o `tsx` em background, o PID lançado (o `cli.mjs`)
  **não é o que escuta** na porta — é um `node` filho; o `taskkill /T` ao que escuta leva também o pai.
- **2026-10-25 — Vitest 4: projetos com `maxWorkers` diferentes precisam de `sequence.groupOrder` próprio.**
  Sem isso a corrida nem começa ("Projects … have different 'maxWorkers' but same 'sequence.groupOrder'"), e
  com ele os grupos correm um a seguir ao outro, não ao mesmo tempo. Ver `backend/vitest.config.ts`.
- **2026-10-25 — Os workers do Vitest não emitem `exit`.** Um `process.on('exit')` num `setupFile` não regista
  nada nem nos workers que terminam bem, por isso "morreu sem evento exit" não prova um crash nativo. Para ter o
  código de saída de um `Worker exited unexpectedly`, só com um patch temporário ao `emitUnexpectedExit` em
  `node_modules/vitest/dist/chunks/cli-api.*.js` (guardar cópia antes e repor; ver [[bugs]]).
- **2026-10-25 — Uma flake "sob carga" reproduz-se carregando a CPU**, não esperando: N processos `node` em
  ciclo ocupado (`while (Date.now() < end) {}`) durante a corrida. Com 6 em 8 núcleos a falha dos testes com
  PTYs voltou à primeira; serviu para provar a correção antes/depois em vez de contar corridas com sorte.
- **2026-10-25 — Num terminal escondido, o auto mode do dono aprova o que a allowlist não cobre.** A importação
  pela app corre o `claude` com as definições globais do dono (`~/.claude/settings.json`, auto mode): uma edição
  em `tools/` do Workflow, fora da allowlist do projeto, passou sem ninguém ver. → **Os limites de uma skill
  escrevem-se na própria skill** (e a app verifica o resultado — a revisão assinala o que fica fora); nunca se
  confia nas permissões para os impor.
- **2026-10-25 — O diálogo de confiança de uma pasta nova tem "No, exit" por omissão.** Num PTY, um Enter fecha o
  `claude` sem confiar na pasta; é preciso seta para baixo + Enter. Por isso a app só lança sessões escondidas
  numa pasta que já é de confiança (`TERMINAL_007` senão).
- **2026-10-25 — Backtick dentro de aspas duplas no bash é substituição de comando.** Um `node -e "…"` ou um `sed`
  com texto Markdown executou cada trecho entre backticks como comando (falharam todos, mas podiam não falhar) e
  partiu o ficheiro editado; um `\n` dentro de uma template literal de um heredoc virou uma quebra de linha real.
  Aconteceu cinco vezes nesta sessão, a última ao escrever esta lição. → Texto com backticks ou `\n` vai pelo
  Edit/Write, ou por um script `.cjs` gravado antes, nunca embutido numa linha de shell.

## Git / vault

- **2026-09-30 — Conduzir o antd 6 por CDP: três seletores que mudaram e custaram três corridas.**
  (a) o clique no `Select` é em `.ant-select-content`, não `.ant-select-selector` (que já não existe);
  (b) o `[role="listbox"]` é um **espelho de acessibilidade escondido** (`height:0;width:0`) com só os
  itens ativos — procurar opções por `[role="option"]` apanha a lista errada e parece um bug da app; as
  opções a sério são `.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option`;
  (c) o painel de tab ativo é `.ant-tabs-content-active` e os inativos **ficam montados** — um
  `document.querySelectorAll('.ant-table-row')` mistura as linhas das três tabs. Ler sempre a 1ª `td`
  dentro do painel ativo. As duas "falhas" que isto produziu eram do cenário, não da app.
- **2026-09-30 — Verificar um fluxo autenticado sem a password do dono.** Três sessões seguidas adiaram a
  verificação por causa do login. A saída: uma **segunda instância do backend** com `APP_PASSWORD_HASH`
  gerado na hora (argon2 do próprio projeto), `PORT`/`DATA_DIR`/`WORKFLOW_PATH` próprios e
  `FRONTEND_DIST=frontend/dist` (mesma origem, sem CORS). Com o `WORKFLOW_PATH` a apontar para uma
  **cópia** da biblioteca, o fluxo destrutivo corre quantas vezes for preciso sem risco. Passa a ser o
  primeiro recurso quando a extensão do Chrome falha, não o último.
- **2026-10-26 — Heredocs pela ferramenta Bash comem barras invertidas.** Um `node - <<'EOF'` ou `cat > f <<'EOF'`
  transformou `\\` em `\` e `\\x1b` num ESC real: um teste ficou com `'C:\data'` partido, a spec ganhou caracteres de
  controlo, e um caminho `C:\Users\…` virou `C:Users…`. Para conteúdo com barras invertidas: **ferramenta Write/Edit**, ou
  caminhos com `/`. E não há `python` no PATH (responde o alias da Microsoft Store) — scripts de edição em `node`.
- **2026-10-26 — `claude --session-id <uuid>` sai com código 1 se esse id já tiver um `.jsonl`.** Numa verificação que
  simula a conversa escrevendo o transcript à mão, escrevê-lo antes de o `claude` arrancar mata o terminal (a vista fica
  "Parada" e parece um bug da app). Escrever só depois do arranque — na app real é o próprio `claude` que o escreve.
- **2026-10-26 — Transições CSS em verificações por DOM.** Um `getComputedStyle` logo a seguir a um clique leu a cor a
  meio da transição de 120 ms e deu FAIL. Esperar pelo valor (`waitFor`) em vez de o ler uma vez.
- **2026-10-26 — Um cenário por CDP que clica no diálogo errado passa sem testar nada.** No cenário do detalhe da Upwork,
  `[...document.querySelectorAll('.ant-modal')].at(-1)` apanhou um Modal fechado que o antd deixa no DOM; o "Apagar"
  passou (a lista ficou vazia por outra razão) e o backend nunca recebeu o `DELETE`. → Encontrar cada diálogo pelo título
  (`.find((m) => m.innerText.includes('Apagar esta candidatura?'))`) e confirmar cada ação destrutiva na API, não só no
  ecrã (`scripts/verify/upwork.mjs`). E no Windows a área de transferência devolve `\r\n`: normalizar antes de comparar.
- **2026-10-27 — `String.replace` com texto que tem `$`.** No passo 8 da Upwork, um script de docs fez
  `s.replace(a, b)` com um `b` que continha `` $` `` (era "`$`, `{}`" no texto): o `replace` lê `` $` `` como "tudo o que
  vem antes da correspondência" e colou ~415 linhas da spec no meio dela; ninguém deu por isso até ao passo 11. → Nos
  scripts de edição de docs, `s.split(a).join(b)` ou `s.replace(a, () => b)` — nunca `replace` com uma string de
  substituição vinda de texto livre (`$&`, `$'`, `` $` ``, `$1` são padrões).
- **2026-10-27 — Um clique real por CDP logo a seguir a fechar um diálogo cai na máscara.** O `Input.dispatchMouseEvent`
  acerta no que está por cima nesse ponto; durante a animação de fecho do Modal é a máscara. → Antes de clicar com o rato
  "a sério", esperar que nenhum `.ant-modal-wrap`/`.ant-modal-mask` esteja visível (`scripts/verify/upwork-menu.mjs`).
- **2026-11-03 — Uma instância de `scripts/verify` arrancada numa chamada do Bash do Claude Code já não responde na seguinte.** Nada no log, apesar de `detached`; a causa exata não foi confirmada. → Arrancar e correr o cenário na mesma chamada ([[../docs/commands]]). Uma vez, a primeira tentativa de `start` falhou com o log vazio e a seguinte arrancou em 2 s; não se repetiu.
  **Revisto a 2026-11-07:** arrancar e correr na mesma chamada também falhou — a instância respondia ~4 s e morria, mesmo só com `curl` a sondar, e um cenário a meio mostrava "Failed to fetch". Com o `start` lançado como **tarefa em background** (`run_in_background`) viveu todo o tempo, e os cenários correram noutras chamadas. Sintoma enganador: com o backend morto, os checks "não avisa" passam de graça e os "avisa" falham, o que parece uma regressão do código. → Antes de culpar a alteração, confirmar que `/api/health` da instância responde no momento da falha. (Não confirmado se o `| tail` que levava o `start` tinha parte nisto.) **Mais tarde no mesmo dia:** mesmo com o `start` em background a instância foi morta por fora 2 vezes a meio de cenários (log sem erro, a acabar em pedidos 200): `accounts-terminals` deu 37/39 e 7/14, e numa instância nova 41/41. Três tarefas de arranque antigas terminavam por essa altura, mas não ficou provado que seja a causa. → Falha num cenário que antes passava: confirmar o `/api/health` antes de olhar para o código, e repetir **numa instância nova** antes de concluir; não correr vários cenários seguidos na mesma instância (o `terminal-menu` deixa terminais, e os cenários assumem uma instância nova).
- **2026-11-05 — Num cenário de `scripts/verify`, `location.pathname` mudar não quer dizer que a página anterior já saiu.** O `waitFor` passava com o URL novo enquanto a página antiga ainda estava montada; o clique seguinte "voltava" a uma página que nunca desmontou, e o cenário media o estado errado (scroll a 1094 em vez de 0). → Esperar por algo da página que se quer ver desaparecer (ex.: `!document.querySelector('[data-settings-section]')`) antes de seguir ([[../docs/commands]] → `settings.mjs`).

- **2026-11-12** — Não há Python nesta máquina: `python` é o alias da Microsoft Store (imprime a mensagem de instalar e sai). Para scripts rápidos de edição usar `node -e` (o Node v24 está sempre lá).
- **2026-11-13** — `sed` sobre uma linha de tabela Markdown com `\|` (o pipe escapado de `:8080\|:5173`): no padrão o `\|` é alternância do GNU sed, não um `|` literal, e a substituição colou metade da linha antiga no fim. → Para mexer numa linha com `\|`, reescrevê-la inteira com `node -e` (`String.fromCharCode(92)` para a barra) e confirmar com `sed -n <linha>p`.
- **2026-11-13** — `git mv -k <ficheiro não versionado> <pasta>` não faz nada e sai com 0 (o `-k` salta os erros em silêncio), por isso o `|| mv` a seguir nunca corre. → Um ficheiro novo (ex.: um plano acabado de gravar) move-se com `mv`; `git mv` só para o que já está no índice.
