# ⚙️ Convenções do backend — Node + TypeScript + Fastify + node-pty

> 🚧 **Stack `node-fastify` 📋 — criada na hora pelo `/create`.** Scaffold feito a 2026-09-28 (versões
> abaixo ✅); o resto é intenção até ao spike do PTY — o que ficar provado perde o 🚧. Quando o código
> amadurecer, correr `/harvest-project` no Workflow para a transformar num módulo a sério.

## Versões

| Peça | Versão | Nota |
|---|---|---|
| Node | 24.x (LTS) | `.nvmrc` = `24`, `engines: ">=24 <25"`; `@types/node` na mesma major |
| TypeScript | 6.x, `strict: true` + `noUncheckedIndexedAccess` | ESM (`"type": "module"`, `NodeNext`) |
| Fastify | 5.x | + `@fastify/websocket` 11, `@fastify/cookie` 11, `@fastify/cors` 11, `@fastify/rate-limit` 11 |
| node-pty | **1.1.0 exata** (`--save-exact`) | ConPTY no Windows; N-API |
| zod | 4.x | Configuração e corpos dos pedidos |
| argon2 | 0.45.x | Hash da password (argon2id) |
| Vitest | **4.x + `vite@7` explícito** | Não o 5 — ver Armadilhas → Smart App Control |
| ESLint | 10.x, flat config + `typescript-eslint` | |

## As regras de base (backend)

1. **Strict mode sempre** — nada de `any` sem justificação num comentário.
2. **Organização por domínio** ([[adr/0006-organizacao-por-dominio]]): `auth/`, `terminals/`, `sessions/`,
   `library/`, `usage/`, e `common/` para o transversal. Um domínio usa outro pelo seu serviço, nunca
   pelos seus internos.
3. **Configuração validada no arranque** (`config.ts`, zod) — uma variável em falta impede o arranque,
   nunca rebenta a meio.
4. **Todo o corpo de pedido e toda a mensagem de controlo do WebSocket passam por um schema zod.**
5. **Erros**: um `ErrorCode` por caso (`TERMINAL_001`…), lançados como `AppError`, formatados por **um**
   error handler ([[error-model]]) — `{errorCode, message}`. O frontend espelha os códigos 1:1.
6. **Nunca se constrói um comando a partir de texto do cliente.** Só se lança `CLAUDE_BIN`, com uma lista
   de argumentos fixa, gerada só em `terminals/claudeArgs.ts` ([[adr/0012-argumentos-do-claude-e-status-line]]):
   `--session-id <uuid do backend>`, `--resume <uuid validado>`, `--settings <DATA_DIR>/claude-settings.json`.
   Nunca `shell: true`, nunca um shell interativo.
7. **A pasta de um terminal é validada** contra `ALLOWED_ROOTS` depois de resolvida — um `..`, um symlink
   ou uma junction não saem da raiz. Um só sítio: `resolveAllowedPath` em `folders/cwdPolicy.ts` (`realpath.native`,
   comparação sem maiúsculas no Windows, separador no fim da raiz para `C:\dev2` não passar por `C:\dev`).
8. **O processo filho recebe um ambiente limpo** (`childEnv` em `terminals/spawnClaude.ts`): o do
   backend **menos** uma denylist — tudo o que começa por `ANTHROPIC_` ou `CLAUDE_` (inclui `CLAUDE_CODE_*`,
   `CLAUDE_PID`, `CLAUDE_EFFORT`, `CLAUDE_JOB_DIR` de uma sessão-mãe), `CLAUDECODE`, e as variáveis de
   configuração da própria app (segredos, `HOST`/`PORT`…), exceto
   `CLAUDE_CONFIG_DIR`, que é partilhada de propósito. Nomes comparados sem maiúsculas (Windows). Ver
   Armadilhas.
9. **O conteúdo dos terminais nunca vai para os logs.** Logam-se eventos (terminal criado, terminou com
   código N), não bytes.
10. **Cada PTY tem dono**: o `TerminalManager` é o único sítio que cria, guarda e mata processos; no
    shutdown (`SIGINT`/`SIGTERM`/`close` do Fastify) mata todos.

## Terminais — como se faz

- **Um `TerminalManager`** com um `Map<id, Terminal>`; `id` gerado pelo servidor (UUID), nunca vindo do cliente.
- **Scrollback em memória**: buffer circular por terminal (`SCROLLBACK_BYTES`), reenviado ao cliente que
  liga (ou religa) antes do output em tempo real.
- **Vários clientes no mesmo terminal** (dois separadores): o output vai para todos; decidir se o input
  também é aceite de todos (proposta: sim — é o mesmo utilizador).
