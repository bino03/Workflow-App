# 📡 Referência da API

> 🚧 Sem endpoints ainda — as rotas abaixo são a **proposta** da criação do projeto. Cada endpoint entra
> (ou é corrigido) aqui no mesmo commit; o hook avisa quando um ficheiro de rotas muda.

Base: `http://localhost:7400/api`. Todas as rotas exigem sessão, exceto as listadas
como públicas em [[security]].

## Formato de erro

```json
{ "errorCode": "MODULE_NNN", "message": "…", "fieldErrors": [ { "field": "…", "message": "…" } ] }
```

Ver [[error-model]].

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

### Protocolo do WebSocket (proposta)

| Direção | Mensagem | Nota |
|---|---|---|
| servidor → cliente | frame binário/texto com o output do PTY | O scrollback guardado vai primeiro, ao ligar |
| cliente → servidor | frame com input (bytes do teclado, colagens) | Escrito tal e qual no PTY |
| cliente → servidor | `{"type":"resize","cols":N,"rows":M}` | JSON num frame de texto — distinguir de input |
| servidor → cliente | `{"type":"exit","code":N}` | O processo terminou |

> A forma exata (binário vs. texto, como distinguir controlo de input) fixa-se no spike do PTY e fica
> aqui. Tipos em `backend/src/terminals/protocol.ts`, espelhados no frontend.

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

## Auth e saúde

| Método | Rota | Acesso | Corpo | Resposta |
|---|---|---|---|---|
| POST | `/api/auth/login` | **público** (rate limit) | `{password}` | `204` + cookie · `401` |
| POST | `/api/auth/logout` | sessão | — | `204` |
| GET | `/api/auth/me` | sessão | — | `{authenticated:true}` |
| GET | `/api/health` | **público** | — | `{status:"ok"}` |

---

_(Uma secção por domínio — rota, acesso, corpo, resposta e **erros** (`ErrorCode`) de cada endpoint.)_

---

## Relacionado

[[architecture]] · [[database]] · [[security]]
