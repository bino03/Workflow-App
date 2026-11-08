---
tags: [adr]
status: aceite
data: 2026-11-08
---

# 0028 — Informação de deploy por projeto: uma coleção nova no `state.json`, ligada pelo caminho

**Data**: 2026-11-08 · **Estado**: `aceite` · **Decidido com**: o dono, na entrevista de
[[../features/informacao-dos-projetos]] — "guardar estados e informações sobre cada aplicação: onde está
alocado, qual é o URL, quando é que o deploy foi dado".

## Contexto

A app conhece os projetos pelo registo do Workflow (`projects/INDEX.md`), que é **só leitura**
([[0005-biblioteca-lida-do-disco]]) e é "para saber onde está cada projeto", não o que lhe aconteceu. O dono
quer, por projeto: ciclo de vida, ambientes (produção, staging…) com URL, hosting e histórico de deploys,
código e infra, operação e notas. Dados pequenos (8 projetos), um só utilizador, um só escritor.

## Opções

| Opção | Prós | Contras |
|---|---|---|
| **Coleção `projectInfos` no `state.json` (escolhida)** | Mesmo mecanismo de [[0009-estado-em-ficheiro-json]]; edita-se na UI; nada escrito em pastas de projetos nem no Workflow | Fica só nesta máquina (fora do git); a ligação é o caminho, e mudar a pasta de sítio perde-a |
| Ficheiro dentro de cada projeto (`deploy.md`) | Viaja com o repo, o Claude lê-o | A app passa a escrever em pastas de projetos — superfície nova no [[0004-exposicao-e-modelo-de-ameaca]] |
| Escrever no `projects/INDEX.md` | Um sítio só | Quebra a postura só-leitura do ADR 0005; o ficheiro é escrito pelo `/create` do Workflow |
| Base de dados | — | Rejeitada em ADR 0009; nada mudou |

## Decisão

1. **`state.json` ganha `projectInfos`** — lista de `{projectPath, …}`, `projectPath` único, o caminho
   absoluto que o `GET /api/projects` devolve. Chega com `.default([])`, **sem subir o `STATE_VERSION`**
   (mesmo precedente de `accounts`, [[0027-varias-contas-do-claude]]).
2. **Só entram dados de projetos que o registo mostra.** Escrever para um caminho que não está na lista de
   `GET /api/projects` é `PROJECT_001`. Informação de um projeto que depois saiu do registo fica no ficheiro
   mas não aparece (nunca se apaga sozinha).
3. **Nenhum segredo.** O campo é texto livre mas a UI avisa e não há campos de password/token; credenciais
   continuam fora da app.
4. **A app nunca faz pedidos aos URLs guardados** nesta fase (sem ping de estado, sem ler a data do deploy do
   hosting). São dados e ligações. Um ping seria o backend a ir buscar URLs escritos pelo utilizador (SSRF) —
   fica para um ADR próprio se for pedido.
5. **URLs só `http:`/`https:`**, validados no backend (zod) e abertos com `rel="noopener noreferrer"`; um
   `javascript:` ou `file:` nunca é guardado.
6. **Histórico de deploys manual**, por ambiente, os 20 mais recentes; o "último deploy" deriva-se, não se
   guarda.

## Consequências

- Sem backup automático além do que o `DATA_DIR` já tenha ([[../operations]]); se o `state.json` se perde,
  perde-se isto. Exportar para o vault de cada projeto fica como segunda fase.
- Renomear/mover a pasta de um projeto desliga a informação (a chave é o caminho). Aceite: acontece raramente
  e o registo do Workflow também usa o caminho.
- Esta coleção engorda o `state.json` (no máximo ~8 projetos × 5 ambientes × 20 deploys): continua pequeno.

## Relacionado

[[0009-estado-em-ficheiro-json]] · [[0005-biblioteca-lida-do-disco]] · [[0004-exposicao-e-modelo-de-ameaca]] ·
[[../database]] · [[../features/informacao-dos-projetos]]
