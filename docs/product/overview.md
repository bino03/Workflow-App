# Visão geral

## O que é

**Workflow App** — Uma UI própria para o Claude Code — gerir várias sessões ao mesmo tempo e navegar a biblioteca do Workflow sem abrir o Obsidian.

## O problema

Hoje o trabalho com o Claude Code faz-se em várias janelas de terminal soltas, cada uma com uma sessão
do `claude`, e com o Obsidian aberto ao lado para consultar a biblioteca do Workflow. Com várias sessões
em paralelo perde-se a noção de qual está a fazer o quê, e não há um sítio que mostre quanto da quota
da subscrição já foi gasto. O Workflow App junta isso numa só interface: abrir e fechar sessões do
Claude Code, vê-las e escrever nelas em tempo real, retomá-las, escolher a pasta de cada uma, ver a
quota usada e navegar a biblioteca do Workflow — tudo o que hoje se faz no terminal, mas mais fácil de
acompanhar. O motor é o próprio Claude Code interativo, a correr num pseudo-terminal (PTY) gerido pelo
backend, com a subscrição Pro/Max já paga — nunca a API nem a Agent SDK ([[adr/0002-motor-via-pty-sobre-subscricao]]).

## Para quem

Um só utilizador: o dono (o autor do Workflow). Uso pessoal, sem intenção de comercializar — ninguém
mais tem conta.

## Contexto de uso

Hoje, no portátil (Windows 11), com várias sessões do Claude Code abertas ao mesmo tempo enquanto
desenvolve. No futuro, a app fica a correr no desktop de casa e é usada "onde quiser" — a partir de
outros dispositivos, através da web. É por isso que tem login desde o início, apesar de ter um só
utilizador: um terminal exposto é um shell na máquina ([[adr/0004-exposicao-e-modelo-de-ameaca]]).
A forma exata da UI (web/desktop) e os ecrãs ficam para desenhar mais tarde.

## MVP — dentro

"No fundo tem que dar para fazer tudo o que consigo fazer neste momento no terminal":
- Abrir e fechar terminais a partir da UI — cada um é uma sessão do Claude Code.
- Ver e escrever em cada terminal em tempo real.
- Correr skills e slash commands normalmente (são só bytes para o stdin).
- **Retomar** uma sessão gravada (`--resume` / `--continue`).
- **Escolher a pasta** de trabalho de cada terminal.
- **Indicador da quota usada** (janela de 5h / tecto semanal) — fonte dos dados por decidir.
- Navegar o registo da biblioteca do Workflow (stacks, designs, skills, maturidade), lido de `library/`.
- Login (um só utilizador).

## Fora de âmbito (para já)

- **Lançar o `/create` por formulário** — "deve fazer, mas está longe de ser uma prioridade"; fica
  documentado para o futuro ([[../../notes/ideas|ideas]]).
- UI que não seja "terminal dentro de uma página" (bolhas de chat, cartões de tool-calls) — exigiria
  parsing do ecrã da TUI ([[../adr/0002-motor-via-pty-sobre-subscricao]]).
- Outros utilizadores / comercialização — reabre a decisão do motor.

## Como se sabe que funciona

O dono deixa de abrir terminais soltos: consegue fazer na app tudo o que fazia no terminal — incluindo
skills, `--resume` e escolher a pasta — com várias sessões em paralelo, sem perder a noção de qual está
a fazer o quê, e com a quota à vista. E a app continua a usar **só** a subscrição: nenhuma chamada à API
é faturada (`/status` dentro de um terminal da app mostra o login da subscrição, não uma API key).

## Relacionado

[[use-cases]] · [[design-brief]] · [[project-profile]] · [[../architecture]]
