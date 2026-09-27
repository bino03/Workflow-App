# Skill: Implement ToDo

**When to use**: avançar o backlog em `notes/ToDo.md` — priorizar, gerar um plano, ver o estado,
retomar uma sessão anterior, ou implementar, reutilizando as skills do projeto.

**Time**: de ~1 min (ver estado) a várias horas (implementar o backlog)

> 📐 Esta skill não escreve código diretamente — **orquestra** as skills que o fazem. Cada uma já lê
> [[code-best-practices]] e, quando aplicável, [[frontend-visual-consistency]].

> ℹ️ No `AskUserQuestion`, a opção "Outro" é automática — nunca a acrescentar, gasta uma das 4 vagas.

---

## Visão geral

```
Fase 0  Preflight (ToDo + ideias com contexto + planos por retomar + specs em curso)
Fase 1  Menu → âmbito → orçamento da sessão                ← perguntas
Fase 2  Investigação paralela, por tema                     ← subagentes só-leitura
Fase 3  Esclarecimento em bloco                             ← perguntas, tudo de uma vez
Fase 4  Priorização + confirmação + gravar o plano          ← pergunta
Fase 5  Execução sequencial, com checkpoints                ← implementa, uma tarefa de cada vez
Fase 6  Bookkeeping por tarefa                              ← ToDo, whatIveDone
Fase 7  Fecho                                               ← resumo, backlog, learning, commit
```

**Regras de ouro**
- Nunca se chega à Fase 5 sem passar pelas 1-4 com o utilizador (exceto ao retomar um plano já confirmado).
- **O orçamento apertado nunca é desculpa para saltar um teste ou o bookkeeping** — reduz quantas
  tarefas se fazem, nunca o rigor de cada uma.

---

## Fase 0: Preflight

Ler `notes/ToDo.md` **no momento da invocação** (o utilizador edita-o livremente). Depois, a baixo
custo (leituras e greps, sem subagentes):

1. **Contagem por tema** — itens `- [ ]` por secção do ToDo. Nenhum item → guardar esse facto.
2. **Planos por retomar** — `notes/roadmap/plans/*.md` com `**Estado**: em curso`.
3. **Ideias com contexto** — grep a `notes/ideas.md` por `> Contexto (via ` (deixadas por esta skill ou
   pelo [[skill-refine-idea]]).
4. **Work log recente** — os 1-3 títulos mais recentes de `notes/whatIveDone.md`.
5. **Specs em curso** — `docs/features/*.md` com estado 🚧, e a secção "Estado atual" de cada uma.

## Fase 1: Menu, âmbito, orçamento

### 1.0 Menu (primeira pergunta, sempre)

`AskUserQuestion`, opções dinâmicas conforme a Fase 0 (3-4):
- **Retomar um plano anterior** — só se há plano `em curso`
- **Implementar a partir de uma spec** — só se há spec 🚧 (ver "Modo spec" abaixo)
- **Implementar** — backlog até ao código
- **Só planear** — ordem de prioridade gravada, sem implementar
- **Ver estado atual** — resumo, sem alterar nada

ToDo vazio e nada por retomar → dizê-lo e parar.

**Retomar**: ler o plano (perguntar qual se há vários), mostrar âmbito, ordem, o que está feito e o
"Próximo passo", confirmar, e **saltar para a Fase 5** nesse ponto — os esclarecimentos já estão gravados.

**Ver estado**: contagem por tema, planos e próximo passo, ideias com contexto (uma a uma, e
perguntar se alguma já pode voltar ao ToDo — se sim, movê-la com edição pontual), últimas entradas do
log. Depois perguntar em texto simples se quer implementar, planear ou parar.

### 1.1 Âmbito

**Tudo** · **Só um tema** · **Só um item específico**.
- Tema: usar as secções que **existem** no ToDo lido (agrupar em 2 perguntas multiSelect se forem mais de 4).
- Item: imprimir o ToDo numerado e perguntar por intervalos.

Guardar os bullets exatos (verbatim), **com o bloco `> Decidido (via refine-idea, …)`** se o tiverem —
é esclarecimento já obtido, entra no plano e nas Fases 2-3. Nada fora do âmbito é tocado.

### 1.2 Orçamento (só se "Implementar")