- **Resize**: `pty.resize(cols, rows)` a cada mensagem `resize`; valores validados (limites sãos).
- **Flow control**: se o WebSocket acumular demasiado (`bufferedAmount` acima de um limite), pausar o PTY
  (`pty.pause()`) e retomar quando esvaziar — o guia de *flow control* do xterm.js descreve o padrão com
  *watermarks*. Sem isto, um output enorme enche a memória do backend.
- **Fim do processo**: `onExit` → estado `exited` + código, mensagem `{type:"exit"}` aos clientes; o
  terminal fica listado até o utilizador o fechar.
- **Matar**: no Windows, `taskkill /PID <pid> /T /F` leva a árvore toda (confirmado com um neto de
  longa duração); o `pty.kill()` do node-pty fica como fallback — ver Armadilhas.
- **Scrollback**: guardado em pedaços inteiros (o que o `onData` entregou), cortados do mais antigo —
  nunca parte um carácter UTF-8; ainda pode cortar a meio de uma sequência ANSI (ver Armadilhas).

## Autenticação

Ver [[security]] → "Fluxo de autenticação" e [[adr/0003-auth-utilizador-unico]]. Uma guarda única
(`common/authGuard.ts`) usada **tanto** nas rotas REST como no `preValidation` do upgrade do WebSocket.

## Testes

- Vitest para o que não precisa do `claude` real: `TerminalManager` com um processo falso (ex.: `node -e`
  a ecoar), política de pastas, guarda de auth, parsing dos manifestos da biblioteca.
- O `claude` real testa-se com o spike manual `npx tsx scripts/pty-spike.ts [cwd]` — binário, ambiente
  do filho, `/status`, resize, Ctrl+C e kill da árvore. Não fala com o modelo (o `/status` é local), por
  isso não gasta quota; depende do login e de a pasta já ser *trusted*. Guarda os ecrãs (renderizados
  num `@xterm/headless`) em `%TEMP%\wfa-spike-*.txt`.

## Armadilhas

> ✅ = confirmada neste projeto (spike do PTY, 2026-09-28, Claude Code 2.1.283, Windows 11). As restantes
> são candidatas — conhecidas da documentação e de relatos, ainda por provar.

- ✅ **`ANTHROPIC_API_KEY` no ambiente → o Claude Code usa a API, não a subscrição.** Se a variável existir
  no ambiente do backend (ou do utilizador), o processo filho herda-a e passa a faturar por token — o
  contrário do que esta app existe para fazer ([[adr/0002-motor-via-pty-sobre-subscricao]]). A denylist
  retira todo o `ANTHROPIC_*` (inclui `ANTHROPIC_AUTH_TOKEN` e `ANTHROPIC_BASE_URL`). Provado no spike:
  com uma chave falsa injetada no backend, o filho não a vê e o `/status` mostra **"Login method: Claude
  Pro account"**.
- ✅ **Um backend arrancado de dentro do Claude Code herda a sessão dele.** Não é só o `CLAUDECODE=1`: o
  ambiente real trazia `CLAUDE_PID` e 8 `CLAUDE_CODE_*` (`SESSION_ID`, `CHILD_SESSION`, `ENTRYPOINT`,
  `EXECPATH`, `SESSION_ATTENDED`, `MESSAGING_SOCKET`, **`MESSAGING_TOKEN`**…) — o filho comportar-se-ia
  como sessão aninhada e receberia o token de mensagens da sessão pai. Retirados todos por prefixo.
- ✅ **O `.env` do backend vai parar ao ambiente do filho.** O `process.loadEnvFile` põe
  `SESSION_SECRET`, `APP_PASSWORD_HASH` e `PORT=7400` no `process.env` — sem denylist, o `claude` (e tudo
  o que ele corre) via os segredos, e um dev server lançado por ele tentaria a porta 7400 do backend.
- ✅ **`claude` no Windows**: nesta máquina é `C:\Users\jlalv\.local\bin\claude.exe` (instalador nativo,
  sem `.cmd`). `resolveClaudeBin` procura no `PATH` com o `PATHEXT` e **recusa `.cmd`/`.bat`/`.ps1`**
  (um shim de npm não se lança num PTY) com uma mensagem a dizer para usar o instalador nativo. Se o
  `claude` não existir, o backend arranca na mesma (com um aviso no log) — só a criação de terminais falha.
- ✅ **O `kill()` do node-pty no Windows não chega, e rebenta depois de um `taskkill`.** Só mata os
  processos ligados à pseudo-consola; e o helper que os lista (`conpty_console_list_agent`) crasha com
  `AttachConsole failed` se o processo já tiver morrido. Por isso: `taskkill /T /F` primeiro, e o
  `pty.kill()` só se o `taskkill` falhar. Sem fuga de `OpenConsole.exe` (contados antes/depois dos testes).
