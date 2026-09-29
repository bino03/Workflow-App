# Casos de uso

> 🚧 Da entrevista de criação. Refinar à medida que as features são planeadas.

## Papéis

| Papel | O que pode fazer | O que vê |
|---|---|---|
| Dono (único utilizador) | Tudo: abrir/fechar/retomar terminais, escrever neles, navegar a biblioteca | Tudo |

Sem roles: não há um segundo papel. O login existe para **impedir** qualquer outra pessoa, não para
distinguir permissões.

## Ecrãs do MVP

Desenhados no `/choose-design` (2026-09-27) — protótipos em
[[../design/handoff-2026-09-27/README|docs/design/handoff-2026-09-27]], decisão em [[../adr/0008-identidade-visual]].

| Ecrã | Para quê | Estado |
|---|---|---|
| Terminais | Navegação **por projeto** (lateral lista projetos do registo do Workflow, um separador tipo browser por projeto aberto — [[../features/separadores-de-projetos]]); dentro de um separador, sessões abertas com estado de cada uma, novo terminal (drawer: pasta, sessão nova / continuar / retomar), fechar (confirmação), quota à vista. Dois modos: **foco dividido** (por omissão) e **grelha** | ✅ desenhado |
| Biblioteca | Stacks · Designs · Skills, pesquisa, filtro por maturidade, drawer de detalhe com o manifesto | ✅ desenhado |
| Login | Entrar (um só utilizador) | ✅ desenhado |
| Definições | Drawer no menu de utilizador: escolher o modo de layout dos terminais | ✅ decidido (sem protótipo — segue o drawer do Novo terminal) |

## Casos de uso

- O dono **abre um terminal** numa pasta que escolhe, e fica com uma sessão do Claude Code nova.
- O dono **retoma uma sessão** anterior dessa pasta (`--resume`), para continuar onde a deixou.
- O dono **escreve** num terminal (mensagens, `/skills`, atalhos de teclado) e vê a resposta em tempo real.
- O dono **acompanha várias sessões** em paralelo e percebe qual está a trabalhar, qual espera por ele e qual terminou.
- O dono **fecha** um terminal; a sessão fica gravada pelo Claude Code e pode ser retomada.
- O dono **navega entre projetos** pelos separadores tipo browser; esconder um separador não mata os
  terminais desse projeto — reabre-se clicando o projeto na lateral.
- O dono **vê quanto da quota** da subscrição já gastou antes de abrir mais sessões — a quota é da conta, não do terminal.
- O dono **escolhe nas Definições** se vê os terminais em foco dividido (um de cada vez, ou dois lado a lado) ou em grelha (todos à vista).
- O dono **consulta a biblioteca** do Workflow (que stacks e designs existem, quão maduros são, que skills há) sem abrir o Obsidian.
- (Futuro) O dono **lança o `/create`** a partir de um formulário.

## Relacionado

[[overview]] · [[design-brief]] · [[../security]]
