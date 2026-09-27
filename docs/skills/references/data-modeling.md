# Modelação de dados e migrações

**When to use**: antes de criar ou alterar uma tabela.

---

## Planear antes de escrever (copiar e preencher)

```markdown
## Planning: <table_name>
1. O que representa? (1-2 frases)
2. Quem cria/edita?  [ ] admin  [ ] admin + utilizador  [ ] self-service  [ ] sistema
3. Quem lê?          [ ] admin  [ ] admin + utilizador  [ ] qualquer autenticado  [ ] público
4. Pertence a um tenant/entidade-mãe? (FK + o que acontece ao apagar a mãe)
5. Relações (FKs)
6. Campos: nome, tipo, NOT NULL, default
7. Soft-delete? (dados importantes que não devem desaparecer)
8. Próximo número de migração
```

## Regras

1. **Toda a tabela tem** `id` (UUID gerado pela BD), `created_at` e `updated_at` (com trigger ou
   equivalente). O ORM mapeia os timestamps como **não inseríveis/não atualizáveis** — um
   mapeamento simples faz o ORM enviar `null` explícito, o `DEFAULT now()` nunca se aplica e o
   INSERT morre no `NOT NULL`. Testes com repositórios mockados nunca apanham isto; já chegou ao
   browser duas vezes.
2. **Migrações são imutáveis.** Uma migração aplicada nunca se edita — corrige-se com uma nova.
   Numeração sequencial, nome descritivo (`V12__add_order_table.sql`).
3. **FKs com política explícita**: `on delete cascade` para filhos que não fazem sentido sozinhos,
   `set null` para referências opcionais, `restrict` quando apagar deve ser bloqueado.
4. **Índices para colunas usadas em `WHERE` e `JOIN`**, e índice parcial para "só ativos" com
   soft-delete (`where deleted_at is null`).
5. **Soft-delete** (`deleted_at`) para dados de negócio que não devem desaparecer; todas as queries
   filtram `deleted_at is null`. Unicidade com soft-delete é parcial (só entre vivos).
6. **Enums guardados como texto** (`STRING`), nunca como ordinal.
7. **Ficheiros nunca na BD** — guarda-se `bucket` + `storage_key` (padrão `file-storage` do Workflow — não incluído, sem ficheiros).
8. **Relações lazy por omissão** — evita N+1. Árvores e listas grandes carregam-se com uma query
   pensada, não navegando relações em ciclo.
9. **Nenhuma regra de negócio em SQL** (funções, triggers de negócio, RLS com lógica) quando o
   backend é a fonte de verdade — ver [[security|backend como fonte de verdade]].
10. **"Pode vir um segundo?"** — antes de meter um campo de ficheiro/contacto/morada dentro da
    entidade "para já", perguntar se pode haver dois. Se sim, tabela própria desde o início.

## Padrões comuns

```sql
-- Árvore (auto-referenciada)
create table node (id uuid primary key, parent_id uuid references node(id) on delete cascade);

-- Muitos-para-muitos
create table order_tag (
  order_id uuid not null references orders(id) on delete cascade,
  tag_id   uuid not null references tag(id)    on delete cascade,
  primary key (order_id, tag_id)
);

-- Histórico
create table order_history (
  id bigserial primary key, order_id uuid not null references orders(id),
  changed_at timestamptz default now(), changed_by uuid,
  change_type text, old_value jsonb, new_value jsonb
);
```

## Migrações e ambientes — armadilhas

- **Testes de contexto completo ligam à BD configurada** e aplicam migrações pendentes. Se a BD
  configurada é a real, um `test` escreve em produção. Excluir esses testes da suite por omissão.
- **Hot-reload + migrações**: ferramentas que reiniciam a app a cada compilação aplicam migrações
  no primeiro compile, não quando se decide arrancar. Uma migração entrou na BD real duas horas
  antes de alguém a mandar entrar.
- **Documentar cada tabela nova** em `docs/database.md` no mesmo commit; o hook verifica que o
  intervalo de migrações citado nos docs está atualizado.

## Relacionado

[[api-design]] · [[security-baseline]] · padrão `multi-tenancy-shared-schema` do Workflow — não incluído
