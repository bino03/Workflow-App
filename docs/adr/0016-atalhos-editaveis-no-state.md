---
tags: [adr]
status: aceite
data: 2026-10-20
---

# ADR 0016 — Atalhos de teclado editáveis, guardados no `state.json`

**Data**: 2026-10-20 · **Estado**: `aceite` · **Decidido com**: `/plan-feature` (pedido do dono)

Complementa [[0009-estado-em-ficheiro-json]] e [[0008-identidade-visual]]. Não substitui nenhum deles:
o layout continua no browser (0009); as regras dos atalhos (`Alt+…`, AltGr+. como exceção) continuam
(0008). Esta decisão só muda **onde** ficam as binds que o dono cria.

## Contexto

Os atalhos dos terminais estão fixos em `frontend/src/hooks/useTerminalShortcuts.ts` (um `switch` sobre
`event.code`). O dono quer criar as próprias binds nas Definições, poder mudar as atuais e acrescentar
ações novas (trocar de projeto, fechar o projeto, saltar para o terminal seguinte/anterior, ir para
Terminais ou Biblioteca), sem mexer no código.

Onde guardar: o 0009 pôs o **layout** no browser e o resto no `state.json`. A regra "nenhuma persistência
fora do modelo" (regra 4 do `CLAUDE.md` da raiz) obriga a decidir de forma explícita para cada coisa nova.

## Opções

| Opção | Prós | Contras |
|---|---|---|
| **`state.json` no backend (escolhida)** | Fica com o resto do estado persistente; uma só fonte; valem em qualquer browser que aponte para esta app | Sobe `STATE_VERSION` para 2 (migração); precisa de endpoint |
| `localStorage` do browser | Sem backend nem migração | Só neste browser; perde-se se os dados do site forem limpos; fora do modelo de persistência |

## Decisão

1. As binds ficam em `state.json`, num campo `keybindings`, **só com as alterações** (ver abaixo). O
   esquema sobe para a versão 2, com um passo de migração de v1 (campo ausente = `{}`).
2. Edita-se **tudo**, incluindo as ações atuais. Cada ação tem um predefinido no código; "repor
   predefinidos" apaga as alterações.
3. Uma ação sem bind (`null`) é válida. As ações novas começam sem bind até o dono lhes atribuir uma.
4. Restrições (no servidor e na captura): só `Alt+<tecla>` e `AltGr+<tecla>` (esta última só com `.` e
   pelo mesmo mecanismo de hoje). `Ctrl`, `Meta` e `Shift` não entram. `Esc` é reservado (sai da grelha
   e é do Claude Code). Uma colisão **dentro** da app é recusada com o nome da ação que já a usa.
5. Uma combinação que o Claude Code ou o shell já usam (`Alt+B`, `Alt+F`, `Alt+.`…) **avisa** ao gravar e
   grava na mesma, por decisão do dono.
6. A tecla é guardada pelo `event.code` (tecla física), como hoje, para não depender do layout.

## Consequências

- **Migração**: `STATE_VERSION` 1 → 2 e um passo `migrate` em `backend/src/state/state.schema.ts`. Um
  `state.json` v1 carrega sem edição manual. Um v3 continua a ser recusado (o guarda de versão já existe).
- **Predefinido novo no código** chega a todos: como só se guardam alterações, uma ação nova recebe o
  predefinido sem migração de dados.
- **Entre browsers**: o `state.json` é do servidor. Como a app é só desktop ([[0008-identidade-visual]]),
  o ganho de sincronização é pequeno. A escolha vale sobretudo por ficar com o resto do estado.
- **Alt+letra no terminal**: ao atribuir `Alt+<letra>`, essa tecla deixa de chegar ao Claude Code ou ao
  shell. O aviso ao gravar é a proteção.

## Revisão

Se as binds passarem a precisar de várias teclas (chords) ou de perfis, reabrir com um ADR novo.
