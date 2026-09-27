# ⚙️ Convenções do backend — Node + TypeScript + Fastify + node-pty

> 🚧 **Stack `node-fastify` 📋 — criada na hora pelo `/create`**, sem código que a valide. Tudo nesta
> página é intenção até ao scaffold e ao spike do PTY; o que ficar provado perde o 🚧. Quando o código
> amadurecer, correr `/harvest-project` no Workflow para a transformar num módulo a sério.

## Versões

| Peça | Versão | Nota |
|---|---|---|
| Node | LTS atual | Fixar em `.nvmrc` / `engines` — o `node-pty` é nativo e parte ao mudar de versão |
| TypeScript | 5.x, `strict: true` | ESM (`"type": "module"`) |
| Fastify | 5.x | + `@fastify/websocket`, `@fastify/cookie`, `@fastify/cors`, `@fastify/rate-limit` |
| node-pty | 1.x (fixar a versão exata) | ConPTY no Windows |
| zod | 3.x | Configuração e corpos dos pedidos |
| Vitest | atual | Testes |

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
   de argumentos fixa; o único argumento variável é o uuid de `--resume`, validado como UUID. Nunca
   `shell: true`, nunca um shell interativo.
7. **A pasta de um terminal é validada** contra `ALLOWED_ROOTS` depois de resolvida (`realpath`) — um
   `..` ou um symlink não saem da raiz.
8. **O processo filho recebe um ambiente limpo**: o do backend **menos** `ANTHROPIC_API_KEY`,
   `ANTHROPIC_AUTH_TOKEN` e `CLAUDECODE` (ver Armadilhas).
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
- **Matar**: no Windows, matar o PTY tem de levar a árvore toda (o `claude` pode ter lançado processos
  filhos — dev servers, testes). Confirmar no spike; se não levar, matar a árvore explicitamente.

## Autenticação

Ver [[security]] → "Fluxo de autenticação" e [[adr/0003-auth-utilizador-unico]]. Uma guarda única
(`common/authGuard.ts`) usada **tanto** nas rotas REST como no `preValidation` do upgrade do WebSocket.

## Testes

- Vitest para o que não precisa do `claude` real: `TerminalManager` com um processo falso (ex.: `node -e`
  a ecoar), política de pastas, guarda de auth, parsing dos manifestos da biblioteca.
- O `claude` real só se testa à mão (gasta quota e depende do login) — a skill `run` + um terminal aberto.

## Armadilhas

> 🚧 Candidatas — conhecidas da documentação e de relatos, **não confirmadas neste projeto**. O spike do
> PTY confirma ou apaga cada uma.

- **`ANTHROPIC_API_KEY` no ambiente → o Claude Code usa a API, não a subscrição.** Se a variável existir
  no ambiente do backend (ou do utilizador), o processo filho herda-a e passa a faturar por token — o
  contrário do que esta app existe para fazer ([[adr/0002-motor-via-pty-sobre-subscricao]]). Retirá-la
  (e `ANTHROPIC_AUTH_TOKEN`) do ambiente do filho, sempre. Confirmar com `/status` dentro de um terminal.
- **`CLAUDECODE` herdado → o `claude` acha que está dentro de outra sessão.** Se o backend for arrancado
  a partir de uma sessão do Claude Code (o `/run` faz isso), o ambiente traz `CLAUDECODE=1`, e o `claude`
  filho pode recusar arrancar ou comportar-se como sessão aninhada. Retirar a variável.
- **`claude` no Windows pode ser `claude.cmd`** (instalação por npm) — um `.cmd` não se lança
  diretamente num PTY; é preciso o executável real ou `cmd.exe /c`. O instalador nativo dá `claude.exe`.
  `CLAUDE_BIN` com o caminho completo evita adivinhar pelo `PATH`.
- **O `PATH` do serviço não é o do utilizador.** Se o backend correr como serviço/tarefa agendada no
  desktop de casa, o `PATH` (e o `HOME`/`USERPROFILE`, logo o `~/.claude` com o login) pode ser outro — o
  `claude` não é encontrado ou arranca sem sessão iniciada. Correr com o utilizador que fez login no
  Claude Code.
- **`tsx watch` reinicia o servidor a cada gravação e mata todos os terminais** — incluindo aquele em que
  o Claude Code está a editar o backend. Ver [[commands#⚠️ Desenvolver a app a partir dela própria]].
- **`node-pty` e a versão do Node** — mudar de Node sem `npm rebuild node-pty` dá `NODE_MODULE_VERSION`
  no arranque.
- **Bytes partidos a meio de um carácter UTF-8** — o output chega em pedaços arbitrários; um carácter
  multi-byte (acentos, emojis, os símbolos da TUI) pode ficar dividido entre dois frames. Enviar como
  binário e deixar o xterm.js descodificar, ou usar um descodificador com estado.
- **Resize antes de o xterm.js medir** — criar o PTY com 80×24 e fazer resize logo a seguir provoca um
  repaint da TUI; passar `cols/rows` já no `POST` de criação.
- **Upgrade do WebSocket sem verificar `Origin`** — os cookies vão em qualquer pedido do browser, também
  de outro site; sem verificar `Origin`, qualquer página aberta pode ligar-se a um terminal
  ([[adr/0004-exposicao-e-modelo-de-ameaca]]).
