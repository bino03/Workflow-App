# Skill: Amadurecer uma ideia

> 🚧 Convenção prospetiva — ainda sem código neste projeto que a valide.

**When to use**: tens uma ideia de funcionalidade e queres que fique guardada no sítio certo, pronta a
ser implementada mais tarde — ou queres pegar numa ideia de `notes/ideas.md` e fechá-la.

**Time**: ~5-15 min. **Não escreve código, não implementa.**

**Produz**: um bullet em `notes/ToDo.md` **ou** uma entrada em `notes/ideas.md`
(ou o encaminhamento para `/plan-feature`).

> 📐 Esta skill é a **entrada** do ciclo `ideas → ToDo → plans → whatIveDone` ([[notes/README]]).
> O [[skill-implement-todo]] é a saída: parte do que esta skill escreve.

> ℹ️ No `AskUserQuestion`, a opção "Outro" é automática — nunca a acrescentar, gasta uma das 4 vagas.

---

## Step 0: Qual ideia?

- **Veio com a invocação** (`/refine-idea quero exportar X para Excel`) → guardar o texto **verbatim**
  e seguir.
- **Não veio** → ler `notes/ideas.md` e perguntar: **Uma ideia nova** (escreve-a) · **Uma de
  `ideas.md`** (listar numeradas; as que têm `> Contexto (via …)` primeiro, com a pergunta que as
  bloqueou — são as mais perto de sair).

Porquê verbatim: o texto original é o que o utilizador vai reconhecer daqui a um mês no ToDo, e o que o
work log cita quando a tarefa fechar.

## Step 1: Ler o vault antes de perguntar

Barato — leituras e greps dirigidos, não leitura integral:

| O quê | Para responder |
|---|---|
| `notes/ToDo.md` | Já lá está? Há um bullet parecido para fundir? Em que secção encaixa? |
| `notes/ideas.md` | Já existe como ideia? (evita duplicar) |
| `notes/whatIveDone.md` (grep) | **Já foi feito**, total ou parcialmente? |
| `notes/roadmap/plans/` em curso | Faz parte de um plano a meio? |
| `docs/features/` | Há uma spec que já cobre isto? |
| `docs/product/` (overview, use-cases, domain-brief) | Encaixa no produto? Está no "fora de âmbito"? Que roles e ecrãs toca? |
| `docs/adr/` | Alguma decisão tomada que a ideia contraria? Alguma **em aberto** que a bloqueia? |
| `docs/code-map`, `docs/api`, `docs/database` | O que já existe e onde a ideia se liga |

Só se a documentação não chega para saber onde a ideia toca no código: **um** agente só-leitura
(`Explore`), com a
ideia e a pergunta concreta ("existe já um export? onde vive a listagem de X?"). Devolve conclusões com
`ficheiro:linha`, não ficheiros.

Mostrar ao utilizador, em 3-6 linhas: **o que já existe**, **com o que se relaciona**, **o que colide**.

**Saídas cedo** (dizer e perguntar como seguir, em vez de entrevistar):
- Já feito → apontar a entrada do work log.
- Já no ToDo ou em `ideas.md` → propor **fundir** (refinar o bullet existente), nunca duplicar.
- Contraria um ADR → a ideia implica decidir de novo; fica em `ideas.md` com "⚠️ precisa de ADR que
  substitua o NNNN", salvo se o utilizador decidir já (ver Step 2).
- Está no "fora de âmbito" do produto → dizê-lo; o utilizador decide se muda o âmbito.

## Step 2: Perguntar só o que falta

Perguntas **em bloco**, com **defaults propostos** a partir do Step 1, sem perguntar o que o vault já
responde. Máximo duas rondas — mais do que isso é sinal de que a ideia não amadureceu, e isso também é
um resultado.

Escolher das seguintes as que a ideia precisa:

1. **Valor** — que problema resolve? como se vê que está bem feito (o momento de uso)?
2. **Mínimo e fora** — qual é a versão mais pequena útil? o que é tentador mas fica para depois?
3. **Onde vive** — que ecrã/endpoint/processo? quem lá chega (role)?
4. **Dados** — guarda algo novo? altera o que existe?
5. **Regras e casos-limite** — o que pode correr mal? o que é inválido?
6. **Permissões** — quem pode ver/fazer o quê?

**"Não sei" é uma resposta válida** — oferecê-la como opção. Uma pergunta sem resposta não se inventa:
fica registada como aberta. A skill pode sugerir hipóteses, mas **não inventa requisitos de negócio**.

Resposta estrutural (novo tipo de dado central, nova integração, mudança de modelo de autenticação…) →
não se decide num bullet: marcar "⚠️ precisa de ADR".

## Step 3: Dimensionar e decidir o destino

