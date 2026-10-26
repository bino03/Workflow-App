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
| Biblioteca | Stacks · Designs · Skills, pesquisa, filtro por maturidade, drawer de detalhe com o manifesto, upload de uma skill para uma stack | ✅ desenhado |
| Login | Entrar (um só utilizador) | ✅ desenhado |
| Upwork | Candidaturas: lista com estado (filtro, arquivadas) à esquerda, a candidatura aberta à direita — Pacote (análise, carta, triagem, plano, perguntas, cada um com Copiar), Conversa (a do Novo projeto, sem terminal), Dados (estado com histórico, cliente, Connects, link, notas); drawers Perfil e Nova candidatura ([[../features/upwork]]) | ✅ decidido (sem protótipo — segue o Novo projeto e o mestre-detalhe) |
| Definições | Drawer no menu de utilizador: escolher o modo de layout dos terminais; mudar, remover e repor os atalhos de teclado ([[../features/atalhos-editaveis]]); passkeys | ✅ decidido (sem protótipo — segue o drawer do Novo terminal) |

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
- O dono **importa para a biblioteca** uma skill, um design ou uma stack (de qualquer camada) a partir de
  ficheiros, uma pasta, um URL, um projeto local ou uma descrição: **Importar** na Biblioteca, escolhe o quê e de
  onde, responde (ou não) às perguntas desse tipo. A skill `/import` do Workflow faz a triagem e escreve, num
  terminal que não se vê; uma faixa no topo diz em que pé está, **Ver terminal** mostra-o quando a skill precisa
  de uma resposta, e no fim o dono revê a triagem e o diff e **aceita** (commit no Workflow) ou **descarta**
  ([[../features/importar-para-a-biblioteca]], [[../adr/0019-importar-pelas-skills-do-workflow]]).
- O dono **cria um projeto novo sem terminal**: **Novo projeto** (na navegação, ou **+ Novo projeto** nos
  separadores dos Terminais), escreve a ideia e carrega **Começar**. O `/create` do Workflow corre numa sessão
  escondida; o que a descrição não respondeu aparece como mensagem com caixa de resposta, cada escolha como
  cartões, cada permissão como **Permitir/Recusar**, a proposta formatada, e o trabalho como linhas curtas. Pode
  fechar o browser e voltar — a criação continua; **Ver terminal** mostra a sessão real a qualquer momento. No fim,
  o resumo e **Abrir projeto** levam-no aos Terminais com o projeto aberto ([[../features/novo-projeto-guiado]],
  [[../adr/0020-sessoes-guiadas]]).
- O dono **candidata-se a um job da Upwork sem terminal**: **Upwork** → **Nova candidatura**, cola o anúncio e as
  perguntas de triagem e carrega **Gerar**. O `/upwork-proposal` do Workflow escreve a análise "vale a pena?", a carta, as
  respostas de triagem, o plano técnico e perguntas ao cliente, cada um num cartão com **Copiar**; o dono revê, pede
  ajustes na conversa, copia e envia **na Upwork**. Marca o estado à mão (Enviada pausa a sessão; quando o cliente
  responde, cola a mensagem na conversa e a sessão retoma sozinha), e quando ganha cola o acordo e carrega **Criar
  projeto**, que abre o Novo projeto com tudo como brief. A app nunca abre nem lê a Upwork ([[../features/upwork]],
  [[../adr/0022-seccao-upwork]]).

## Relacionado

[[overview]] · [[design-brief]] · [[../security]]
