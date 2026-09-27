---
tags: [adr]
status: aceite
data: 2026-09-27
---

# 0002 — O motor é o Claude Code interativo num PTY, nunca a API/SDK

> Herdado do Workflow: `docs/adr/0005-motor-via-pty-sobre-subscricao.md` (decidido lá antes de este
> projeto existir). Aqui fica a versão que vale para este código, com as consequências concretas.

## Contexto

A app precisa de acesso programático ao Claude. Há três formas:

1. **Claude Agent SDK** — embebe o motor do Claude Code no backend, com eventos estruturados.
2. **CLI em modo headless** (`claude -p --output-format stream-json`) — subprocess com JSON linha a linha.
3. **A sessão interativa**, a mesma da CLI, a correr num pseudo-terminal (PTY) gerido pelo backend e
   servida ao browser por WebSocket — o padrão "web terminal" (`node-pty` + `xterm.js`).

As opções 1 e 2 são tratadas pela Anthropic como uso programático e exigem uma API key faturada à parte
(a documentação diz que o modo headless não usa o login da subscrição, e que terceiros não podem oferecer
o login do claude.ai nem os seus limites em produtos construídos com a Agent SDK). Só a 3 usa a
subscrição Pro/Max já paga — é literalmente a mesma sessão, pilotada por uma UI em vez de um teclado.

É para **uso pessoal**, de um só utilizador, com o próprio login, sem intenção de comercializar.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| Claude Agent SDK | Eventos estruturados prontos a consumir | API key própria, faturada por token, sem tecto |
| CLI headless (`stream-json`) | Estruturado; simples de arrancar | Mesma exigência de API key |
| **PTY sobre a sessão interativa (escolhida)** | Usa a subscrição já paga; nenhuma chamada à API | UI presa à forma de um terminal; sujeita aos limites de uso da subscrição |

## Decisão

O backend lança o `claude` **interativo** dentro de um PTY (`node-pty`), um processo por terminal. O
frontend liga-se por WebSocket: lê o output para o mostrar no xterm.js e escreve no stdin. Skills e slash
commands funcionam sem nada especial — são bytes. Não se usa Agent SDK nem `claude -p`.

## Consequências

- Só se paga a subscrição. **Garantia técnica**: o processo filho nunca recebe `ANTHROPIC_API_KEY` nem
  `ANTHROPIC_AUTH_TOKEN` ([[../backend-conventions]] → Armadilhas) — se recebesse, o Claude Code passava a
  usar a API sem ninguém dar por isso.
- **A quota é da conta, não do terminal**: a janela de 5h e o tecto semanal são partilhados por todos os
  terminais abertos. Vários terminais em paralelo gastam do mesmo balde, mais depressa — daí o indicador
  de quota no MVP e um `MAX_TERMINALS`.
- A UI é "terminais numa página". Qualquer coisa além disso (bolhas de chat, cartões de tool-calls)
  exigiria parsing da TUI (ANSI, repaints, spinners) — frágil. Se esse esforço vier a pesar mais do que o
  custo da API, esta decisão revê-se com um ADR novo.
- Retomar uma sessão é o `--resume <uuid>` / `--continue` do próprio Claude Code — a app não guarda
  conversas.
- Vale só para uso pessoal. Dar acesso a outras pessoas reabre a pergunta (e empurra para API/SDK).

## Estado

`aceite`
