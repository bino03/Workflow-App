# Prompt para Claude Design — Workflow App

> Gerado pelo `/choose-design` (via Claude Design) a 2026-09-27. Colar tudo abaixo da linha no Claude
> Design. Quando houver resultado: `/choose-design` → Claude Design → **importar resultado**.

---

## Contexto do projeto

O **Workflow App** é uma interface web própria para o **Claude Code** (o assistente de programação da
Anthropic que corre no terminal). Hoje o trabalho faz-se em várias janelas de terminal soltas, cada uma
com uma sessão do `claude`, e com o Obsidian aberto ao lado para consultar uma biblioteca pessoal de
stacks, designs e skills (o "Workflow"). Com várias sessões em paralelo perde-se a noção de qual está a
fazer o quê, e não há um sítio que mostre quanto da quota da subscrição já foi gasto.

A app junta tudo numa só interface: abrir e fechar sessões do Claude Code, vê-las e escrever nelas em
tempo real, retomá-las, escolher a pasta de cada uma, ver a quota usada e navegar a biblioteca.

**Importante para o design:** cada sessão é o Claude Code interativo verdadeiro a correr num
pseudo-terminal, mostrado num emulador de terminal (xterm.js). O **conteúdo** de cada terminal é uma TUI
desenhada pelo próprio Claude Code (texto mono, cores ANSI, spinners) — não se redesenha. A app desenha
**à volta** dos terminais: moldura, navegação, lista de sessões, estados, quota, diálogos. Não há bolhas
de chat nem cartões de mensagens.

Fase: backend a arrancar; nenhum ecrã construído ainda. Este design define a identidade visual inteira.

## Quem usa, onde e como

- **Um só utilizador**: o dono, programador, autor da biblioteca. Uso pessoal, sem outros utilizadores
  nem roles. Há login só para impedir terceiros (a app vai ficar exposta na web).
- **Onde**: portátil Windows e, mais tarde, um desktop em casa acedido de outros computadores pelo
  browser. Ecrãs de portátil (1366–1920 px de largura) e monitores maiores.
- **Como**: sessões longas de desenvolvimento, várias horas, várias sessões do Claude Code abertas ao
  mesmo tempo (tipicamente 2–6). Olha de relance para saber qual sessão está a trabalhar, qual espera
  por ele e qual terminou, e salta entre elas. Teclado sempre à mão.
- **Implicações**: tema escuro (horas seguidas a olhar para terminais); densidade média-alta mas legível
  de relance; o estado de cada sessão tem de se perceber em menos de um segundo, sem ler texto;
  contraste alto no texto pequeno; nada de animação que distraia enquanto se lê output.

## O domínio

A UI é em **português de Portugal (pt-PT)**.

| Conceito na UI | O que é |
|---|---|
| **Terminal** / sessão aberta | Um processo do Claude Code vivo, numa pasta. Tem um nome (a pasta, por omissão), uma pasta de trabalho, e um estado |
| **Estado do terminal** | **A trabalhar** (o Claude está a gerar/correr ferramentas) · **À tua espera** (precisa de input/aprovação) · **Parado / terminado** · **Erro / desligado** |
| **Sessão gravada** | Uma conversa anterior do Claude Code numa pasta, que pode ser **retomada** |
| **Pasta** | A pasta de trabalho de um terminal; só são permitidas pastas dentro de raízes autorizadas |
| **Quota** | Uso da subscrição: **janela de 5 horas** e **tecto semanal**, em percentagem e com hora de reposição. É **da conta, não do terminal** — partilhada por todas as sessões |
| **Biblioteca** | O registo do Workflow: **stacks**, **designs** e **skills**, cada um com uma **maturidade**: ✅ provado · 🟡 parcial/adaptado · 📋 rascunho |

## Ecrãs

Desenhar primeiro, por esta ordem:

1. **Terminais** (o ecrã principal — onde se passa 95% do tempo)
   - As sessões abertas, cada uma com nome, pasta e **estado** bem visível.
   - A área de terminal propriamente dita (um retângulo escuro com texto mono — mostrar um exemplo
     plausível de output do Claude Code lá dentro, só como enchimento).
   - **Layout: propõe 2 alternativas** — por exemplo, separadores/lista lateral com um terminal em foco
     e opção de dividir o ecrã, vs. grelha com todos à vista e clique para ampliar. Os terminais
     escondidos continuam vivos e a receber output, por isso um terminal não visível que passe a
     "À tua espera" tem de chamar a atenção na lista/separador.
   - Ações: **Novo terminal**, fechar terminal (pede confirmação — a sessão fica gravada e pode ser
     retomada), renomear, focar.
   - **Novo terminal** abre um painel lateral (Drawer) com: escolher a pasta (navegador de pastas dentro
     das raízes permitidas), e escolher entre **sessão nova**, **continuar a última** ou **retomar uma
     sessão gravada** (lista das sessões gravadas dessa pasta, com data e primeira mensagem).
   - **Quota sempre à vista** (no cabeçalho ou na barra lateral): duas barras/medidores — janela de 5h e
     semanal — com percentagem e "repõe às 14:30" / "repõe segunda". Estado de alerta perto do limite.
2. **Biblioteca**
   - Três separadores ou secções: **Stacks**, **Designs**, **Skills**.
   - Lista/tabela com nome, descrição curta, maturidade (✅/🟡/📋 como tag de estado), e para stacks as
     tecnologias; pesquisa e filtro por maturidade.
   - Ver o detalhe de uma entrada num painel lateral (Drawer) com o texto do manifesto (markdown).
   - Só leitura — não há criar/editar.
