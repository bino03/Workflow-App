---
tags: [adr]
status: aceite
data: 2026-10-27
---

# 0023 — O projeto nasce da candidatura inteira; o acordo é opcional; o menu da lista só avança o estado

**Data**: 2026-10-27 · **Estado**: `aceite` · **Decidido com**: o dono, ao pedir o menu de contexto da lista
Upwork

Altera o ponto 7 do [[0022-seccao-upwork]] (o que vai no brief, e o acordo obrigatório) e acrescenta-lhe uma
regra de interface sem mexer no ponto 6 (o estado continua manual e livre).

## Contexto

O dono pediu (2026-10-27) um menu de contexto em cada candidatura da lista: mudar o estado "apenas para o
seguinte", com confirmação, e, numa candidatura ganha, **Novo projeto** a chamar o `/create` "e passar logo o
contexto todo do que tem que fazer".

Pelo [[0022-seccao-upwork]], o brief do `/create` era anúncio + carta enviada + plano técnico + **acordo colado**
(obrigatório). Mas, com a secção em uso, a negociação vive na **conversa** da candidatura: o dono cola lá as
mensagens do cliente e o Claude propõe as respostas. O brief deixava isso de fora, e as perguntas ao cliente e
as notas do separador Dados também. Obrigar a colar um acordo repetia, por outras palavras, o que já estava na
conversa.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **Brief com a candidatura inteira, acordo opcional no modal (escolhida)** | O `/create` recebe o que foi combinado sem o dono o reescrever; o acordo continua lá para o que não passou pela app | Um brief maior; a conversa traz ruído ("mais curta") |
| Criar direto, sem modal | Um clique | Sem sítio para o acordo que só existe fora da app (a oferta na Upwork) |
| Como estava (acordo obrigatório, sem a conversa) | Nada muda | O dono reescreve a negociação; o contexto fica a meio |
| Validar as transições no backend ("só o seguinte" em toda a app) | Um percurso sempre limpo | Um engano deixa de ter volta; a app não vê a Upwork (o cliente pode fazer oferta sem entrevista) — contradiz o ponto 6 do 0022 |

## Decisão

1. **O brief leva a candidatura inteira**, por esta ordem: anúncio, carta enviada, plano técnico, perguntas ao
   cliente, **a conversa** (as mensagens de texto do dono e do Claude depois do pacote, lidas do `.jsonl` pelo
   mesmo feed da UI), **as notas** do dono e o acordo. Acima de 60 000 caracteres a conversa cede primeiro, das
   mensagens mais antigas para as mais recentes (as últimas estão mais perto do que se combinou), e só depois a
   carta, o plano e as perguntas. O anúncio, as notas e o acordo têm limite à entrada e ficam inteiros.
2. **O acordo é opcional** (`POST …/:id/project` aceita `{agreement}` vazio, ausente ou até 20 000; vazio → `null`).
   O modal continua a existir, a explicar o que vai no brief, para o acordo que só existe fora da app.
3. **O menu de contexto da lista só oferece o passo seguinte** do percurso (`draft → sent → interview → offer →
   won`) e as saídas (`lost`, `withdrawn`; um rascunho só pode ser retirado), cada um com confirmação que diz o
   efeito. **O estado continua livre no separador Dados e no backend** (ponto 6 do 0022 intacto): o menu é o
   atalho do dia a dia, os Dados corrigem um engano.

## Consequências

- O `/create` de um projeto ganho começa com a negociação à mão, sem o dono a resumir.
- Uma sessão já apagada (arquivada) ou ilegível dá conversa vazia e o projeto começa na mesma.
- O brief cresce; o limite de 60 000 e o corte por partes protegem o `CreationService`.
- O `projectBrief` (`backend/src/upwork/upworkFiles.ts`) passa a ter sete partes; os testes cobrem a ordem e os
  dois cortes.

## Estado

`aceite` — 2026-10-27.
