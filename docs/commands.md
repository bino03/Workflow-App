# ⌨️ Comandos

Tudo o que se corre neste projeto, num sítio só — com as armadilhas de cada comando.

## Backend — `node-fastify` (📋)

> ✅ Scripts do `backend/package.json` (scaffold de 2026-09-28).

```bash
cd backend
npm install          # dependências (node-pty usa o binário pré-compilado para win32-x64 — ver armadilhas)
npm run dev          # tsx watch src/server.ts — porta 7400, só em 127.0.0.1
npm run typecheck    # tsc --noEmit — tsconfig sem referências (inclui src, scripts, test), verifica mesmo
npm run lint         # ESLint
npm test             # vitest run — projeto `unit` em paralelo, depois `processes` (PTYs/powershell reais, 3 de cada vez)
npm run build        # tsc -p tsconfig.build.json → dist/ (só src/, sem testes nem scripts)
npm start            # node dist/server.js — serve também o frontend/dist, se existir (build do frontend primeiro)
npm run hash-password  # gera o APP_PASSWORD_HASH (argon2id): pede a password duas vezes, sem eco (mín. 12
                       # caracteres); com stdin em pipe lê uma linha. Só o hash vai para o stdout
npx tsx scripts/pty-spike.ts [cwd]  # spike manual: claude real num PTY (env, /status, resize, Ctrl+C, kill)
npx tsx scripts/fullscreen-canary-spike.ts [cwd]      # spike manual: o fecho deixa o canary do fullscreen? (só lê ~/.claude.json)
npx tsx scripts/statusline-spike.ts [cwd] [--prompt]  # spike manual: JSON da status line (rate_limits) e o
                       # .jsonl da sessão; --prompt manda uma mensagem curta (gasta um pouco de quota)
```

### Armadilhas dos comandos

- **`npm install` e o `node-pty`** — é um módulo nativo. No Windows x64 o 1.1.0 traz binário
  pré-compilado (confirmado: instala sem Build Tools nem Python). Sem prebuild (Linux, outra versão),
  compila com `node-gyp` e pede um compilador C++ e Python. Versão fixada exata no `package.json`.
- **Mudar a versão do Node parte o `node-pty`** (`NODE_MODULE_VERSION` diferente) → `npm rebuild node-pty`.
- 🚨 **`npm test` → `Cannot find native binding` / "An Application Control policy has blocked this
  file"** — o **Smart App Control** do Windows (ligado nesta máquina) bloqueia binários nativos sem
  reputação. Aconteceu com o `rolldown` do Vite 8 (puxado pelo Vitest 5); a mensagem do npm sobre
  dependências opcionais é enganadora — o binário está lá. Por isso o Vitest fica no 4 com `vite@7`
  fixado. Para diagnosticar: `node -e "require('<pacote-do-binding>')"` mostra o erro real.
- **Um ficheiro de teste novo que lança processos reais** (o `fakeClaude` num PTY, `powershell`, um servidor)
  **entra em `PROCESS_TESTS`** no `backend/vitest.config.ts`. Todos em paralelo, numa máquina carregada
  (browser, java), davam timeouts de testes e hooks (2026-10-23: 11 numa corrida). Cada fecho de um terminal
  custa ~1,6 s no Windows. Para reproduzir uma flake, carregar a CPU (vários `node` em ciclo ocupado) em vez
  de esperar que aconteça.
- **`npm run dev` com `tsx watch` reinicia o servidor a cada gravação — e cada reinício mata todos os
  terminais abertos.** Ver a secção seguinte.
- **O `tsx watch` não vigia o `backend/.env`.** Mudar só o `.env` não tem efeito até reiniciar. E ao contrário:
  código que passa a exigir uma variável nova reinicia **antes** de ela estar no `.env` e fica parado em
  `Invalid environment: - <VAR>` — o `.env` não o acorda. → Acrescentar a variável e reiniciar o `npm run dev`
  (aconteceu com o `APP_USERNAME`, 2026-09-28).
- **O `process.loadEnvFile` não sobrepõe variáveis já definidas** — útil para arrancar uma instância de teste
  (`APP_PASSWORD_HASH=… DATA_DIR=<tmp> npm run dev`), mas a password real deixa de entrar nessa instância.

### ⚠️ Desenvolver a app a partir dela própria

Quando a app já funcionar, vai ser tentador abrir um terminal **dentro** do Workflow App para trabalhar
**no** Workflow App. Para o backend, isso corta o ramo em que se está sentado:

```
backend do Workflow App (npm run dev → tsx watch)
  └── PTY ─▶ claude          ← a sessão em que estás a trabalhar
                 └── grava backend/src/…/qualquer.ts
                         ↓
                 tsx watch deteta a gravação → reinicia o backend
                         ↓
                 o backend morre → mata todos os PTYs → incluindo este claude, a meio do trabalho
```

