---
tags: [adr]
status: aceite
data: 2026-09-27
---

# 0007 — Frontend: estado, ícones e terminal (omissões da stack)

## Contexto

A stack `react-vite-antd` obriga a decidir estado transversal, estado de lista, estado de servidor,
ícones, i18n e responsivo. O frontend está em standby ("tudo do frontend também ainda vou desenhar mais
tarde"), por isso ficam as omissões da stack — e o que é novo aqui: os terminais.

## Opções consideradas

| Decisão | Omissão da stack / escolha | Alternativa |
|---|---|---|
| Estado transversal | **React Context** (auth, confirmação) | Zustand/Redux |
| Estado de lista | **Hook local por domínio** (`useTerminals`, `useLibrary`) | Store global |
| Estado de servidor | **Manual (hook + service)** | TanStack Query — se a revalidação crescer |
| Ícones | **`@ant-design/icons`** | Outra família |
| i18n | **Não** — UI só em pt-PT | i18next |
| Emulador de terminal | **xterm.js** (`@xterm/xterm` + `@xterm/addon-fit`) | hterm; um `<pre>` (não serve para uma TUI) |
| Responsivo | ❓ **em aberto** | — |

## Decisão

As omissões da stack, mais **xterm.js** para os terminais. O estado de um terminal (a ligação WebSocket,
a instância do xterm.js) vive **dentro** do componente `TerminalView`, não num Context: são objetos
imperativos, não estado de React. A lista de terminais (metadados) é um hook local.

## Consequências

- Os terminais escondidos (separador inativo) mantêm o WebSocket e a instância do xterm.js vivos — ou são
  desmontados e reenviados pelo scrollback ao voltar; decide-se na feature de terminais.
- Responsivo decide-se com o `/choose-design`.

## Estado

`aceite` — omissões da stack, escolhidas pelo `/create`; rever no `/choose-design`.
