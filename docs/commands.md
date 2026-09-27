# ⌨️ Comandos

Tudo o que se corre neste projeto, num sítio só — com as armadilhas de cada comando.

## Backend — `node-fastify` (📋)

> 🚧 Scripts propostos para o `package.json` — **não verificados** até ao scaffold.

```bash
cd backend
npm install          # dependências (node-pty compila/descarrega um binário nativo — ver armadilhas)
npm run dev          # tsx watch src/server.ts — porta 7400, só em 127.0.0.1
npm run typecheck    # tsc --noEmit (tsconfig único, sem referências — aqui --noEmit verifica mesmo)
npm run lint         # ESLint
npm test             # Vitest
npm run build        # tsc → dist/
npm start            # node dist/server.js
npm run hash-password  # gera o APP_PASSWORD_HASH (argon2id) a partir de uma password pedida no terminal
```

### Armadilhas dos comandos

- **`npm install` falha no `node-pty`** — é um módulo nativo. Sem binário pré-compilado para a versão do
  Node/SO, compila com `node-gyp`, e no Windows isso pede as *Visual Studio Build Tools* (C++) e Python.
  Fixar a versão do `node-pty` e usar uma versão LTS do Node.
- **Mudar a versão do Node parte o `node-pty`** (`NODE_MODULE_VERSION` diferente) → `npm rebuild node-pty`.
- **`npm run dev` com `tsx watch` reinicia o servidor a cada gravação — e cada reinício mata todos os
  terminais abertos.** Não trabalhar no backend a partir de um terminal servido *por este mesmo backend*
  em modo watch (a sessão do Claude Code que está a editar o código morre ao gravar). Para desenvolver o
  backend, usar um terminal normal ou uma segunda instância noutra porta.

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
- Em dev, o Vite faz proxy de `/api` (incluindo WebSocket, `ws: true`) para `127.0.0.1:7400` — ou o
  frontend fala diretamente com `VITE_API_URL`; decidir no scaffold e escrever aqui.

## Testes — o que liga a quê

| Peça | O quê | Liga a | Estado |
|---|---|---|---|
| Backend | Vitest — `TerminalManager` (com um processo falso em vez do `claude`), política de pastas, guarda de auth, parsing dos manifestos da biblioteca | nada externo | 🚧 a criar no scaffold |
| Backend | Spike manual do PTY no Windows: `claude` arranca, recebe input, faz resize, termina | o `claude` real | 🚧 primeira tarefa |
| Frontend | `npx tsc -b` + lint | — | 🚧 |
| Frontend | Testes automáticos | — | **nenhum** (omissão da stack) — verificação manual no browser |

**O que não está coberto, sem suavizar**: ninguém testa automaticamente o Claude Code a correr dentro
do PTY (depende do login real e gasta quota); a renderização do terminal (canvas do xterm.js) só se
verifica a olho.

> Escrever aqui, sem suavizar, o que **não** está coberto (ex.: "ninguém testa SQL nem mapeamentos — as
> migrações só se provam ao arrancar"), para não se assumir cobertura que não existe.

## Relacionado

[[environment]] · [[architecture]]
