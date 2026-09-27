# CLAUDE.md — Workflow App

> **Toda a documentação deste projeto vive no vault Obsidian: `docs/` e `notes/`.**
> Este ficheiro é um ponteiro, não um sítio para documentar.

Uma UI própria para o Claude Code — gerir várias sessões ao mesmo tempo e navegar a biblioteca do Workflow sem abrir o Obsidian.

## Antes de responder: ler o vault

Perante qualquer pedido sobre este projeto, **o primeiro passo é consultar o vault** — não responder de
memória nem só a partir do código:

1. **[[00-INDEX]]** para navegar.
2. O ficheiro de `docs/` que corresponde à pergunta (tabela abaixo).
3. **[[notes/ToDo]]** e **[[notes/whatIveDone]]** quando a pergunta é sobre o que falta ou o que
   já foi feito — o work log guarda *porque* é que as coisas ficaram como estão.

O código é a verdade sobre o que a aplicação faz **hoje**; o vault é a verdade sobre o que foi decidido
e porquê. Ao terminar um trabalho, o resultado escreve-se no vault (`docs/` para factos,
`notes/whatIveDone.md` para o que foi feito e porquê) — nunca num `CLAUDE.md`.

## Regra

**Não escrever documentação aqui nem em nenhum outro `CLAUDE.md`.** Um `CLAUDE.md` só pode conter: para
onde ir, e convenções sobre *como trabalhar* naquela pasta. Duas cópias do mesmo facto divergem sempre, e
o hook de pre-commit só vigia `docs/`.

## Atalhos, por pergunta

| A pergunta | O ficheiro |
|---|---|
| Onde vive o código disto? | [[docs/code-map]] |
| Como arranco, testo, faço build? | [[docs/commands]] |
| Que variáveis de ambiente preciso? | [[docs/environment]] |
| Como é o sistema por dentro? | [[docs/architecture]] |
| Que rotas tem a API? | [[docs/api]] |
| Como é o schema da base de dados? | [[docs/database]] |
| Convenções e armadilhas do backend? | [[docs/backend-conventions]] |
| Autenticação, roles, CORS? | [[docs/security]] |
| Convenções visuais do Workflow App? | [[docs/skills/references/frontend-visual-consistency]] |
| Porque é que foi decidido assim? | [[docs/adr/README]] |
| Que skills existem? | [[docs/skills/SKILLS-INDEX]] |
| O que está por fazer? | [[notes/ToDo]] |
| O que já foi feito, e porquê? | [[notes/whatIveDone]] |

## As regras que não se negoceiam

1. **Código em inglês; documentação e mensagens de commit em português.**
2. **O motor é a subscrição, nunca a API** — o processo `claude` nunca recebe `ANTHROPIC_API_KEY`; nada de
   Agent SDK nem `claude -p` ([[docs/adr/0002-motor-via-pty-sobre-subscricao]]).
3. **Um terminal é um shell na máquina** — sessão obrigatória em todas as rotas **e** no WebSocket (com
   `Origin`), só `CLAUDE_BIN` com argumentos fixos, pastas só em `ALLOWED_ROOTS`, `127.0.0.1` por omissão
   ([[docs/adr/0004-exposicao-e-modelo-de-ameaca]]).
4. **Nenhuma persistência fora do modelo** — decide-se com `/design-database` (a partir de
   [[docs/product/domain-brief]]), que pode concluir que não há base de dados.
5. **⛔ O design ainda não foi escolhido. Nenhum ecrã antes de `/choose-design`** — os tokens são
   provisórios, e UI construída sobre eles é refeita. Tarefas de backend podem avançar.
6. **Uma tarefa só está feita depois de testada a sério** — ver [[testing-and-verification]].
7. **Decisão estrutural nova = ADR novo**; ADRs antigos não se editam.
8. **Nunca editar o backend a partir de um terminal servido por ele próprio em `npm run dev`** — o
   reinício do watch mata essa sessão (e todos os terminais). Ver [[docs/commands]] → "Desenvolver a app
   a partir dela própria".

## Fluxo de trabalho

`notes/ideas.md` → `notes/ToDo.md` → `notes/roadmap/plans/` → `notes/whatIveDone.md`.
A skill `/implement-todo` percorre este ciclo. Ver [[notes/README]].