A sessão do Claude Code que edita o backend é um **processo filho desse mesmo backend**. À primeira
gravação, morre — e com ela todos os outros terminais abertos (dos outros projetos também).

| Situação | Problema? |
|---|---|
| Editar o **backend** num terminal da app, com o backend em `npm run dev` | ⛔ Sim — morre à primeira gravação |
| Editar o **frontend** num terminal da app | Não — o Vite recarrega o browser, o backend continua de pé (o terminal volta a ligar pelo scrollback) |
| Trabalhar noutros projetos num terminal da app | Não — só o código deste backend faz o watch reiniciar |
| Editar o backend num terminal **fora** da app (Windows Terminal, VS Code) | Não |

**Como trabalhar no backend**, quando lá chegar:
1. **Terminal fora da app** para desenvolver o backend — o mais simples.
2. **Duas instâncias**, se quiseres mesmo usar a app para se desenvolver a si própria:
   - uma **estável** — `npm run build` no `frontend/`, depois `npm run build && npm start` no `backend/`
     (sem watch), na porta 7400: serve a SPA e os terminais onde trabalhas, abre-se em
     `http://localhost:7400` ([[adr/0010-spa-servida-pelo-backend]]);
   - uma **de desenvolvimento** — `npm run dev` noutra porta (ex.: `PORT=7410`, com o seu `.env` e o seu
     frontend), que é a que estás a alterar. Quando uma alteração estiver pronta, rebuild da estável
     (o que também mata os terminais dela — fazê-lo num momento escolhido, não a cada gravação).

Mesmo com a instância estável, **qualquer reinício do backend mata todos os terminais** — atualizar a app
é sempre um momento escolhido.

## Frontend — `react-vite-antd` (✅)

```bash
cd frontend
npm install        # dependências
npm run dev        # servidor de desenvolvimento (porta 7401)
npx tsc -b         # type-check REAL (ver abaixo)
npm run lint       # ESLint
npm run build      # tsc -b + build do Vite
```

### Armadilhas dos comandos

- 🚨 **`npx tsc --noEmit` não verifica nada** quando o `tsconfig.json` da raiz é só um stub de
  referências (`tsconfig.app.json` + `tsconfig.node.json`): sai com 0 erros e 0 ficheiros
  analisados. **O único type-check real é `npx tsc -b`.**
- **A porta importa.** O backend só permite CORS (e WebSocket) das origens configuradas. Se a 7401 estiver
  ocupada, o Vite salta para outra e todas as chamadas à API — e o WebSocket — são bloqueadas, com
  sintomas que parecem de autenticação. `server.strictPort: true` no `vite.config.ts`.
- Em dev, o Vite faz **proxy de `/api`** (incluindo WebSocket, `ws: true`) para `127.0.0.1:7400` e o
  frontend usa caminhos relativos (`VITE_API_URL` vazia) — para o browser é tudo mesma origem. O alvo é
  `127.0.0.1` e não `localhost` porque no Node 24 `localhost` pode resolver para `::1`, onde o backend
  não escuta. O `Origin` do upgrade do WebSocket chega ao backend tal como o browser o mandou
  (`http://localhost:7401`), por isso continua a ter de estar no `CORS_ALLOWED_ORIGINS`.
- **Versões fixadas por causa do Smart App Control** (ver a secção do backend): `vite@7` e
  `@vitejs/plugin-react@5` (o 6 exige o Vite 8); `typescript@6` (o 7 é um binário nativo novo). Os
  binários do Tailwind 4 (`@tailwindcss/oxide`, `lightningcss`) correram sem bloqueio a 2026-09-28.

## Verificação no browser — `scripts/verify/`

> ✅ 2026-10-23. Node 24 puro (`.mjs`, `WebSocket`/`fetch` globais), sem dependências — o `argon2` e o
> `tsx` vêm do `backend/node_modules`. Só Windows (`netstat`, `taskkill`, caminho do `chrome.exe`).

```bash
cd frontend && npm run build && cd ..                     # a instância serve o frontend/dist
node scripts/verify/instance.mjs start --fresh            # instância de teste na 7498 → imprime a pasta de execução
node scripts/verify/smoke.mjs                             # cenário de exemplo: login pelo formulário, registo, consola
node scripts/verify/instance.mjs stop --clean             # mata a árvore pelo PID da porta e apaga a pasta
```

