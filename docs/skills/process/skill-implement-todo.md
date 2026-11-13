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

1. **Contagem por tema e por tier** — itens `- [ ]` por secção do ToDo e, dentro dela, quantos são
   `` `opus` ``, `` `sonnet` `` e sem marca. Nenhum item → guardar esse facto.
2. **Planos por retomar** — `notes/roadmap/plans/*.md` com `**Estado**: em curso`.
3. **Ideias com contexto** — grep a `notes/ideas.md` por `> Contexto (via ` (deixadas por esta skill ou
   pelo [[skill-refine-idea]]).
4. **Work log recente** — os 1-3 títulos mais recentes de `notes/whatIveDone.md`.
5. **Specs em curso** — `docs/features/*.md` com estado 🚧 e as secções do ToDo que apontam para elas.

## Fase 1: Menu, âmbito, orçamento

### 1.0 Menu (primeira pergunta, sempre)

`AskUserQuestion`, opções dinâmicas conforme a Fase 0 (3-4):
- **Retomar um plano anterior** — só se há plano `em curso`
- **Implementar** — backlog até ao código (as fases de uma spec são bullets como os outros — ver "Fases de uma spec" abaixo)
- **Só planear** — ordem de prioridade gravada, sem implementar
- **Ver estado atual** — resumo, sem alterar nada

ToDo vazio e nada por retomar → dizê-lo e parar.

**Retomar**: ler o plano (perguntar qual se há vários), mostrar âmbito, ordem, o que está feito e o
"Próximo passo", confirmar, e **saltar para a Fase 5** nesse ponto — os esclarecimentos já estão gravados.

**Ver estado**: contagem por tema e por tier, planos e próximo passo, ideias com contexto (uma a uma, e
perguntar se alguma já pode voltar ao ToDo — se sim, movê-la com edição pontual), últimas entradas do
log. Depois perguntar em texto simples se quer implementar, planear ou parar.

### 1.1 Âmbito

**Tudo** · **Só um tema** · **Só um item específico** · **Só um tier** (ex.: só os `sonnet`, para uma
sessão barata).
- Tema: usar as secções que **existem** no ToDo lido (agrupar em 2 perguntas multiSelect se forem mais de 4).
- Item: imprimir o ToDo numerado, com o tier de cada um, e perguntar por intervalos.
- Tier: os itens sem marca não entram. Ainda não se sabe o tier deles, e só a Fase 2 o diz.

Guardar os bullets exatos (verbatim), **com o bloco `> Decidido (via refine-idea, …)`** se o tiverem —
é esclarecimento já obtido, entra no plano e nas Fases 2-3. Nada fora do âmbito é tocado.

### 1.2 Orçamento (só se "Implementar")

**Sem limite (recomendado)** · **Pouco tempo/tokens — otimizar para fechar em segurança**. "Pouco" não
muda as Fases 2-3 (a ambiguidade não desaparece), muda a ordenação (curtas primeiro) e a Fase 5 (parar
entre tarefas, nunca a meio).

### 1.3 Modelo da sessão (aviso, uma vez)

Comparar o modelo em que esta sessão corre (o Claude sabe-o pelo ambiente) com o **tier mais alto** dos
itens em âmbito ([[ai-workflow]] → "Tiers de modelo"). A skill não muda de modelo sozinha. Avisa uma
vez, em texto, e segue com o modelo que estiver:

| Sessão | Âmbito | Aviso |
|---|---|---|
| Opus | Só `sonnet` | "O âmbito é todo `sonnet`: `/model` para Sonnet poupa tokens sem perder o contexto desta sessão." |
| Sonnet | Tem itens `opus` | "Há itens `opus`: `/model` para Opus antes deles, ou reduzir o âmbito aos `sonnet` e deixá-los para uma sessão Opus." |
| Haiku | Qualquer | "Esta skill orquestra (investiga, pergunta, encadeia skills) e não deve correr em Haiku: `/model` para Sonnet ou Opus." |

