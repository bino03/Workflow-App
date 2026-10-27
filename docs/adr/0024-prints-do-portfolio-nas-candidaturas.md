---
tags: [adr]
status: aceite
data: 2026-10-27
---

# 0024 — Os prints a anexar vêm do portfólio, lidos pela app só para leitura

**Data**: 2026-10-27 · **Estado**: `aceite` · **Decidido com**: o dono, ao pedir que a carta viesse com os prints
dos projetos escolhidos

Complementa o [[0022-seccao-upwork]] (o pacote) sem mudar o `package.json`. Do lado do Workflow: adenda ao ADR 0012
e o Step 2b do `/upwork-proposal`.

## Contexto

O dono anexa às propostas da Upwork prints das suas apps e pediu (2026-10-27) que, na mesma candidatura, ficassem
"selecionados certos projetos que eu já fiz e […] colocadas as várias prints" — no mesmo estilo dos prints do
portfólio.

Os prints já existem num sítio: o projeto **PortFolio - Frontend** guarda-os em `public/images/projects/<slug>/`, e
agora cada pasta tem um catálogo `screenshots.json` (título PT/EN, descrição factual em inglês, a forma da solução
que o ecrã prova, e os prints `excluded` com a razão — dados reais, dados de teste). O `/upwork-proposal` escolhe
3-6 desses prints e escreve `attachments.json` na pasta da sessão (`slug`, `file`, `uploadName`, `caption`).

A app tem de os mostrar e de os entregar ao dono para ele os carregar na Upwork — à mão, como tudo o que vai para a
Upwork ([[0022-seccao-upwork]]).

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **A app serve as imagens a partir do portfólio (`PORTFOLIO_PATH`), por posição no `attachments.json` (escolhida)** | Uma cópia só de cada print (a revista); o cliente do browser nunca dá um caminho; o arquivo guarda só a lista | Uma pasta nova lida pelo backend; os prints mudam se o portfólio mudar |
| A skill copia as imagens para a pasta da sessão | A candidatura fica com as imagens que tinha | Na app, cada cópia é um comando de shell (cartão de permissão); imagens duplicadas por candidatura; a skill a escrever binários |
| Subir o `package.json` para `version: 2` com os prints | Um manifesto só | O `packageReader` exige `version: 1` — partia a app antes de ela saber ler prints |

## Decisão

1. **`attachments.json` à parte**, ao lado do pacote, com a sua própria `version: 1`. O `package.json` não muda. A
   app lê-o se existir (`upwork/attachmentsReader.ts`); inválido → `attachmentsError`, e o pacote lê-se na mesma.
2. **`PORTFOLIO_PATH`** (opcional) no `backend/.env`. A app lê **só** `PORTFOLIO_PATH/public/images/projects/`, e só
   imagens (`.png`, `.jpg`, `.jpeg`, `.webp`). Sem a variável, o cartão mostra a lista e as legendas, sem imagens.
3. **`GET /api/upwork/applications/:id/attachments/:index`** — o print pela **posição** na lista (0–9); o caminho vem
   do ficheiro da skill, nunca do pedido. `slug` e `file` validados (sem pastas, `..`, drive ou ponto inicial), e o
   ficheiro resolvido com `realpath` tem de ficar dentro da pasta de imagens (uma junction não leva para fora).
   `?download=1` → `Content-Disposition: attachment` com o `uploadName` (ASCII kebab-case, validado), que é o nome
   que o cliente vê na Upwork; sem ele, `inline` (a miniatura). Sessão obrigatória, como todas as rotas.
4. **Arquivar copia também o `attachments.json`** para `applications/<id>/package/`: a candidatura arquivada continua
   a mostrar o que foi anexado (as imagens continuam a vir do portfólio).
5. **Cartão "Prints a anexar"** no separador Pacote, logo a seguir à carta: miniaturas 16:9, legenda com **Copiar**,
   **Descarregar** com o nome para a Upwork, **Copiar legendas** (todas, numeradas) e os projetos sem prints
   (`missing`). Nada é enviado à Upwork.

## Consequências

- O backend passa a ler uma terceira árvore além de `ALLOWED_ROOTS` e `WORKFLOW_PATH` — só leitura, só imagens, só
  numa subpasta, e por índice. Entra em [[../security]].
- O `attachments.json` e o `screenshots.json` (do portfólio) são interfaces com consumidores em código: mudar a forma
  → subir a `version` e avisar o Workflow e o portfólio.
- Um print recapturado no portfólio muda o que uma candidatura antiga mostra. Aceite: o que se enviou à Upwork é o
  ficheiro que o dono descarregou na altura.

## Estado

`aceite` — 2026-10-27.