3. **Login** — um campo de password (um só utilizador), botão Entrar, mensagem de erro. Simples.

## Padrões de interação que a app já segue (não reinventar)

- Criar/editar/ver uma entidade abre um **painel lateral (Drawer)** de altura total com cabeçalho e
  rodapé fixos (Cancelar / ação primária à direita); **Modal** só para utilitários curtos.
- Listas: **kicker** (rótulo pequeno em maiúsculas, cor de acento) + título + ação principal à direita;
  tabela com coluna de ações **com texto** ("Ver", "Retomar", "Fechar"), não só ícones; rodapé com
  contagem.
- Estados e categorias como **tags** partilhadas, não badges improvisados.
- **Ações destrutivas pedem confirmação** num diálogo partilhado; o texto do botão diz a ação real
  ("Fechar terminal"), não um genérico "Eliminar".
- Um só canal de notificações (toasts).
- **Um único menu de utilizador** à direita do cabeçalho (sair).
- Navegação de topo: Terminais · Biblioteca (poucas entradas).
- **Teclado**: quando um terminal tem foco, o teclado é dele (Ctrl+C, Esc, setas, Tab são do Claude
  Code). Atalhos da app só com combinações que não colidam — mostrar os atalhos discretamente onde
  fizer sentido.
- Loading discreto no próprio componente; estados vazios discretos (ícone simples + frase), por
  exemplo "Nenhum terminal aberto — Novo terminal".

## O que o design deve transmitir

- Tom nas palavras do dono: **"algo simples e fácil de interpretar, mas mais puxado para algo dark, tipo
  super computador do Batman"**.
- Ou seja: preto profundo, sensação de sala de controlo / consola de alta tecnologia, precisão, calma e
  poder — **mas legível e simples primeiro**. A estética serve a leitura rápida do estado das sessões.
- Evitar: ruído decorativo que dificulte ler (scanlines, glitch, texto a piscar, HUD sci-fi carregado,
  neon em tudo, gradientes chamativos); parecer um tema por omissão de uma biblioteca de componentes
  (o azul genérico do Ant Design); parecer uma app de chat.
- A cor deve ter **significado**: o acento para foco/ação, e as cores de estado (a trabalhar / à tua
  espera / terminado / erro) inconfundíveis entre si e com o acento.

## Preferências

- **Tema: só escuro.** O tema do terminal (xterm.js) deve fundir-se com a moldura.
- **Cores: sem restrições** — propõe tu.
- Referências: nenhuma imposta — interpreta o tom acima.
- **Sugere 2-3 paletas completas e 2-3 combinações tipográficas** para eu escolher, cada uma aplicada
  pelo menos ao ecrã Terminais. A fonte **mono** é crítica (é a do terminal): legível em 13–14 px,
  com boa distinção 0/O e 1/l/I.

## Restrições técnicas

- Stack: React + Vite + TypeScript, **Ant Design 5** (componentes) + **Tailwind 4** (estilo próprio),
  **xterm.js** para os terminais.
- Tokens como **CSS custom properties** com prefixo `--wfa-*` (ex.: `--wfa-color-bg`,
  `--wfa-color-accent`, `--wfa-neutral-500`, `--wfa-font-mono`); o tema do Ant Design vai espelhá-los.
  Nada de valores soltos nos protótipos.
- **Tema do terminal**: define também o tema do xterm.js — `background`, `foreground`, `cursor`,
  `selectionBackground` e as **16 cores ANSI** (normal + bright). A TUI do Claude Code usa essas cores
  (incluindo o laranja/terracota da marca Claude via cores 256/truecolor), por isso **todas** as 16
  têm de ter contraste suficiente sobre o fundo do terminal.
- **Não responsivo**: só desktop/portátil (≥ 1280 px). Não desenhar telemóvel nem tablet.
- Acessibilidade **WCAG AA** mínimo nos pares de texto; estados não dependem só da cor (ícone ou forma
  também); respeitar `prefers-reduced-motion`.
- Fontes de **Google Fonts** (ou livres equivalentes) — nada pago.
- Idioma da UI: pt-PT.

## Resultado esperado

1. **Paleta completa** (por proposta): fundo, superfície(s)/elevação, texto primário/secundário/terciário,
   divisor, acento + hover, escalas 100-900 de neutro e acento, cores semânticas (sucesso/aviso/erro/info)
   e as **cores dos 4 estados de terminal** — em hex, com os rácios de contraste dos pares de texto.
2. **Tema do xterm.js** (`ITheme` completo com as 16 cores ANSI), com contraste de cada cor sobre o fundo.
3. **Tipografia**: famílias (títulos, corpo, mono — Google Fonts, com link), escala de tamanhos e pesos
   por nível.
4. **Espaçamento, raios, sombras/elevação, movimento** (durações e easing).
5. Os ecrãs pedidos em **alta fidelidade**: Terminais (nas 2 alternativas de layout, com vários
   terminais em estados diferentes e a quota visível), o Drawer de Novo terminal, Biblioteca (lista +
   Drawer de detalhe), Login.
6. Um **handoff**: `README.md` com os tokens em tabela + os protótipos (HTML/CSS) como referência — não
   como código final.