**Sem limite (recomendado)** · **Pouco tempo/tokens — otimizar para fechar em segurança**. "Pouco" não
muda as Fases 2-3 (a ambiguidade não desaparece), muda a ordenação (curtas primeiro) e a Fase 5 (parar
entre tarefas, nunca a meio).

## Fase 2: Investigação paralela, por tema

Um agente só-leitura por tema em âmbito (`Explore`), todos numa só mensagem, com este prompt:

```
Tema: <nome>
Bullets do ToDo (verbatim): <lista>

Investiga o código atual relevante e devolve exatamente estas secções:

### Findings
Código relevante existente, com ficheiro:linha.
### Files Likely Touched
Tabela: caminho | novo/modificado | porquê
### Applicable Skills
Quais destas se aplicam: create-new-skill, design-database, git-commits, implement-todo, refine-idea, run, choose-design, plan-feature, frontend-design-system, frontend-error-handling, frontend-integration-guide, frontend-structure-brief
### Open Questions
O que o código não resolve (sem inventar requisitos), com 2-4 hipóteses quando fizer sentido.
### Dependencies
Bullets do ToDo (verbatim) que têm de vir ANTES deste tema.
### Effort Estimate
S/M/L + 1 linha.
```

Quem orquestra **não lê código diretamente** — só os relatórios. Se o projeto ganhar roadmaps técnicos
por domínio (`docs/<area>/roadmap.md`), acrescentar uma secção `### Known Gaps` consultada por grep
dirigido, nunca leitura integral.

## Fase 3: Esclarecimento em bloco

Juntar todas as `Open Questions` e perguntar **tudo de uma vez** (várias chamadas agrupadas por tema
se passar de 4 perguntas), antes de avançar. Não voltar a perguntar o que um bloco `> Decidido` já
responde; um ⚠️ lá dentro é pergunta a fazer aqui. A investigação pode sugerir candidatos, mas **não
inventa requisitos de negócio**.

**Se o utilizador não sabe responder** (a ideia não amadureceu): oferecer, como opção da própria
pergunta, mover o item para `notes/ideas.md` com o contexto:

```markdown
- <texto original do bullet>
  > Contexto (via implement-todo, AAAA-MM-DD): <o que foi investigado/perguntado e o que falta para desbloquear>
```

Remover o bullet do ToDo (edição pontual). Não é tarefa concluída — é tarefa adiada com contexto.

## Fase 4: Priorização, confirmação, plano

1. **Dependências duras primeiro** (ordenação topológica pelas `Dependencies`).
2. **Agrupar por "hot file"** — ficheiros que aparecem em mais do que um tema (enum de erros,
   configuração de segurança, router, entidades partilhadas) → tarefas adjacentes.
3. **Desempate**: esforço (S antes de L), depois impacto. Com orçamento "pouco", o esforço passa a critério principal.

Mostrar a lista numerada com 1 linha de razão por item. Perguntar: **Confirmar** · **Reordenar** ·
**Remover um item**. Repetir até confirmar.

**Gravar** em `notes/roadmap/plans/AAAA-MM-DD-<slug>.md`:

```markdown
# Plano — AAAA-MM-DD <slug>

**Estado**: em curso
**Âmbito escolhido**: <descrição>
**Orçamento da sessão**: sem limite | pouco

## Esclarecimentos já obtidos
- <pergunta> → <resposta>

## Ordem confirmada
1. [ ] <tarefa> — por começar
2. [ ] <tarefa> — por começar

## Próximo passo
Começar a tarefa 1.
```

"Só planear" → parar aqui, dizer onde ficou o plano e resumir a ordem.

## Fase 5: Execução sequencial

**Uma tarefa de cada vez, nunca em paralelo, nunca em worktrees isolados.** Por tarefa:

1. **Checkpoint "em curso"** no plano, com o "Próximo passo" exato se a sessão morrer agora.
2. Relembrar a tarefa e os esclarecimentos que lhe dizem respeito.
3. **Invocar via `Skill` as skills mapeadas**, pela ordem lógica (tabela antes de endpoint; permissões
   como verificação cruzada; design-system + error-handling para UI; integration-guide para handoff).
   **Nunca reinventar os passos de uma skill existente.**
4. Implementar.
5. **Testar — nunca saltado**: backend com os testes relevantes a passar; UI verificada no browser
   (ou registada como pendente, se não for possível agora — adiada, não dispensada).
