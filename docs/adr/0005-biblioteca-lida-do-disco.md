---
tags: [adr]
status: aceite
data: 2026-09-27
---

# 0005 — A biblioteca do Workflow é lida do disco, só leitura

## Contexto

O MVP inclui "navegar o registo da biblioteca do Workflow (stacks, designs, skills, maturidade) lido a
partir de `library/`". O Workflow tem a pergunta em aberto "o vault continua a ser a fonte de verdade?"
(`docs/vision.md` do Workflow). No Workflow, stacks e designs são módulos de forma fixa com manifesto em
frontmatter (`STACK.md`, `THEME.md`), precisamente para uma interface os poder listar sem nomes escritos
no código (ADR 0002 do Workflow).

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **Ler os manifestos (frontmatter) do disco, só leitura (escolhida)** | O vault continua a ser a fonte de verdade; zero sincronização; forma fixa já garantida pelo Workflow | Depende do caminho do Workflow na máquina; um manifesto mal formado tem de ser tolerado |
| Ler as tabelas dos `README.md` de registo | Uma leitura por tipo | Tabelas Markdown são para humanos — frágeis de parsear |
| Importar para uma BD da app | Pesquisa rica | Duas cópias do mesmo facto divergem |

## Decisão

O backend lê `WORKFLOW_PATH/library` a pedido: `stacks/*/STACK.md`, `frontend/themes/*/THEME.md`,
`skills/**/skill-*.md` e `stacks/*/skills/skill-*.md`, e devolve o frontmatter (id, nome, camada,
maturidade/status, `applies-when`, proveniência, caminho). **Nunca escreve** no Workflow. Pastas que
começam por `_` (`_TEMPLATE`) são ignoradas. Um ficheiro com frontmatter inválido aparece como erro na
lista, não derruba o pedido.

## Consequências

- No desktop de casa, o Workflow tem de estar lá (clone) e `WORKFLOW_PATH` a apontar para ele.
- Escrever na biblioteca pela app (lançar `/add-stack`, `/create`) faz-se **pelos terminais**, com as
  skills do Workflow — não por endpoints da app. Se um dia a app escrever diretamente, ADR novo.
- Se o Workflow mudar a forma dos manifestos, este módulo muda com ele.

## Estado

`aceite`
