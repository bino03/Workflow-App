# Skill: Planear uma feature

**When to use**: algo que vai demorar mais do que uma sessão.

**Time**: ~30-60 min de entrevista + escrita. **Não escreve código.**

**Produz**: `docs/features/<slug>.md` (a spec) + uma secção no `notes/ToDo.md` com **um bullet por fase**, a
apontar para ela. O [[skill-implement-todo]] executa os bullets como quaisquer outros.

> 📐 O contexto morre entre sessões. A spec é o artefacto durável — **escrita para alguém que nunca
> viu esta conversa**.
> ℹ️ Onde fica cada coisa, para não haver duas cópias:
> - **O desenho e o porquê** → a spec
> - **O que fazer a seguir** → os bullets das fases no ToDo
> - **Em que pé está a execução** → o plano do `/implement-todo` (`notes/roadmap/plans/`), que já tem
>   checkpoints e retoma
>
> A spec **não tem secção de estado**: uma segunda cópia do progresso diverge da primeira.


---

## Passo 0 — Dimensionar: precisa mesmo de spec?

| Dimensão | O que fazer |
|---|---|
| Uma sessão, um ou dois ficheiros | **Sem spec.** Item no ToDo ([[skill-refine-idea]]) e implementar |
| Várias sessões, atravessa camadas (BD → API → UI) | **Spec.** Continuar |
| Não se sabe | Fazer as perguntas do Passo 2 e decidir depois |

"Não precisa de spec" é um resultado válido e frequente. Uma spec de 300 linhas para uma feature de
uma hora custa mais do que a feature e apodrece.

## Passo 1 — Contexto antes de perguntar

- [ ] `CLAUDE.md` e `00-INDEX.md` — arquitetura e **fase atual**
- [ ] `docs/adr/` — decisões tomadas e **em aberto** (uma em aberto pode bloquear a feature)
- [ ] `notes/ToDo.md` e `notes/ideas.md` — já lá está? relaciona-se? (uma entrada `> Contexto (via …)` em
  `ideas.md` é investigação já feita)
- [ ] `docs/features/` — spec relacionada?
- [ ] `notes/whatIveDone.md` — grep pelo tema: o porquê de como as coisas ficaram

Se já há código, investigar em paralelo (agentes só-leitura em áreas diferentes, numa só mensagem).
Devolvem conclusões com `file:line`, não ficheiros — e o que devolvem vai para "O ponto de partida" da
spec, com contagens (quantos endpoints, quantas guardas): com isso, a investigação da primeira fase já
não tem de ser refeita.

## Passo 2 — A entrevista

Sete secções obrigatórias; as perguntas dentro de cada uma adaptam-se. **Em bloco**, com **defaults
propostos**, sem perguntar o que já está decidido. **"Não sei" é uma resposta válida** — vai para
"Perguntas em aberto", não se inventa: a skill sugere hipóteses, mas **não inventa requisitos de
negócio**. Uma resposta estrutural = **ADR novo**, não uma escolha silenciosa na spec. Duas respostas que
se contradizem dizem-se em voz alta antes de escrever, com a síntese proposta e a opção de reabrir uma
delas.

1. **Problema e valor** — o que se quer conseguir que hoje não se consegue? Como se sabe que está bem feito (o momento de uso)?
2. **Âmbito — sobretudo o que fica de fora.** Versão mínima? O que é tentador mas fica para depois? Segunda fase óbvia? *(A lista do que fica de fora é a secção mais útil da spec.)*
3. **Dados** — o que se guarda de novo? Relações? Histórico ou só estado atual?
4. **API** — que operações? Trabalho em background? Integrações?
5. **Interface** — onde vive? como se chega lá? estado vazio? visibilidade por role?
6. **Erros e casos-limite** — o que pode correr mal? que códigos de erro novos? validação?
7. **Permissões** — quem pode o quê (rota, registo, campo)?

## Passo 3 — Desenhar

Antes de partir em passos: tabelas e colunas, endpoints (método + caminho), DTOs/tipos com campos,
componentes e ficheiros de frontend, códigos de erro. **Se algo não é evidente, voltar a perguntar** —
um desenho vago dá uma spec vaga, e uma spec vaga não sobrevive à perda de contexto.

