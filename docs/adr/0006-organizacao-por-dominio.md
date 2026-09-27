---
tags: [adr]
status: aceite
data: 2026-09-27
---

# 0006 — Backend organizado por domínio

## Contexto

Padrão `packages-by-domain` do Workflow, pensado para Spring (pacotes com `controller/service/repository`
por domínio). Aqui o backend é Node e quase não tem CRUD: os domínios são terminais, sessões gravadas,
biblioteca, quota e auth.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **Por domínio (escolhida)** | Uma feature = uma pasta; segue o padrão do Workflow | — |
| Por camada técnica (`routes/`, `services/`) | Familiar em Express | Cada feature toca pastas distantes |

## Decisão

`src/<domain>/` com os ficheiros de que esse domínio precisa (`<domain>.routes.ts`, `<domain>Service.ts`,
`<domain>.schemas.ts`, …) e `src/common/` para o transversal (erros, guarda de auth, configuração). Um
domínio usa outro pelo serviço, nunca pelos internos. O frontend segue o mesmo corte
(`components/<domain>/`, `services/<domain>Service.ts`, `types/<domain>.ts`).

## Consequências

- Uma feature nova é uma pasta nova — o `code-map.md` ganha uma linha.
- O nome exato dos ficheiros fixa-se no scaffold e escreve-se em [[../backend-conventions]].

## Estado

`aceite`