- ✅ **Sair do `claude` pelo teclado**: dois `\x03` (Ctrl+C) seguidos → sai com código 0.
- **Pasta ainda não *trusted*** — na primeira vez numa pasta o `claude` mostra o diálogo de confiança
  antes do prompt; o spike deteta-o e falha com essa razão. No produto, o diálogo aparece no terminal e
  responde-se lá.
- **O `PATH` do serviço não é o do utilizador.** Se o backend correr como serviço/tarefa agendada no
  desktop de casa, o `PATH` (e o `HOME`/`USERPROFILE`, logo o `~/.claude` com o login) pode ser outro — o
  `claude` não é encontrado ou arranca sem sessão iniciada. Correr com o utilizador que fez login no
  Claude Code.
- **`tsx watch` reinicia o servidor a cada gravação e mata todos os terminais** — incluindo aquele em que
  o Claude Code está a editar o backend. Ver [[commands#⚠️ Desenvolver a app a partir dela própria]].
- ✅ **`node-pty` 1.1.0 instala no Windows x64 sem Build Tools nem Python** (confirmado a 2026-09-28, Node
  24.16 via nvm4w): o pacote traz `prebuilds/win32-x64` (`pty.node`, `conpty.node`, `conpty.dll`,
  `OpenConsole.exe`, winpty). **Não traz prebuilds para Linux** — num desktop Linux é preciso
  `build-essential` + Python para o `node-gyp`.
- **`node-pty` e a versão do Node** — o 1.1.0 é N-API, por isso mudar de Node *não deve* dar
  `NODE_MODULE_VERSION`; não testado. Se der, `npm rebuild node-pty`.
- ✅ **Smart App Control bloqueia binários nativos novos** — confirmado a 2026-09-28: o binding do
  `rolldown` (Vite 8) é recusado; `node-pty`, `argon2` e `esbuild` passam. Antes de subir uma dependência
  com binário nativo, correr os testes. Ver [[commands]] → Armadilhas.
- ✅ **Depois do `onExit`, o ConPTY deixa handles vivos** (`PipeWrap` + `MessagePort` do worker) — o
  processo Node não termina sozinho. Qualquer script que lance um PTY, e o graceful shutdown, têm de
  acabar com `process.exit()` explícito.
- **Bytes partidos a meio de um carácter UTF-8** — ✅ *do lado do PTY não acontece*: o node-pty entrega
  strings já descodificadas com estado (o logótipo, `❯` e as linhas de caixa chegaram intactos ao
  `@xterm/headless`). Continua a valer para o transporte: o output chega em pedaços arbitrários; um carácter
  multi-byte (acentos, emojis, os símbolos da TUI) pode ficar dividido entre dois frames. Enviar como
  binário e deixar o xterm.js descodificar, ou usar um descodificador com estado.
- **Resize antes de o xterm.js medir** — criar o PTY com 80×24 e fazer resize logo a seguir provoca um
  repaint da TUI; passar `cols/rows` já no `POST` de criação.
- **Upgrade do WebSocket sem verificar `Origin`** — os cookies vão em qualquer pedido do browser, também
  de outro site; sem verificar `Origin`, qualquer página aberta pode ligar-se a um terminal
  ([[adr/0004-exposicao-e-modelo-de-ameaca]]).
- **Replay do scrollback corrompido** — um buffer circular de bytes corta a meio de sequências ANSI, e o
  Claude Code é uma TUI que redesenha o ecrã; ao religar, o cliente pode ver um ecrã partido. Opção
  robusta: um `@xterm/headless` por terminal no servidor e, ao ligar, enviar um snapshot com
  `@xterm/addon-serialize` em vez dos bytes crus. Opção simples: depois do replay, forçar um redesenho
  (resize para o mesmo tamanho ±1).
- **Scrollback duplicado ao reconectar** — se o cliente religa sem limpar o xterm.js, o replay aparece
  por cima do que já lá estava. `term.reset()` antes do replay, ou offsets/números de sequência.
- **Ligações mortas sem `close`** — suspensão do portátil, Wi-Fi a cair, ou um túnel/proxy à frente
  (o Cloudflare corta ligações paradas ao fim de ~100 s). Ping/pong do lado do servidor para limpar
  clientes mortos, e reconexão automática com backoff no `TerminalView`.
- **Dois clientes com tamanhos diferentes** — o PTY só tem um tamanho; dois separadores a mandar
  `resize` alternadamente fazem a TUI redesenhar sem parar. Precisa de uma regra (ex.: manda o último
  com foco, ou o menor tamanho).
- **Sessão expirada com o WebSocket aberto** — a guarda só corre no upgrade; um socket já aberto
  sobrevive à expiração da sessão se nada o fechar. A expiração (não só o logout) tem de fechar os
  WebSockets dessa sessão ([[security]] → "Fluxo de autenticação").
