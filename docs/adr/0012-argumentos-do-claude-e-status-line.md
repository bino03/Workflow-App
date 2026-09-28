---
tags: [adr]
status: aceite
data: 2026-09-28
---

# ADR 0012 — Argumentos do `claude`: `--session-id`, `--resume` e a status line da quota

**Data**: 2026-09-28 · **Estado**: `aceite` (a parte da quota fica **condicionada ao spike**, ver
"Estado") · **Decidido com**: `/implement-todo` + `/plan-feature` (spec [[../features/terminais]])

Detalha a proteção 4 de [[0004-exposicao-e-modelo-de-ameaca]] ("só `CLAUDE_BIN`, com argumentos fixos;
`--resume` só com um UUID validado"). Não a enfraquece: diz exatamente que argumentos existem.

## Contexto

A feature Terminais precisa de três coisas que o 0004 não previa por extenso:

1. **Saber o UUID da sessão de cada terminal**, para o reabrir depois de um reinício (`state.json`,
   [[0009-estado-em-ficheiro-json]]). Com `claude` sem argumentos, o UUID só se descobria depois, a
   adivinhar pelo `.jsonl` mais recente da pasta — frágil com dois terminais na mesma pasta.
2. **"Continuar a última"** sem perder o UUID — `claude --continue` não diz que sessão escolheu.
3. **A quota da subscrição** sem API ([[0002-motor-via-pty-sobre-subscricao]]). A única fonte conhecida é
   o JSON que o Claude Code entrega ao comando da **status line**.

## Opções

| Opção | Prós | Contras |
|---|---|---|
| **`--session-id <uuid>` gerado pelo backend; `--resume <uuid>` para retomar e para "continuar a última" (escolhida)** | O UUID é sempre conhecido antes de o processo arrancar; um só caminho de arranque | Depende de o CLI aceitar `--session-id` (confirmado no spike do PTY: `claude --help`) |
| `claude` sem argumentos + descobrir o `.jsonl` depois | Nada novo | Ambíguo com dois terminais na mesma pasta; corrida com a escrita do ficheiro |
| `claude --continue` | Um argumento só | Não se sabe que sessão retomou → não se pode reabrir depois |
| **Quota: `--settings <DATA_DIR>/claude-settings.json` com um `statusLine` fixo (escolhida, a confirmar)** | Sem API; os dados vêm do próprio Claude Code | A status line do utilizador fica substituída nos terminais da app; depende de o JSON trazer `rate_limits` |
| Quota: ler ficheiros em `~/.claude` | Sem argumentos novos | Não há lá a quota |
| Quota: chamar a API | Dados diretos | Proibido (0002) |

## Decisão

Os únicos argumentos que o backend passa ao `CLAUDE_BIN` são, gerados só em `terminals/claudeArgs.ts`:

| Argumento | Quando | Valor |
|---|---|---|
| `--session-id <uuid>` | Terminal novo | UUID v4 gerado pelo backend (`crypto.randomUUID`) |
| `--resume <uuid>` | Retomar, continuar a última, reabrir | UUID validado (formato) **e** existente como `.jsonl` da pasta |
| `--settings <caminho>` | Sempre que a quota está ativa | `DATA_DIR/claude-settings.json`, escrito pelo backend no arranque |

- O cliente só envia `cwd`, `mode`, `sessionId` (UUID) e `label` — nenhum texto dele entra na linha de
  comando. Sem shell (`node-pty` lança o binário diretamente).
- O `claude-settings.json` só tem `statusLine: {type: "command", command: "\"<process.execPath>\"
  \"<DATA_DIR>/statusline.cjs\""}`. É o **Claude Code** que executa esse comando (num shell dele) — por
  isso o comando é fixo, com caminhos absolutos escritos pelo backend, e o `statusline.cjs` só lê o stdin,
  grava `DATA_DIR/usage.json` e imprime uma linha curta.
- `DATA_DIR` já está na denylist do ambiente do filho; o conteúdo dos terminais continua fora dos logs.

## Consequências

- Todo o terminal tem `claudeSessionId` desde o arranque → Reabrir, histórico e "sessão já aberta
  noutro terminal" funcionam por UUID.
- Nos terminais da app, a status line pessoal do utilizador (se tiver uma) é substituída pela da app.
- Se o CLI mudar os nomes destes argumentos, falha num sítio só (`claudeArgs.ts`) e o spike do PTY
  apanha-o.

## Estado

`aceite` para `--session-id` e `--resume`. A parte `--settings`/status line fica **condicionada ao passo 1
da spec** (spike): se o JSON não trouxer `rate_limits`, essa parte passa a `rejeitada` com o que se
encontrou, e a quota volta a `notes/ideas.md`.
