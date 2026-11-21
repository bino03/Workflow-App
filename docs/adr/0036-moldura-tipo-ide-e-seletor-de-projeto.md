---
tags: [adr]
status: aceite
data: 2026-11-21
---

# 0036 — Moldura tipo IDE: barra de título de 32 px, marca "Em paralelo", lateral do projeto ativo e seletor de projeto (Alt+B)

**Data**: 2026-11-21 · **Estado**: `aceite` · **Decidido com**: o dono, no `/choose-design` de 2026-11-20/21 —
"mudar um bocado o design desta app e fazer uma coisa mais profissional e mais parecida com uma IDE tipo o
vscode". Altera a parte de layout e o wordmark do [[0008-identidade-visual]]; substitui a faixa de separadores
da spec [[../features/separadores-de-projetos]].

## Contexto

A moldura do 0008 tinha um header de 48 px com o wordmark (losango + "WORKFLOW"), a navegação, as ações à
direita, e — desde a spec separadores-de-projetos — uma faixa de 56 px com um separador por projeto aberto, por
cima de uma lateral de 288 px que listava **todos** os projetos. O dono queria algo mais denso e profissional,
como o VS Code ou o OrbitSpace ADE (captura de referência na conversa).

O desenho foi feito no Claude Design (agora dentro do Claude), num canvas com três propostas e iterações:
https://claude.ai/artifact/R3oG66QvDxj6TRqQu6wkNk (privado, do dono).

## Opções consideradas

**Estrutura** (todas com a paleta Violeta e a Geist do 0008, que se mantêm):

| Proposta | O que era |
|---|---|
| A · Compacto | Título de 34 px com navegação e breadcrumb, árvore *Workspaces* com todos os projetos, dois painéis |
| B · Barra de atividade | Ícones à esquerda (estilo VS Code), paleta de comandos, terminais como separadores de editor |
| **C · Workspaces** ✅ | Projetos como separadores no título, lateral do projeto ativo, grelha densa. Afinada pelo dono: célula da marca alinhada com a lateral; **sem separadores** — a navegação passa para a esquerda; mudar de projeto por um seletor e `Alt+B`; nome do utilizador ao lado do ícone |

**Marca**: Fluxo (nós a subir) · **Em paralelo** ✅ (uma linha que se divide em três) · Prompt (`›` com cursor) ·
Painéis (2×2) · W em fluxo. O dono não gostava do losango; escolheu a que diz o que a app é — várias sessões ao
mesmo tempo.

**Atalho do seletor**: `Alt+B` (pedido do dono) vs. uma combinação sem colisão. `Alt+B` é "recuar uma palavra" em
muitos shells (já está nos avisos do catálogo, [[0016-atalhos-editaveis-no-state]]).

## Decisão

1. **Barra de título de 32 px** (`AppLayout`): à esquerda uma célula com a marca, da largura da lateral dos
   Terminais (`--wfa-sidebar-width`, 272 px, `surface-1`, borda à direita) — as duas leem-se como uma coluna;
   logo a seguir **toda a navegação**: Terminais · Projetos · Biblioteca · Upwork · Novo projeto (ativo com
   sublinhado interior `accent`); à direita só o menu de utilizador, com ícone + **nome** + seta. Barra de estado
   de 24 px, em mono.
2. **Marca "Em paralelo"** (`ParallelMark` em `Wordmark.tsx`): SVG de uma linha que se divide em três, só em
   `accent` (traço 2.2 até 18 px). Também o `favicon.svg` (o único sítio com o hex escrito, porque um favicon não lê
   CSS — como o `xtermTheme.ts`).
3. **Sem separadores de projeto.** A lateral dos Terminais passa a ser **do projeto ativo**: kicker "Projeto" com a
   dica do atalho, o **nome do projeto é o botão do seletor**, por baixo o caminho e as ações do projeto (favorita,
   retomar, novo terminal, noutra conta), os chips de estado (só com mais de um estado), "Reabrir todos" (global) e
   os terminais do projeto. A quota continua no fundo.
4. **Seletor de projeto** (`ProjectSwitcher`): painel por cima da lateral, com pesquisa (nome ou caminho), a lista —
   projetos com terminais primeiro, depois as favoritas, depois o resto — com os estados dos terminais de cada um e
   "atual", e "Novo projeto…" em baixo. `↑↓`, Enter, Esc, clique fora. **Escolher um projeto só o ativa**: um
   projeto vazio não ganha um terminal sozinho (o antigo clique no projeto criava-o), para se poder escolher
   novo / noutra conta / retomar.
5. **Ação nova `projectSwitch`, por omissão `Alt+B`**, no catálogo do backend (grupo Projetos, editável nas
   Definições). Aceita-se perder o "recuar uma palavra" do shell: muda-se de projeto muito mais vezes. Funciona
   também com o teclado dentro de um terminal (o xterm recusa as combinações com bind). `projectNext/Prev/Close`
   continuam, sobre os projetos abertos nesta sessão.

## Consequências

- Mais área para os terminais: −16 px no título, −56 px da faixa de separadores, −16 px na lateral.
- O `ProjectTabs.tsx` e o cenário `scripts/verify/sidebar-empty-project.mjs` saem (o cabeçalho do projeto deixou de
  ser um botão com ícones dentro). Novo cenário: `scripts/verify/project-switcher.mjs`.
- Os outros ecrãs (Projetos, Biblioteca, Upwork, Definições, Novo projeto) herdam a barra nova mas não foram
  revistos para a densidade nova — fica no [[../../notes/ToDo]].
- Fica de fora, por decidir à parte: a **grelha densa** da proposta C (cabeçalhos de painel de 26 px) e o **painel
  de tarefas por projeto** (precisa de `/design-database` antes — persistência nova no `state.json`).

## Relacionado

[[0008-identidade-visual]] · [[0016-atalhos-editaveis-no-state]] · [[../features/separadores-de-projetos]] ·
[[../skills/references/design/app-shell-and-auth]]
