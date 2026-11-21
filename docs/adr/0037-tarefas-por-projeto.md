---
tags: [adr]
status: aceite
data: 2026-11-21
---

# 0037 — Tarefas por projeto: coleção `projectTasks` no `state.json`, "Desfazer" em vez de confirmação, `Alt+K`

**Data**: 2026-11-21 · **Estado**: `aceite` · **Decidido com**: o dono, na fase 4 do plano da moldura tipo IDE
([[0036-moldura-tipo-ide-e-seletor-de-projeto]]) e no `/design-database` em modo evoluir. Acrescenta uma
coleção ao [[0009-estado-em-ficheiro-json]] e uma exceção à regra "toda a ação destrutiva passa por confirmação"
([[../skills/references/design/buttons-and-icons]]).

## Contexto

A proposta C do canvas do Claude Design tem um painel de tarefas à direita (300 px, recolhível), aberto por um
botão "☑ n/total" no cabeçalho do projeto na lateral. O dono quer uma lista **pessoal**, só para se guiar
enquanto trabalha num projeto. **Não tem nada a ver com o vault** (`notes/ToDo.md`): a app não lê nem escreve
lá. Com a lista é possível adicionar uma tarefa, marcá-la como feita e apagá-la, e há filtros Por fazer, Feitas
e Todas.

## Decisões

1. **Coleção própria `projectTasks`, ao nível de topo do `state.json`**: `{id, projectPath, text ≤ 200, done,
   doneAt, createdAt}`. Entrou com `.default([])`, por isso o `STATE_VERSION` não mudou. A alternativa era um
   campo `tasks` dentro de `projectInfos` (ADR 0028), recusada por duas razões: a ficha só existe para projetos
   do registo e grava-se inteira pelo formulário (um `PUT` da ficha podia apagar tarefas), e uma pasta fora do
   registo também tem lateral e, portanto, tarefas.
2. **`projectPath` é uma referência fraca**, como nas `projectInfos`. É o caminho resolvido que a lateral usa
   (`resolveAllowedPath`, dentro de `ALLOWED_ROOTS`). Se o projeto sair do registo, as tarefas ficam no
   ficheiro sem aparecer em lado nenhum. Voltam se o projeto voltar.
3. **A ordem é a de criação, ascendente**: uma tarefa nova entra no fundo da lista. Não se reordena arrastando
   (o dono preferiu a versão simples). Marcar uma tarefa como feita não a muda de sítio, e quem decide o que se
   vê são os filtros.
4. **Apagar é definitivo (hard delete) e não pede confirmação: mostra "Desfazer" durante uns segundos.** O
   "Desfazer" volta a criar a tarefa com o mesmo `id`, `createdAt`, `done` e `doneAt`, por isso ela volta ao
   mesmo sítio. É uma exceção à regra das ações destrutivas, aceite porque a perda é pequena (uma linha de
   texto que o próprio dono escreveu), é imediatamente reversível, e um diálogo por cada linha tornava a lista
   lenta de limpar.
5. **Limite de 200 tarefas por projeto.** A 201.ª é recusada com um erro próprio e nada se apaga sozinho, porque
   apagar texto do dono sem ele pedir não é aceitável. As feitas também contam.
6. **O estado aberto/fechado do painel é global e fica no browser** (`localStorage`), como a lateral escondida.
   Não vai ao `state.json`, porque é uma preferência do dispositivo e não um dado.
7. **O atalho é `Alt+K`, com a ação `toggleTasks`.** O `Alt+T` do protótipo é do Claude Code ("thinking"),
   como o `Alt+P` e o `Alt+V`.

## Consequências

- Há rotas novas em `/api/project-tasks`, todas com sessão ([[0004-exposicao-e-modelo-de-ameaca]]). O caminho
  passa sempre por `resolveAllowedPath`, por isso não se criam tarefas para pastas fora das raízes.
- Se uma pasta mudar de nome, as tarefas ficam com o caminho antigo, tal como as `projectInfos`.
- A exceção do ponto 4 fica escrita junto da regra, para não se tornar precedente sem decisão.