Itens sem marca não contam para o aviso; a Fase 4 volta a comparar, já com os tiers confirmados. O aviso
nunca bloqueia: o utilizador pode ter razões para ficar no modelo em que está.

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
### Tier
Por bullet: opus | sonnet + 1 linha de razão, pelos critérios abaixo. Se o bullet já tem tier, confirma-o
ou contesta-o com o que o código mostrou. Um bullet com uma decisão e muito trabalho mecânico → diz
"misto" e propõe a divisão.
Critérios: opus = decisão em aberto, contrato partilhado, schema, segurança, efeito largo;
sonnet = o quê/onde/como se verifica já se sabem. Nunca haiku. Na dúvida, opus.
```

Quem orquestra **não lê código diretamente** — só os relatórios. Se uma investigação anterior (ex.: o `/refine-idea` de há minutos) já apurou parte, o prompt leva-a como **hipótese a confirmar, não como dado** (com `ficheiro:linha`) e aponta o agente às lacunas — é o que apanha o erro de quem orquestra. Se o projeto ganhar roadmaps técnicos
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
3. **Agrupar por tier**, dentro do que as dependências deixam: os `opus` juntos, e de preferência antes
   dos `sonnet` que deles dependem (as decisões desbloqueiam a implementação). Assim uma sessão pode
   mudar de modelo uma só vez, ou parar no fim do bloco `opus` e retomar o resto noutra sessão.
4. **Desempate**: esforço (S antes de L), depois impacto. Com orçamento "pouco", o esforço passa a critério principal.

**Tiers**: cada tarefa leva o tier confirmado pela Fase 2. Quando o tier difere do que o bullet tinha,
dizê-lo na linha da tarefa ("era `sonnet`, passa a `opus`: o código mostrou que falta decidir X"). Um
item "misto" → propor a divisão em dois bullets (o `opus` que decide e o `sonnet` que implementa) e,
se o utilizador aceitar, reescrever o bullet no ToDo (edição pontual) antes de gravar o plano. Se os
tiers confirmados mudaram o quadro da 1.3, repetir o aviso de modelo, uma vez.

Mostrar a lista numerada com o tier e 1 linha de razão por item. Perguntar: **Confirmar** · **Reordenar** ·
**Remover um item**. Repetir até confirmar.

**Gravar** em `notes/roadmap/plans/AAAA-MM-DD-<slug>.md`:

```markdown
# Plano — AAAA-MM-DD <slug>

**Estado**: em curso
**Âmbito escolhido**: <descrição>
**Orçamento da sessão**: sem limite | pouco
**Modelo**: tarefas 1-2 `opus` · 3-5 `sonnet` (mudar com `/model` entre os blocos, ou retomar noutra sessão)

## Esclarecimentos já obtidos
- <pergunta> → <resposta>

## Ordem confirmada
1. [ ] `opus` <tarefa> — por começar
2. [ ] `sonnet` <tarefa> — por começar

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
11. **Na fronteira entre blocos de tier** (o plano passa de `opus` a `sonnet`, ou o contrário), lembrar
    uma vez a linha **Modelo** do plano. Uma tarefa `sonnet` que afinal esconde uma decisão de desenho é
    o caso do passo 9: parar, dizê-lo, e decidir com o utilizador se se decide já ou noutra sessão.

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
- **Algo herdado do Workflow atrapalhou?** — na mesma pergunta: um doc, skill ou regra que veio do
  Workflow e confundiu, contradisse ou não servia. Se sim (e ainda não está lá), entrada em
  `notes/workflow-feedback.md` com "como se resolveu".
- Proposta de commit segundo [[skill-git-commits]] — **perguntar antes de qualquer `git push`**.
- Drift entre `ideas.md` e `ToDo.md`, ou entradas do log fora do formato: mencionar uma vez, não corrigir
  (são ficheiros pessoais).

---

## Fases de uma spec (`docs/features/<slug>.md`)

Uma feature planeada com [[skill-plan-feature]] chega ao ToDo como uma secção com **um bullet por fase**,
a apontar para a spec. Corre pelo fluxo normal, com três diferenças:

1. **Ler a spec antes de qualquer fase** (a secção dela, mais "Fora" e as decisões) e passar o excerto da
   fase ao plano.
2. **A investigação da Fase 2 encolhe**: se a fase tem `Ficheiros` concretos e o código não mudou desde a
   data da spec (`git log --since`), basta confirmar por grep os `file:line` citados — lançar agentes só
   redescobriria o que a spec já diz.
3. **O estado não volta para a spec**: o progresso fica no plano e no bullet do ToDo. Um desvio ao desenho
   (uma decisão mudou) é que se escreve na spec, com a data.

Perguntas em aberto da spec que bloqueiam a fase → parar e perguntar.

---

## Final Checklist

- [ ] Menu apresentado antes de qualquer investigação
- [ ] Âmbito e orçamento escolhidos pelo utilizador; temas = secções reais do ToDo
- [ ] Investigação paralela, por tema, via subagentes (código não lido diretamente)
- [ ] Perguntas todas em bloco, antes da Fase 5; itens sem resposta movidos para `ideas.md` com contexto
- [ ] Ordem por dependências + hot files + tier + esforço, confirmada; plano gravado antes de implementar
- [ ] Tier de cada tarefa confirmado pela investigação, mudanças ditas, itens mistos partidos; aviso de modelo dado (1.3 e, se mudou, Fase 4)
- [ ] Execução sequencial com checkpoints antes/depois de cada tarefa
- [ ] Cada tarefa testada (ou verificação registada como pendente) antes do bookkeeping
- [ ] Final Checklist das skills invocadas fechado, incluindo documentação
- [ ] ToDo e whatIveDone atualizados por tarefa; guia de integração apagado se o frontend fechou
- [ ] backlog.md atualizado; learning.md se houve lição de ferramenta; workflow-feedback.md se algo herdado atrapalhou
- [ ] Resumo + proposta de commit, sem push sem confirmação

## Related Skills

[[skill-refine-idea]] (a entrada do ToDo) · [[skill-git-commits]] · [[skill-plan-feature]] · e todas as skills de stack do projeto (ver [[SKILLS-INDEX]])
