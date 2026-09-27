# Briefing de design — Workflow App

> Para quem desenha a interface (incluindo um chat de design). Não é uma especificação visual: é o que é
> preciso saber **antes** de desenhar.

## 1. O que é o produto

Uma UI própria para o Claude Code — gerir várias sessões ao mesmo tempo e navegar a biblioteca do Workflow sem abrir o Obsidian.

Hoje o trabalho com o Claude Code faz-se em várias janelas de terminal soltas, cada uma com uma sessão
do `claude`, e com o Obsidian aberto ao lado para consultar a biblioteca do Workflow. Com várias sessões
em paralelo perde-se a noção de qual está a fazer o quê, e não há um sítio que mostre quanto da quota
da subscrição já foi gasto. O Workflow App junta isso numa só interface: abrir e fechar sessões do
Claude Code, vê-las e escrever nelas em tempo real, retomá-las, escolher a pasta de cada uma, ver a
quota usada e navegar a biblioteca do Workflow — tudo o que hoje se faz no terminal, mas mais fácil de
acompanhar. O motor é o próprio Claude Code interativo, a correr num pseudo-terminal (PTY) gerido pelo
backend, com a subscrição Pro/Max já paga — nunca a API nem a Agent SDK ([[adr/0002-motor-via-pty-sobre-subscricao]]).

## 3. Quem usa, onde e em que estado de espírito

Um só utilizador: o dono (o autor do Workflow). Uso pessoal, sem intenção de comercializar — ninguém
mais tem conta.

Hoje, no portátil (Windows 11), com várias sessões do Claude Code abertas ao mesmo tempo enquanto
desenvolve. No futuro, a app fica a correr no desktop de casa e é usada "onde quiser" — a partir de
outros dispositivos, através da web. É por isso que tem login desde o início, apesar de ter um só
utilizador: um terminal exposto é um shell na máquina ([[adr/0004-exposicao-e-modelo-de-ameaca]]).
A forma exata da UI (web/desktop) e os ecrãs ficam para desenhar mais tarde.

## 4. Ecrãs

Ver [[use-cases]] → "Ecrãs do MVP". Prioridade: Terminais e Biblioteca (proposta — os ecrãs estão em standby).

## 5. Vocabulário do domínio

Ver [[project-vocabulary]]. UI em pt-PT; código em inglês.

## 6. Restrições técnicas

- React + Vite + TypeScript + Ant Design + Tailwind ([[../adr/0001-stack-tecnologica]]), com **xterm.js**
  como emulador de terminal: o conteúdo de cada terminal é a TUI do Claude Code, desenhada por ela (cores
  ANSI, spinners) — a app desenha **à volta** dos terminais, não dentro.
- Vários terminais vivos ao mesmo tempo: um terminal escondido (separador inativo) continua a receber
  output; o layout tem de lidar com resize (o PTY recebe as colunas/linhas novas).
- Atalhos de teclado: o terminal com foco apanha o teclado (Ctrl+C, Esc, setas são do Claude Code) —
  atalhos da app não podem colidir com os do Claude Code.
- Hoje no portátil; no futuro de qualquer dispositivo — responsivo ❓ por decidir (standby).
- UI em pt-PT.

## 7. Identidade visual

**Por escolher** — `/choose-design` decide, por uma de três vias: um design da biblioteca do Workflow,
um design importado da net, ou um desenhado no Claude Design a partir de um prompt gerado com este
briefing. Seja qual for a via, não começar por um design system abstrato: validar em 2-3 ecrãs reais
(Terminais e Biblioteca (proposta — os ecrãs estão em standby) primeiro) antes de fixar os tokens em [[design/tokens-and-colors]].

## 8. Buracos no briefing

- Ecrãs exatos além dos terminais e da biblioteca (standby).
- Forma final da UI: web no browser, PWA, ou desktop (Tauri/Electron) por cima do mesmo backend.
- Layout dos terminais: separadores, grelha, split — e quantos à vista ao mesmo tempo.
- Uso em telemóvel/tablet (teclado virtual num terminal é difícil) — responsivo ou não.
- Identidade visual (`/choose-design`).

## Relacionado

[[overview]] · [[use-cases]] · [[frontend-visual-consistency]]