6. **Fechar o Final Checklist completo das skills invocadas**, incluindo os itens de documentação
   (`docs/api.md`, `docs/database.md`, `docs/security.md`…) — proativamente, não à espera do hook.
7. Fase 6 para esta tarefa.
8. **Checkpoint "concluída"** (`[x]`).
9. Ambiguidade que só o código revelou → **parar e perguntar**.
10. Orçamento "pouco": antes da próxima tarefa, avaliar se cabe com folga; na dúvida, parar **entre** tarefas.

## Fase 6: Bookkeeping por tarefa

- **`notes/ToDo.md`** — remover a linha exata e o bloco `> Decidido` indentado por baixo dela, se
  existir (edição pontual; os irmãos ficam).
- **`notes/whatIveDone.md`** — acrescentar (nunca sobrescrever):

  ```markdown
  ## AAAA-MM-DD — <título curto>

  - <resumo em 1-2 linhas>
  - Files: <ficheiros tocados>
  - Item original do ToDo: "<verbatim>"
  ```

  O verbatim importa: vários bullets são vagos, e o log preserva o que foi decidido.
- **Guia de integração** da feature (se o frontend fechou): `git rm` no mesmo commit — é handoff, não documentação.

## Fase 7: Fecho

- Resumir o que foi feito; listar o que falta (e, se sobrou por orçamento: "corre `/implement-todo` e
  escolhe 'Retomar um plano anterior'").
- `**Estado**: concluído` no plano se tudo ficou feito → mover para `notes/roadmap/plans/archive/`.
- **`notes/roadmap/backlog.md`** — atualizar a linha da iniciativa (estado, data, o que falta; criar se
  é nova; apagar se ficou ✅ sem restos). Se este passo se salta, o ficheiro fica vazio.
- **Lição de ferramenta?** — perguntar uma vez se algo custou tempo que não fosse da app. Se sim, bullet
  datado em `notes/learning.md`.
- Proposta de commit segundo [[skill-git-commits]] — **perguntar antes de qualquer `git push`**.
- Drift entre `ideas.md` e `ToDo.md`, ou entradas do log fora do formato: mencionar uma vez, não corrigir
  (são ficheiros pessoais).

---

## Modo spec (a partir de `docs/features/<slug>.md`)

Para features multi-sessão planeadas com [[skill-plan-feature]]:

1. Ler a spec inteira; a secção **6 "Estado atual"** diz onde retomar.
2. Perguntar o modo: **NORMAL** (passo a passo, confirmação entre passos) ou **LAZY** (autónomo até ao
   fim ou até uma pergunta em aberto). Antes de LAZY, verificar que os passos de tier `opus` têm onde
   correr (sessão Opus ou agente `architect`).
3. Executar os passos pela ordem da secção 5, cada um com a skill e o tier indicados, e o critério de
   aceitação como definição de feito.
4. **No fim de cada sessão (ou se parar), atualizar a secção 6** — feito, em curso, próxima ação
   concreta, desvios, o que uma sessão nova precisa de saber. As checkboxes mentem quando uma sessão
   morre a meio; a secção 6 é a verdade.
5. Perguntas em aberto que bloqueiam o próximo passo → parar e perguntar.

---

## Final Checklist

- [ ] Menu apresentado antes de qualquer investigação
- [ ] Âmbito e orçamento escolhidos pelo utilizador; temas = secções reais do ToDo
- [ ] Investigação paralela, por tema, via subagentes (código não lido diretamente)
- [ ] Perguntas todas em bloco, antes da Fase 5; itens sem resposta movidos para `ideas.md` com contexto
- [ ] Ordem por dependências + hot files + esforço, confirmada; plano gravado antes de implementar
- [ ] Execução sequencial com checkpoints antes/depois de cada tarefa
- [ ] Cada tarefa testada (ou verificação registada como pendente) antes do bookkeeping
- [ ] Final Checklist das skills invocadas fechado, incluindo documentação
- [ ] ToDo e whatIveDone atualizados por tarefa; guia de integração apagado se o frontend fechou
- [ ] backlog.md atualizado; learning.md se houve lição de ferramenta
- [ ] Resumo + proposta de commit, sem push sem confirmação

## Related Skills

[[skill-refine-idea]] (a entrada do ToDo) · [[skill-git-commits]] · [[skill-plan-feature]] · e todas as skills de stack do projeto (ver [[SKILLS-INDEX]])
