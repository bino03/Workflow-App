---
tags: [adr]
status: aceite
data: 2026-10-27
---

# 0025 — Preparar anexos: os prints numa pasta da candidatura, abertos no Explorador

**Data**: 2026-10-27 · **Estado**: `aceite` · **Decidido com**: o dono, ao perguntar como levar os prints recomendados
para a Upwork (zip, abrir pasta…)

Complementa o [[0024-prints-do-portfolio-nas-candidaturas]].

## Contexto

Com o [[0024-prints-do-portfolio-nas-candidaturas]], cada print descarrega-se sozinho, com o nome para a Upwork. São
3-6 por candidatura: um clique por print, e depois procurá-los nos Downloads. O dono pediu uma forma melhor de os ter
à mão quando preenche a proposta.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **Copiar para `applications/<id>/anexos/` e abrir a pasta no Explorador (escolhida)** | Um clique e um arrasto (Ctrl+A → zona de anexos da Upwork); a pasta fica como registo do que foi enviado (um print recapturado no portfólio já não muda o passado) | Abrir o Explorador só serve na máquina do backend; um processo novo (`explorer.exe`) |
| Descarregar todos (um download por print) | Funciona de outra máquina | O Chrome pergunta pelos vários downloads; procurá-los nos Downloads |
| Zip com todos | Um ficheiro | A Upwork recebe ficheiros soltos: descompactar antes, ou o cliente a abrir um zip para ver imagens |
| Arrastar da app diretamente para a Upwork | Zero passos | Arrastar uma imagem entre sites entrega muitas vezes o link e não o ficheiro — não é fiável |

## Decisão

1. **`POST /api/upwork/applications/:id/attachments/prepare`** — esvazia `DATA_DIR/upwork/applications/<id>/anexos/`
   e copia para lá cada print do `attachments.json` que está no portfólio, com o `uploadName` (o mesmo caminho seguro do
   [[0024-prints-do-portfolio-nas-candidaturas]]); dois com o mesmo nome → fica o primeiro. Devolve
   `{folder, files, skipped, opened}`. Nada para copiar → `UPWORK_007`.
2. **Abrir no Explorador**: `explorer.exe` com **um** argumento fixo — a pasta que o próprio backend criou, nunca um
   caminho do pedido —, sem shell, destacado (`common/openFolder.ts`). Ligado por `OPEN_FOLDERS` (omissão `true`); as
   instâncias de verificação põem `false`, e os testes nunca o recebem (`buildApp` sem `openFolder`).
3. **Na UI**: botão **Preparar anexos** no cartão "Prints a anexar"; depois, uma faixa com o próximo passo ("seleciona
   os N e arrasta-os para os anexos da proposta"), o caminho com **Copiar caminho** e os que ficaram de fora. Sem
   Explorador (outra máquina, `OPEN_FOLDERS=false`) a faixa diz onde está a pasta.
4. A pasta vive com o registo: **Apagar** a candidatura leva-a; **Arquivar** mantém-na.

## Consequências

- Um segundo processo além do `claude` (e do `git`/`tailscale` já existentes): só `explorer.exe`, argumento fixo. Entra
  em [[../security]].
- Usada de fora da máquina (Tailscale), a pasta prepara-se na mesma mas abre-se no ecrã do servidor — a faixa mostra o
  caminho; para esse caso ficam os downloads individuais.

## Estado

`aceite` — 2026-10-27. Os pontos 2 (quando abre o Explorador) e 3 (o botão) foram alterados por
[[0026-anexos-a-partir-de-outro-dispositivo]] no mesmo dia.