| Estado depois do Step 2 | Destino |
|---|---|
| Sabe-se **o que**, **onde** e **como se verifica**; sem perguntas de negócio em aberto | `ToDo.md` |
| Idem, mas falta um detalhe pequeno (um texto, um limite, um default) | `ToDo.md` com **⚠️** — o `/implement-todo` pergunta antes de implementar |
| Falta o valor, o âmbito, ou uma decisão estrutural | `ideas.md`, com contexto |
| Grande demais para uma tarefa, mas partível em passos de uma sessão | vários bullets no `ToDo.md`, na ordem das dependências |
| Várias sessões, atravessa camadas (dados → API → UI) | **`/plan-feature`** — ver abaixo |

Porquê o teste "o que / onde / como se verifica": é exatamente o que o `/implement-todo` precisa para
investigar sem voltar a perguntar o básico. Um bullet que falha isto volta a `ideas.md` na Fase 3 dele —
mais vale lá ficar já.

**Encaminhar para `/plan-feature`**: perguntar se quer fazer a spec agora. Sim → invocá-la via `Skill`,
passando o que o Step 1 e o Step 2 já apuraram (para não perguntar duas vezes). Mais tarde → entrada em
`ideas.md` com contexto e "precisa de spec (`/plan-feature`)".

## Step 4: Mostrar, confirmar, escrever

Mostrar **o texto exato** e o sítio (ficheiro + secção), e perguntar: **Gravar** · **Ajustar o texto**
· **Mudar de destino** (ToDo ↔ ideas).

**No `ToDo.md`** — na secção temática que **existe** e encaixa (criar uma só se nenhuma encaixa):

```markdown
- [ ] <verbo + o quê, na linguagem do utilizador> — <porquê, numa frase>
  > Decidido (via refine-idea, AAAA-MM-DD): <respostas do Step 2 que importam para implementar>; ⚠️ <o que falta, se falta>
```

**No `ideas.md`**:

```markdown
- <texto original>
  > Contexto (via refine-idea, AAAA-MM-DD): <o que se apurou no vault/código> · falta decidir: <as perguntas abertas>
```

Regras:
- **Edição pontual** — acrescentar, nunca reescrever o ficheiro (é pessoal, o utilizador edita-o).
- **Uma ideia vive num só sítio.** Se veio de `ideas.md` e vai para o ToDo, sai de `ideas.md` na mesma
  operação. Se fundiu com um bullet existente, o bullet é substituído, não copiado.
- O bloco `> Decidido` **é parte do bullet** — o `/implement-todo` lê-o como esclarecimento já obtido
  e remove-o com o bullet quando a tarefa fecha.
- Sem nomes de ficheiros inventados: só os que o Step 1 confirmou existirem.

## Step 5: Fechar (e parar)

Duas ou três linhas: onde ficou, o que ficou por decidir (se algo), e o próximo passo —
`/implement-todo` quando quiseres implementar, ou `/refine-idea` outra vez sobre esta ideia quando
tiveres a resposta que falta. **Não começar a implementar**, mesmo que pareça pequeno: o utilizador
pediu para guardar, não para fazer.

Não há commit: `notes/` é git-ignored. Se o Step 2 disse "precisa de ADR", lembrá-lo uma vez.

## Erros comuns

| Erro | Consequência |
|---|---|
| Perguntar o que o vault já responde | O utilizador sente que a skill não leu nada — e tem razão |
| Inventar uma resposta para "não sei" | O `/implement-todo` implementa uma regra de negócio que ninguém decidiu |
| Bullet vago ("melhorar X") no ToDo | Volta a `ideas.md` na Fase 3 do `/implement-todo`, depois de uma investigação gasta |
| A mesma ideia em `ideas.md` e no ToDo | Os dois divergem; um deles fica a mentir |
| Decisão estrutural escondida no bullet | O porquê perde-se; sem ADR, volta a discutir-se |
| Começar a implementar no fim | Salta o planeamento, a priorização e o bookkeeping do `/implement-todo` |

## Final Checklist

- [ ] Texto original da ideia guardado verbatim
- [ ] Vault lido antes de perguntar (ToDo, ideas, work log, plans, produto, ADRs)
- [ ] Duplicados, "já feito" e conflitos com ADRs detetados e ditos ao utilizador
- [ ] Perguntas em bloco, com defaults, só o que faltava; "não sei" registado, nunca inventado
- [ ] Destino decidido pelo teste "o que / onde / como se verifica"
- [ ] Texto exato mostrado e confirmado antes de escrever
- [ ] Edição pontual; a ideia vive num só sítio (saiu de `ideas.md` se foi promovida)
- [ ] Nada implementado; próximo passo dito

## Related Skills

[[skill-implement-todo]] · [[skill-plan-feature]] · [[documentation-rules]]