- **`instance.mjs start`** — porta própria (`--port`, omissão 7498; recusa a 7400 e a 7401 do dono),
  pasta de execução em `%TEMP%\wfa-verify-<porta>` (`--dir` para outra). Lá dentro: `data/` (`DATA_DIR`),
  `roots/proj-alfa…` (`ALLOWED_ROOTS`, `--projects N`, omissão 3), `claude/` (`CLAUDE_CONFIG_DIR` próprio;
  `--sessions` semeia duas sessões `.jsonl` falsas no 2.º projeto), `workflow/` falso com `projects/INDEX.md`
  (ou `--workflow <caminho>` para um Workflow real; `--git-workflow` põe-no **dentro** das roots, como repo git
  limpo e pasta de confiança do `claude/` da instância — o que uma importação precisa. O `claude` dessa
  instância não tem login, por isso nunca corre o `/import`: o cenário escreve à mão o que a skill escreveria),
  `backend.log` e **`instance.json`** (URL, utilizador,
  password, pastas) que o driver lê. **Gera um login novo a cada arranque** (utilizador `verifier`, password
  aleatória, hash argon2id). Anula tudo o que o `backend/.env` do dono define — o `loadEnvFile` não
  sobrepõe variáveis já definidas, por isso o que ficasse de fora entrava (o `TELEGRAM_BOT_TOKEN` sobretudo).
  `tsx` sem watch: gravar no `backend/` não a reinicia a meio de uma verificação.
- **`instance.mjs stop`** — `taskkill /T /F` ao PID que escuta na porta (leva os `claude` filhos) e
  confirma que o `/api/health` deixou de responder. Nunca filtra processos por linha de comando.
- **`cdp.mjs`** — `openBrowser()` (Chrome headless, perfil descartável; `send`, `evaluate`, `waitFor`,
  `type`, `key`, `api` com o cookie da página, `navigate`, `errors` da consola, `on(evento, fn)` para eventos do
  CDP — ex. `Fetch.requestPaused` para responder a uma chamada à API a partir do cenário), `login()`, `checker()`
  (`PASS`/`FAIL` e código de saída), `readInstance()`. Um cenário novo começa por copiar o `smoke.mjs`.
- O URL é `localhost` (não `127.0.0.1`): é a única origem sob o `rpID` das passkeys.

## Testes — o que liga a quê

| Peça | O quê | Liga a | Estado |
|---|---|---|---|
| Backend | Vitest — `TerminalManager` (com um processo falso em vez do `claude`), política de pastas, guarda de auth, parsing dos manifestos da biblioteca | nada externo | ✅ config, erros, health, CORS, shutdown, `TerminalManager` + denylist, auth (login/logout/me, nome de utilizador + tempo constante, expiração, rate limit, cookie adulterado, WS sem cookie / `Origin` alheio), SPA servida (fallback, cache, path traversal, origem própria no WS), `StateStore`, biblioteca (manifestos válidos/inválidos, `LIBRARY_001`), política de pastas (junctions, prefixo), sessões `.jsonl`, argumentos do `claude`, ciclo de vida dos terminais, rotas e gateway WS (ordem ready→scrollback, 4404/4401, nada nos logs), quota (o `statusline.cjs` corrido como o Claude Code o corre), pastas e sessões — 159 testes (2026-09-28) |
| Backend | Spike manual do PTY no Windows (`scripts/pty-spike.ts`): binário, ambiente do filho, `/status` = subscrição, resize, Ctrl+C, kill da árvore | o `claude` real (sem gastar quota) | ✅ 7/7 a 2026-09-28 |
| Backend | Spike manual da status line (`scripts/statusline-spike.ts`): `--session-id`, `--settings`, `rate_limits` no JSON, caminho do `.jsonl` | o `claude` real (`--prompt` gasta uma mensagem) | ✅ a 2026-09-28: `rate_limits` só depois da 1.ª resposta |
| Frontend | `npx tsc -b` + lint | — | ✅ limpos a 2026-09-28 |
| Frontend | Testes automáticos | — | **nenhum** (omissão da stack) — verificação no browser (DOM + rede); a `/_tokens` (só dev) mostra tokens e componentes comuns montados |
| App inteira | `scripts/verify/` — cenários por CDP contra uma instância de teste (secção acima) | o backend real numa porta à parte, Chrome headless | ✅ `smoke.mjs` 6/6 a 2026-10-23. Os cenários das specs antigas não foram portados |

**O que não está coberto, sem suavizar**: ninguém testa automaticamente o Claude Code a correr dentro
do PTY (depende do login real e gasta quota); a renderização do terminal (canvas do xterm.js) só se
verifica a olho.

> Escrever aqui, sem suavizar, o que **não** está coberto (ex.: "ninguém testa SQL nem mapeamentos — as
> migrações só se provam ao arrancar"), para não se assumir cobertura que não existe.

## Relacionado

[[environment]] · [[architecture]]
