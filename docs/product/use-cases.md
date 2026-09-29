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
| Terminais | Navegação **por projeto** (lateral lista projetos do registo do Workflow, um separador tipo browser por projeto aberto — [[../features/separadores-de-projetos]]); dentro de um separador, sessões abertas com estado de cada uma, "+" cria logo um terminal novo nesse projeto (sem drawer), "Retomar" abre um modal só com as sessões gravadas dessa pasta (sem escolher pasta nem nome), fechar (confirmação), quota à vista. Dois modos: **foco dividido** (por omissão) e **grelha** — na grelha, quatro arranjos à escolha por projeto (3×2 · colunas · 2×2 · principal + laterais — [[../features/estilos-de-grelha]]) | ✅ desenhado |
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
- O dono **escolhe o arranjo da grelha** por projeto (3×2 · colunas · 2×2 · principal + laterais); um
  lugar sem terminal mostra um "+" para abrir um ali mesmo, e um terminal a mais do que lugares continua
  a correr, só troca para o lugar em foco se for clicado na lateral.
- O dono **filtra a lateral por status** (a correr / terminados / parados) para encontrar depressa um
  terminal entre vários projetos — por omissão já só mostra "a correr" (projetos sem nada a correr, sejam
  já abertos ou por abrir, ficam de fora; "Ver todos os projetos" limpa o filtro) — e **esconde a
  lateral** (`AltGr+.`) para ganhar espaço, sem perder nenhum terminal.
- O dono **ajusta o zoom de um terminal** sem afetar o resto da página — nunca precisa do zoom do browser.
- O dono **consulta a biblioteca** do Workflow (que stacks e designs existem, quão maduros são, que skills há) sem abrir o Obsidian.
- (Futuro) O dono **lança o `/create`** a partir de um formulário.

## Relacionado

[[overview]] · [[design-brief]] · [[../security]]
