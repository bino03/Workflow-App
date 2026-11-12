# 📝 Notes

Notas pessoais e de trabalho. **Git-ignored** — existem só localmente / no vault. Sem tags nem frontmatter.

## Ficheiros — e quem lhes escreve

Um ficheiro só sobrevive se um passo do ciclo lhe escrever. Cada um tem dono:

| Ficheiro | O que tem | Quem escreve |
|---|---|---|
| [[ToDo]] | Backlog acionável, por tema — **fonte de verdade** do `/implement-todo` | Tu · `/refine-idea` (entrada) · `/implement-todo` Fase 6 (saída) |
| [[ideas]] | Ideias em bruto, ainda não acionáveis | Tu · `/refine-idea` · `/implement-todo` Fase 3 (itens imaturos, com contexto) |
| [[whatIveDone]] | Work log — o que ficou feito e porquê | `/implement-todo` Fase 6 |
| [[roadmap/backlog]] | Estado de cada iniciativa, uma linha cada | `/implement-todo` Fase 7 |
| `roadmap/plans/` | Planos confirmados com checkpoints | `/implement-todo` Fases 4-5 |
| [[learning]] | Armadilhas de ferramentas e de processo | `/implement-todo` Fase 7 · `/verify-in-browser` Step 7 |
| [[workflow-feedback]] | Dúvidas sobre o que veio herdado do Workflow — lidas pelo `/absorb-feedback` lá | O Claude, quando tropeça · `/implement-todo` Fase 7 · Tu |
| [[bugs]] | Bugs sem correção acionável ainda | Tu; promovidos a ToDo quando há correção |
| [[refactoring]] | Dívida técnica, com ficheiro:linha | Tu · auditorias de design |
| `design-briefs/` | Briefs de redesign | `/frontend-structure-brief`; vão para `archive/` depois de implementados |

## O ciclo

```
ideas.md          ← ideia em bruto
   ↓ /refine-idea (ou à mão, quando fica acionável)
ToDo.md           ← backlog acionável, por tema
   ↓ /implement-todo
roadmap/plans/    ← plano confirmado + checkpoints (permite retomar)
   ↓ implementação + testes
whatIveDone.md    ← log (e o bullet sai do ToDo.md)
```

Um item que se revela imaturo volta a `ideas.md` **com o contexto já investigado**.
