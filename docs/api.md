# 📡 Referência da API

> 🚧 Implementado: **Auth e saúde** (✅, no fim). O resto são as rotas **propostas** na criação do projeto.
> Cada endpoint entra (ou é corrigido) aqui no mesmo commit; o hook avisa quando um ficheiro de rotas muda.

Base: `http://localhost:7400/api`. Todas as rotas exigem sessão, exceto as listadas
como públicas em [[security]].

## Formato de erro

```json
{ "errorCode": "MODULE_NNN", "message": "…", "fieldErrors": [ { "field": "…", "message": "…" } ] }
```

Ver [[error-model]]. Um só handler (`backend/src/common/errors.ts`) formata todos os erros, incluindo os do
próprio Fastify (JSON mal formado, content-type errado → `COMMON_001`) e as rotas inexistentes.

### Códigos de erro

| Código | HTTP | Quando |
|---|---|---|
| `COMMON_001` | 400 | Validação falhou (`fieldErrors` por campo) ou pedido mal formado |
| `COMMON_002` | 500 | Erro inesperado — o `message` é sempre genérico, o detalhe só vai para o log |
| `COMMON_003` | 404 | Rota inexistente |
| `AUTH_001` | 401 | Password errada |
| `AUTH_002` | 401 | Sem sessão, ou sessão expirada |
| `AUTH_003` | 403 | `Origin` fora de `CORS_ALLOWED_ORIGINS` (upgrade do WebSocket) |
| `AUTH_004` | 429 | Demasiadas tentativas de login |

O frontend espelha esta tabela em `frontend/src/errors/errorMessages.ts` (ainda não existe — nasce na
infraestrutura do frontend, com estes códigos).

## Paginação

Sem paginação no MVP — as listas (terminais abertos, sessões de uma pasta, entradas da biblioteca) são
pequenas e vêm inteiras. Se uma lista crescer, a forma decide-se com [[api-design]] e entra aqui.

---

## Terminais (`terminals/`, `/api/terminals`) — 🚧 proposta

| Método | Rota | Acesso | Corpo | Resposta |
|---|---|---|---|---|
| GET | `/api/terminals` | sessão | — | `[{id, label, cwd, status, exitCode?, startedAt, resumedFrom?}]` |
| POST | `/api/terminals` | sessão | `{cwd, label?, resumeSessionId?, cols, rows}` | `201 {id, …}` |
| PATCH | `/api/terminals/:id` | sessão | `{label}` | `200` |
| DELETE | `/api/terminals/:id` | sessão | — | `204` (mata o processo) |
| WS | `/api/terminals/:id/ws` | sessão + Origin | ver protocolo | — |

### Protocolo do WebSocket

> ✅ Fixado no spike do PTY (2026-09-28). Tipos e schemas em `backend/src/terminals/protocol.ts`,
> espelhados em `frontend/src/types/terminal.ts`. O gateway (a rota WS em si) nasce com a feature
> Terminais.

**A regra: o tipo do frame diz o que é.** Frames **binários** são bytes do terminal (nos dois sentidos);
frames de **texto** são sempre JSON de controlo. Assim uma colagem que por acaso seja JSON nunca é
confundida com uma mensagem de controlo.

| Direção | Frame | Mensagem | Nota |
|---|---|---|---|
| servidor → cliente | texto | `{"type":"ready","status":"running"\|"exited","exitCode":N\|null}` | Sempre a primeira, ao ligar. O cliente faz `term.reset()` — evita o scrollback duplicado ao religar |
| servidor → cliente | binário | output do PTY, UTF-8 | Primeiro o scrollback guardado (até `SCROLLBACK_BYTES`), depois em tempo real |
| servidor → cliente | texto | `{"type":"exit","code":N}` | O processo terminou; o terminal fica listado como `exited` |
| cliente → servidor | binário | input (teclado, colagens), UTF-8 | Escrito tal e qual no PTY. Ctrl+C = `0x03` (dois seguidos fecham o `claude`) |
| cliente → servidor | texto | `{"type":"resize","cols":N,"rows":M}` | Validado com zod: `cols` 2–1000, `rows` 1–500. Fora disso → a mensagem é ignorada |

Os tamanhos iniciais vão no `POST` de criação (`cols`, `rows`), para a TUI não arrancar em 80×24 e
redesenhar logo a seguir.

## Sessões gravadas (`sessions/`, `/api/sessions`) — 🚧 proposta

| Método | Rota | Acesso | Corpo | Resposta |
|---|---|---|---|---|
| GET | `/api/sessions?cwd=…` | sessão | — | `[{id, startedAt, preview}]` — só leitura de `~/.claude/projects/` |

## Biblioteca (`library/`, `/api/library`) — 🚧 proposta

| Método | Rota | Acesso | Corpo | Resposta |
|---|---|---|---|---|
| GET | `/api/library/stacks` | sessão | — | `[{id, name, layer, maturity, pairsWith, providesSkills, path}]` |
| GET | `/api/library/themes` | sessão | — | `[{id, name, mode, density, status, path}]` |
| GET | `/api/library/skills` | sessão | — | `[{name, category, status, appliesWhen, description, path}]` |

## Quota (`usage/`, `/api/usage`) — ❓ fonte por decidir

| Método | Rota | Acesso | Corpo | Resposta |
|---|---|---|---|---|
| GET | `/api/usage` | sessão | — | `{window5h:{usedPct, resetsAt}, weekly:{usedPct, resetsAt}, source, fetchedAt}` |

## Auth e saúde (`auth/`, `common/health.routes.ts`) — ✅

| Método | Rota | Acesso | Corpo | Resposta | Erros |
|---|---|---|---|---|---|
| POST | `/api/auth/login` | **público**, 5/min por IP | `{password}` (1–1024) | `204` + `Set-Cookie: session` | `COMMON_001` corpo inválido · `AUTH_001` password errada · `AUTH_004` 429 |
| POST | `/api/auth/logout` | sessão | — | `204` + cookie limpo | `AUTH_002` |
| GET | `/api/auth/me` | sessão | — | `{authenticated:true}` | `AUTH_002` |
| GET | `/api/health` | **público** | — | `{status:"ok"}` | — |

- **Sem sessão, qualquer rota não pública dá `401 AUTH_002`** — incluindo rotas que não existem (só com
  sessão é que uma rota inexistente dá `404 COMMON_003`); a API não revela que rotas tem.
- Um login com sucesso termina a sessão anterior que o browser trazia (id novo a cada login).

---

_(Uma secção por domínio — rota, acesso, corpo, resposta e **erros** (`ErrorCode`) de cada endpoint.)_

---

## Relacionado

[[architecture]] · [[database]] · [[security]]
