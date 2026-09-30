---
tags: [adr]
status: aceite
data: 2026-09-30
---

# ADR 0014 — Escrita controlada da app na biblioteca do Workflow

**Data**: 2026-09-30 · **Estado**: `aceite` · **Decidido com**: `/implement-todo` (passo 1 da spec
[[../features/upload-de-skills]])

Reverte **parcialmente** [[0005-biblioteca-lida-do-disco]]: a regra "nunca escreve" deixa de ser absoluta.
Tudo o resto do 0005 continua a valer — a leitura dos manifestos do disco, o vault como fonte de verdade,
as pastas `_*` ignoradas, o frontmatter inválido que aparece como erro em vez de derrubar o pedido.

## Contexto

O 0005 fechou a biblioteca à escrita e previu este dia por escrito: *"Escrever na biblioteca pela app
faz-se pelos terminais, com as skills do Workflow — não por endpoints da app. **Se um dia a app escrever
diretamente, ADR novo.**"*

O dono pediu (2026-09-29) "algo que me permitisse dar upload de skills, designs e stacks, que deve ir para
o vault e por sua vez aparecer na app". Hoje, para acrescentar uma skill já escrita a uma stack, tem de
abrir um terminal, lançar o `claude` na pasta do Workflow e mandá-lo escrever o ficheiro — para uma
operação que é copiar um ficheiro para uma pasta.

O que torna isto delicado não é o tamanho da operação: **o `WORKFLOW_PATH` não pertence a esta app**. É a
biblioteca partilhada por todos os projetos gerados pelo Workflow. Um ficheiro escrito no sítio errado, ou
um `STACK.md` corrompido, não estraga esta app — estraga a geração do próximo projeto, e o estrago só
aparece lá.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **Uma porta estreita e validada (escolhida)** | O caso real fica resolvido; a superfície de escrita cabe numa frase e é auditável; o resto da biblioteca continua imutável pela app | Não serve stacks nem designs; cada tipo novo obriga a reabrir esta decisão |
| Continuar só pelos terminais (manter o 0005 intacto) | Zero risco novo; nada a validar | Mantém o atrito que originou o pedido: um terminal e uma sessão do `claude` para copiar um ficheiro |
| Abrir escrita geral ao `WORKFLOW_PATH` (criar/editar/apagar qualquer ficheiro) | Uma só implementação serve stacks, designs, skills soltas e edições futuras | Um bug de caminho passa a poder escrever em qualquer sítio do vault do Workflow; a app deixa de ter um modelo de ameaça descritível ([[0004-exposicao-e-modelo-de-ameaca]]) |
| Escrever para uma pasta de staging e sincronizar à mão | Erro nunca toca na biblioteca real | Duas cópias do mesmo ficheiro e um passo manual — o atrito que se queria tirar volta noutro sítio |

## Decisão

A app passa a escrever no `WORKFLOW_PATH` **em exatamente dois sítios**, e em mais nenhum:

1. `library/stacks/<stackId>/skills/skill-<name>.md` — **criado**, nunca sobrescrito.
2. `library/stacks/<stackId>/STACK.md` — **só** o array `provides-skills` do frontmatter ganha `<name>`.
   O corpo Markdown e os restantes campos ficam byte-a-byte iguais.

Com estas condições, todas obrigatórias:

- **`<stackId>` nunca é concatenado num caminho.** Tem de ser um dos ids que o próprio
  `LibraryService` já descobriu ao varrer `library/stacks/` — um id que não está nessa lista é `404`, e o
  caminho é construído a partir da entrada encontrada, não do texto que veio do cliente. Path traversal
  fica impossível por construção, não por validação.
- **`<name>` vem do frontmatter do ficheiro, já validado como kebab-case** (`/^[a-z0-9]+(-[a-z0-9]+)*$/`),
  nunca do nome do ficheiro enviado. O cliente não escolhe onde o ficheiro aterra.
- **Validação antes de qualquer I/O de escrita**: o frontmatter tem de fazer `parse` no schema de skill.
  Inválido → `400`, disco intacto.
- **Sem overwrite**: se o ficheiro de destino já existe, `409`. Substituir uma skill continua a fazer-se
  pelos terminais.
- **Tamanho limitado a 256 KiB**, constante no código. Vazio ou maior → `400`.
- **Sessão obrigatória**, como todo o resto da API ([[0003-auth-utilizador-unico]]).
- **O `STACK.md` é melhor esforço**: se a skill já foi escrita e a atualização do `provides-skills` falha,
  fica um aviso no log e o pedido devolve sucesso. O campo é uma referência cruzada informativa — a
  listagem de skills lê a pasta, não o manifesto.

## Consequências

- **A Biblioteca deixa de ser "só leitura" na UI.** O texto do cabeçalho que o afirma tem de mudar, e o
  precedente de UX criado pelo drawer de upload conta para qualquer upload futuro.
- **Fica de fora, e continua a exigir os terminais**: stacks e designs completos (pastas com ficheiros
  obrigatórios), skills soltas sem stack (`library/skills/<categoria>/`), editar ou apagar o que já lá
  está. Alargar a porta a qualquer um destes é decisão estrutural nova → ADR novo, não uma spec.
- **`library/stacks/README.md` fica desatualizado.** A tabela "Registo" tem uma coluna "Skills" que esta
  escrita não toca — é prosa para humanos, e editá-la é bem mais frágil do que acrescentar a um array de
  frontmatter. Limitação conhecida e aceite: quem quiser a tabela certa corrige-a à mão.
- **Um erro aqui manifesta-se noutro projeto**, não neste. Por isso o teste manual desta feature usa uma
  stack de baixo risco e limpa o que escreveu.
- Se o Workflow mudar a forma do `STACK.md` (o nome do campo, ou deixar de usar frontmatter), esta escrita
  parte-se com ele — como já acontece com a leitura (consequência herdada do 0005).

## Estado

`aceite`
