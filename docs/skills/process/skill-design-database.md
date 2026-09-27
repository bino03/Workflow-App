# Skill: Design Database — desenhar o modelo de dados inteiro

**When to use**: antes do primeiro CRUD (o ToDo tem "⛔ Desenhar o modelo de dados"), ou quando o domínio
cresce e o modelo tem de evoluir.

**Time**: ~30-60 min (modelo inicial) · ~15-30 min (evoluir)

> 📐 Lê primeiro [[data-modeling]] e [[project-vocabulary]].

> **Esta skill pensa; não cria tabelas.** O resultado é um modelo decidido e um plano. Cada tabela nasce
> depois com `add-database-table` (não incluída — backend 📋 sem skills), pela ordem que esta skill deixa no ToDo. Porquê separado: uma
> tabela pensada sozinha esquece relações e dono; o modelo pensado de uma vez apanha-os.

---

## Visão geral

```
Step 0  Modo e contexto            ← ler o brief de domínio e o que já existe
Step 1  Entidades                  ← confirmar a lista; MVP vs. depois
Step 2  Entrevista por entidade    ← em blocos, com defaults propostos
Step 3  Relações                   ← cardinalidade, on delete, tabelas de junção
Step 4  Revisão do modelo          ← diagrama + verificações → CONFIRMAR
Step 5  Escrever                   ← database.md, ADR, ordem das migrações, ToDo
```

