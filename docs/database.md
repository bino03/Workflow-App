# 🗄️ Base de dados

> ⛔ **Modelo por desenhar.** Correr `/design-database` antes de qualquer tabela de negócio — parte do
> [[product/domain-brief]], que já tem o contexto de dados recolhido na criação do projeto.
> Migrações: nenhuma (atualizar esta linha a cada migração — o hook verifica).

Motor, schema e pasta das migrações: ❓ por decidir no `/design-database` (pode não haver BD).

## Entidades previstas

Da entrevista (o nome no código em inglês, o conceito em português):

| Conceito (PT) | No código (EN) | Estado |
|---|---|---|
| Terminal / sessão aberta | `Terminal` | proposta — processo `claude` num PTY, vive em memória |
| Sessão gravada do Claude Code | `ClaudeSession` | proposta — lida de `~/.claude/projects/`, não é da app |
| Entrada da biblioteca (stack, design, skill) | `LibraryEntry` (`kind`: `stack` · `theme` · `skill`) | proposta — só leitura, de `library/` |
| Quota / uso | `UsageSnapshot` | proposta — fonte por decidir |
| Projeto | `Project` | ❓ talvez (painel de projetos é ideia, não MVP) |

> A6: "aqui ainda não sei, decido mais tarde" — **nenhuma destas está confirmada**. O `/design-database`
> decide, e pode concluir que não há base de dados.

> Um esboço, não um schema. O modelo inteiro (ou a conclusão de que não há BD) decide-se com
> [[skill-design-database]]. A stack de backend é 📋 e não tem skill de "acrescentar tabela" — se houver
> BD, a primeira tabela é o momento de a criar (`/create-new-skill`).

## Tabelas

_(Uma secção por tabela, à medida que as migrações entram: o que representa, colunas relevantes,
relações, e a migração que a criou.)_

## Convenções

> ❓ Ainda não se sabe se há base de dados ([[product/domain-brief]] → perguntas em aberto). Se o
> `/design-database` concluir que há, as regras são as de [[data-modeling]]; o motor (SQLite, ficheiro,
> Postgres) e a biblioteca de acesso decidem-se lá, com ADR, e esta secção passa a ter as regras
> concretas.

Se a conclusão for "sem BD", esta página passa a dizer isso e o que vive onde:
- terminais → memória do backend;
- sessões → `~/.claude/projects/` (do Claude Code, só leitura);
- biblioteca → `WORKFLOW_PATH/library` (só leitura).

## Deixado de fora (deliberadamente)

_(O que foi pensado e não entrou, e porquê — evita que alguém o procure.)_

## Relacionado

[[architecture]] · [[api]] · [[security]]
