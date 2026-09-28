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
npm test             # vitest run (test/**/*.test.ts)
npm run build        # tsc -p tsconfig.build.json → dist/ (só src/, sem testes nem scripts)
npm start            # node dist/server.js — serve também o frontend/dist, se existir (build do frontend primeiro)
npm run hash-password  # gera o APP_PASSWORD_HASH (argon2id): pede a password duas vezes, sem eco (mín. 12
                       # caracteres); com stdin em pipe lê uma linha. Só o hash vai para o stdout
npx tsx scripts/pty-spike.ts [cwd]  # spike manual: claude real num PTY (env, /status, resize, Ctrl+C, kill)
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
- **`npm run dev` com `tsx watch` reinicia o servidor a cada gravação — e cada reinício mata todos os
  terminais abertos.** Ver a secção seguinte.

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

## Testes — o que liga a quê

| Peça | O quê | Liga a | Estado |
|---|---|---|---|
| Backend | Vitest — `TerminalManager` (com um processo falso em vez do `claude`), política de pastas, guarda de auth, parsing dos manifestos da biblioteca | nada externo | ✅ config, erros, health, CORS, shutdown, `TerminalManager` + denylist, auth (login/logout/me, expiração, rate limit, cookie adulterado, WS sem cookie / `Origin` alheio), SPA servida (fallback, cache, path traversal, origem própria no WS) — 59 testes. Por fazer: política de pastas, biblioteca |
| Backend | Spike manual do PTY no Windows (`scripts/pty-spike.ts`): binário, ambiente do filho, `/status` = subscrição, resize, Ctrl+C, kill da árvore | o `claude` real (sem gastar quota) | ✅ 7/7 a 2026-09-28 |
| Frontend | `npx tsc -b` + lint | — | ✅ limpos a 2026-09-28 |
| Frontend | Testes automáticos | — | **nenhum** (omissão da stack) — verificação no browser (DOM + rede); a `/_tokens` (só dev) mostra tokens e componentes comuns montados |

**O que não está coberto, sem suavizar**: ninguém testa automaticamente o Claude Code a correr dentro
do PTY (depende do login real e gasta quota); a renderização do terminal (canvas do xterm.js) só se
verifica a olho.

> Escrever aqui, sem suavizar, o que **não** está coberto (ex.: "ninguém testa SQL nem mapeamentos — as
> migrações só se provam ao arrancar"), para não se assumir cobertura que não existe.

## Relacionado

[[environment]] · [[architecture]]