**Regras de ouro**
- **Não inventar requisitos de negócio.** Propor defaults técnicos ("assumo `created_at`/`updated_at` e
  soft-delete, confirmas?"), mas as regras do domínio perguntam-se. O que não se sabe fica em "Perguntas
  em aberto", e a tabela afetada fica com ⚠️ no ToDo.
- **Perguntar em blocos** — uma mensagem por grupo de 2-4 entidades, não uma pergunta de cada vez.
- **Nada se escreve antes da confirmação do Step 4.**

## Step 0: Modo e contexto

Ler, para não perguntar o que já está escrito:
1. **`docs/product/domain-brief.md`** — o contexto de dados que a entrevista de criação recolheu: entidades
   com a descrição nas palavras do utilizador, relações ditas, quem cria/vê o quê, ficheiros, ecrãs que
   mostram cada entidade, o que é MVP, perguntas de dados em aberto. **É o ponto de partida.**
2. `docs/product/overview.md`, `use-cases.md`, [[project-vocabulary]].
3. `docs/database.md` e as migrações existentes (`backend/…/db/migration/`).
4. `docs/security.md` (roles) e as ADRs.

**Modo**:
- `docs/database.md` ainda só tem o esboço → **modelo inicial**.
- Já tem modelo e migrações → **evoluir**: perguntar o que mudou no domínio; só se desenham as entidades
  novas/alteradas, e **nunca se editam migrações aplicadas** — as mudanças são migrações novas.

## Step 1: Entidades

Mostrar a lista do brief (conceito PT → identificador EN, descrição) e perguntar, em bloco:
- Falta alguma? Alguma sobra ou são duas coisas diferentes com o mesmo nome?
- Quais entram no **MVP** e quais ficam para depois? (as de depois ficam no modelo como "futuras", sem
  tarefa no ToDo)
- Há "coisas" que parecem entidades mas são só um campo ou um estado? (ex.: "encomenda paga" = estado)

Atualizar [[project-vocabulary]] se algum nome mudou.

## Step 2: Entrevista por entidade

Para cada entidade do MVP, propor uma ficha **já preenchida com o que o brief e os ecrãs sugerem**, e pedir
só correções:

```markdown
### <Entidade> (`<table_name>`)
O que representa: <1 frase>
Campos:            nome · tipo · obrigatório? · default · nota
                   (id, created_at, updated_at já assumidos)
Dono / pertença:   <entidade-mãe, tenant, utilizador criador (created_by)?>
Quem cria/edita:   <roles>          Quem lê: <roles>
Campos sensíveis:  <só certas roles veem?>
Estado/ciclo:      <enum de estados e transições, se houver>
Apagar:            soft-delete (deleted_at) · hard delete · bloqueado se tiver filhos
Ficheiros:         nenhum · 0..1 (colunas) · 0..N (tabela própria)
Histórico:         só estado atual · tabela de histórico
Unicidade:         <o que não se pode repetir, e em que âmbito>
Pesquisa/listas:   <por que campos se filtra/ordena — dá os índices>
```

Perguntas que se fazem sempre (é onde os erros custam mais):
- **"Pode vir um segundo?"** — para cada campo de ficheiro, contacto, morada ou valor: pode haver mais do
  que um? Se sim, tabela própria desde já.
- **Obrigatório de verdade?** — o que é `NOT NULL` na BD é obrigatório em todo o lado (DTO, formulário).
- **Números com dinheiro** — `numeric(12,2)` (ou equivalente), nunca float.
- **Datas** — com fuso (`timestamptz`) quando é um instante; `date` quando é um dia.
- **Estados** — como texto (enum da app), nunca ordinal.

## Step 3: Relações

Uma tabela para rever de uma vez:

| De | Para | Cardinalidade | Obrigatória? | Ao apagar o "Para" | Nota |
|---|---|---|---|---|---|
| order_item | order | N:1 | sim | cascade | não existe sem a encomenda |
| order | customer | N:1 | não | set null | a encomenda fica no histórico |
| order ↔ tag | | N:M | | | tabela `order_tag` |

- N:M → tabela de junção (com chave composta, ou com `id` se a relação tem atributos próprios).
- Árvores → auto-referência com `parent_id`.

## Step 4: Revisão do modelo

Mostrar:
1. **Diagrama ER em Mermaid**:
   ````markdown
   ```mermaid
   erDiagram
     CUSTOMER ||--o{ ORDER : "faz"
     ORDER ||--|{ ORDER_ITEM : "tem"
   ```
   ````
2. **Verificações automáticas** (dizer o resultado de cada uma):
   - toda a entidade tem dono/pertença definido (ou é global, dito);
   - toda a FK tem política de `on delete`;
   - todo o campo de lista/pesquisa tem índice previsto;
   - nenhuma regra de negócio ficou para SQL/trigger/RLS ([[data-modeling]] regra 9);
   - nenhum ficheiro guardado na BD (só `bucket` + `storage_key`);
   - campos sensíveis identificados (vão para a visibilidade por role do DTO).
3. **Ordem das migrações** — ordenação topológica pelas FKs (pais antes de filhos; tabelas de junção no fim).
4. **Perguntas em aberto** que sobraram.

`AskUserQuestion`: **Confirmar o modelo** · **Mudar alguma coisa** (texto → volta ao step certo) ·
**Guardar como rascunho** (escreve com estado ❓ e não gera tarefas).

## Step 5: Escrever

1. **`docs/database.md`**:
   - topo: estado ✅ (modelo decidido, migrações por aplicar) e a data;
   - o diagrama Mermaid;
   - uma secção por tabela com a ficha do Step 2 (campos, dono, apagar, ficheiros, índices, unicidade) —
     é o que o `add-database-table` lê antes de escrever a migração;
   - a tabela de relações;
   - "Entidades futuras" (fora do MVP) e "Deixado de fora" com o porquê;
   - a linha do intervalo de migrações (continua "nenhuma" até à primeira).
2. **ADR** `docs/adr/NNNN-modelo-de-dados.md`: as decisões não óbvias (ex.: "ficheiros da encomenda em
   tabela própria porque pode haver vários"; "soft-delete em clientes por histórico") com as alternativas.
3. **`notes/ToDo.md`**: remover "⛔ Desenhar o modelo de dados"; criar uma secção **"Modelo de dados"**
   com uma tarefa por tabela, **pela ordem das migrações**:
   `- [ ] Tabela <table> — ver docs/database.md → <Entidade> · /add-database-table` (⚠️ se tem pergunta em aberto).
   Depois, por entidade do MVP, a tarefa de API: `- [ ] CRUD de <Entidade> · /add-backend-feature`.
4. **`docs/product/domain-brief.md`**: acrescentar no fim "✅ Modelo desenhado a AAAA-MM-DD — ver
   [[database]]" (o brief fica como registo do ponto de partida; não se reescreve).
5. **`docs/skills/references/project-vocabulary.md`**: nomes finais.
6. **`notes/whatIveDone.md`**: entrada nova.

No modo **evoluir**: acrescentar ao diagrama e às secções, ADR novo só se houver decisão estrutural, e tarefas
só para as tabelas/migrações novas (`ALTER` numa migração nova, nunca editar uma antiga).

## Final Checklist

- [ ] Modo decidido; brief de domínio, produto, vocabulário e BD existente lidos antes de perguntar
- [ ] Lista de entidades confirmada; MVP vs. futuras separado
- [ ] Ficha por entidade do MVP, com as perguntas obrigatórias ("pode vir um segundo?", dinheiro, datas, estados)
- [ ] Relações com cardinalidade e `on delete`; N:M com tabela de junção
- [ ] Diagrama + verificações mostrados; ordem das migrações; modelo **confirmado**
- [ ] `database.md` com diagrama, fichas, relações; ADR do modelo
- [ ] ToDo com uma tarefa por tabela pela ordem das migrações + tarefas de CRUD; ⛔ removido
- [ ] Brief marcado como "modelo desenhado"; vocabulário e work log atualizados
- [ ] Nenhum requisito de negócio inventado — o que falta está em "Perguntas em aberto"

## Related Skills

`add-database-table` (não incluída — backend 📋 sem skills) (executa cada tabela) · `add-backend-feature` (não incluída — backend 📋 sem skills) · [[data-modeling]]
