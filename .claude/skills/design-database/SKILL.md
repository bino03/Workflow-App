---
name: design-database
description: Desenhar (ou evoluir) o modelo de dados inteiro do Workflow App antes de criar tabelas — partir do domain brief escrito na criação do projeto, entrevista entidade a entidade (campos, obrigatórios, dono, quem lê/escreve, soft-delete, ficheiros, histórico) e relação a relação (cardinalidade, on delete, tabelas de junção), e depois escrever o modelo com um diagrama ER em Mermaid em docs/database.md, um ADR com as decisões de modelação, a ordem das migrações, e uma tarefa no ToDo por tabela, a executar com add-database-table. Usar antes de qualquer CRUD no backend, ou quando o domínio cresce (modo evoluir).
---

Before writing code, read `${CLAUDE_PROJECT_DIR}/docs/skills/references/data-modeling.md`, `${CLAUDE_PROJECT_DIR}/docs/skills/references/project-vocabulary.md`. Then read `${CLAUDE_PROJECT_DIR}/docs/skills/process/skill-design-database.md` in full and follow it step by step.

If asked to update this checklist, edit the vault file above, not this pointer.