## Passo 4 — Partir em fases

Ordem pela cadeia de dependências do projeto (tipicamente `migração → entidade → endpoint → UI`). Cada
fase **entra em uso sozinha** — no fim dela há algo que se usa, não meia camada à espera da seguinte — e
tem, sem exceção:

| Campo | Regra |
|---|---|
| **Ficheiros concretos** | `backend/…/OrderController.java`, não "o controller" |
| **Skill a seguir** | Qual das skills do projeto cobre a fase. Se a camada não tem skill, apontar para as convenções da stack (`docs/<camada>-conventions.md`) e o ficheiro irmão a imitar — nunca inventar o nome de uma skill |
| **Tier de modelo** | `opus` se a fase ainda tem uma decisão, ou mexe em permissões, schema partilhado ou configuração de segurança · `sonnet` se o desenho já está fechado na spec. **Na dúvida, `opus`** |
| **Critério de aceitação** | Verificável: um teste que passa e/ou um comportamento a ver no browser. Uma fase sem isto fica "quase feita" para sempre |

Fases **sequenciais** — tocam nos mesmos ficheiros. Paralelismo só na investigação.

Tiers pelos critérios de [[ai-workflow]] → "Tiers de modelo" — só `opus` e `sonnet`, porque cada fase vira
um bullet do ToDo. Fases do mesmo tier **seguidas** sempre que as dependências o permitam: a spec diz em
que modelo abrir cada sessão (linha **Sessões** da secção 5 do template).

## Passo 5 — Escrever a spec

Copiar `docs/features/_TEMPLATE.md` para `docs/features/<slug-kebab>.md` e preencher.

**Teste**: *uma sessão nova, sem nada desta conversa, consegue começar a trabalhar sem perguntar?*
- [ ] "O ponto de partida" com o que existe hoje (`file:line`, contagens)

- [ ] Decisões registadas **com o porquê** e a alternativa rejeitada
- [ ] "Fora" preenchido
- [ ] Cada fase com ficheiros, skill, tier e critério, e a entrar em uso sozinha
- [ ] Linha **Sessões** preenchida (que fases em que modelo)
- [ ] Perguntas sem resposta na secção 6, não esquecidas

## Passo 6 — Ligar ao resto

- [ ] **`notes/ToDo.md`** — uma secção própria: um parágrafo a apontar para a spec com **"ler a spec antes
  de implementar qualquer fase"**, e **um bullet por fase**, na ordem:
  ```markdown
  - [ ] `sonnet` Fase 1 — <título> — <critério de aceitação numa frase> · [[docs/features/<slug>]] → "Fase 1"
  ```
- [ ] **Entradas absorvidas** — se a spec funde bullets do ToDo ou entradas de `ideas.md`, retirá-las
  (edição pontual) e dizê-lo no cabeçalho da spec, para o mesmo trabalho não ficar em dois sítios
- [ ] ADRs novos para as decisões estruturais
- [ ] Commit `docs: spec da feature <nome>` ([[skill-git-commits]]) — a spec é **versionada**

## Passo 7 — Entregar (e parar)

Três linhas: onde ficou a spec; quantas fases, o que cada uma entrega e em que modelo abrir cada sessão;
como arrancar (`/implement-todo` → "Só um tema" → a secção nova). **Não começar a implementar.**

## Erros comuns

| Erro | Consequência |
|---|---|
| Spec para uma feature de uma sessão | Custa mais que a feature e apodrece |
| Saltar "o que fica de fora" | Sessões futuras expandem o âmbito sozinhas |
| Fases sem critério de aceitação | Ficam "quase feitas" |
| Fases sem ficheiro concreto | A sessão seguinte redescobre onde mexer |
| Marcar `sonnet` uma fase com decisões | O modelo adivinha; corrigir custa mais |
| Estado de execução escrito na spec | Duas cópias do progresso (spec + plano) — divergem |
| Inventar um requisito para fechar uma pergunta | Implementa-se o que ninguém pediu |
| Decisão estrutural sem ADR | O porquê perde-se e volta a discutir-se |
| Spec que assume esta conversa | Uma sessão nova não a consegue seguir |

## Related Skills

[[skill-implement-todo]] · [[ai-workflow]] · [[documentation-rules]]
