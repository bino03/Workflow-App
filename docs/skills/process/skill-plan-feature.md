# Skill: Planear uma feature

**When to use**: algo que vai demorar mais do que uma sessão.

**Time**: ~30-60 min de entrevista + escrita. **Não escreve código.**

**Produz**: `docs/features/<slug>.md`, executável por [[skill-implement-todo]] → "Modo spec".

> 📐 O contexto morre entre sessões. A spec é o artefacto durável — **escrita para alguém que nunca
> viu esta conversa**.

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
- [ ] `notes/ToDo.md` — já lá está? relaciona-se?
- [ ] `docs/features/` — spec relacionada?

Se já há código, investigar em paralelo (agentes só-leitura em áreas diferentes, numa só mensagem).
Devolvem conclusões, não ficheiros.

## Passo 2 — A entrevista

Sete secções obrigatórias; as perguntas dentro de cada uma adaptam-se. **Em bloco**, com **defaults
propostos**, sem perguntar o que já está decidido. Uma resposta estrutural = **ADR novo**, não uma
escolha silenciosa na spec.

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

## Passo 4 — Partir em passos

Ordem pela cadeia de dependências do projeto (tipicamente `migração → entidade → endpoint → UI`). Cada
passo tem, sem exceção:

| Campo | Regra |
|---|---|
| **Ficheiro concreto** | `backend/…/OrderController.java`, não "o controller" |
| **Skill a seguir** | Qual das skills do projeto cobre o passo |
| **Tier de modelo** | `opus` (desenho — não delegar) · `sonnet` (implementação) · `haiku` (mecânico, só com ficheiro e conteúdo exatos) |
| **Critério de aceitação** | Verificável. Um passo sem isto fica "quase feito" para sempre |

Passos **sequenciais** — tocam nos mesmos ficheiros. Paralelismo só na investigação.

## Passo 5 — Escrever a spec

Copiar `docs/features/_TEMPLATE.md` para `docs/features/<slug-kebab>.md` e preencher.

**Teste**: *uma sessão nova, sem nada desta conversa, consegue começar a trabalhar sem perguntar?*

- [ ] Decisões registadas **com o porquê** e a alternativa rejeitada
- [ ] "Fora" preenchido
- [ ] Cada passo com ficheiro, skill, tier e critério
- [ ] Secção 6 "Estado atual" inicializada (nada feito, próxima ação = passo 1)
- [ ] Perguntas sem resposta na secção 7, não esquecidas

## Passo 6 — Ligar ao resto

- [ ] Item no ToDo a apontar para a spec
- [ ] ADRs novos para as decisões estruturais
- [ ] Commit `docs: spec da feature <nome>` ([[skill-git-commits]]) — a spec é **versionada**

## Passo 7 — Entregar (e parar)

Três linhas: onde ficou a spec; quantos passos e o tier de cada; como arrancar
(`/implement-todo` → "Implementar a partir de uma spec"). **Não começar a implementar.**

## Erros comuns

| Erro | Consequência |
|---|---|
| Spec para uma feature de uma sessão | Custa mais que a feature e apodrece |
| Saltar "o que fica de fora" | Sessões futuras expandem o âmbito sozinhas |
| Passos sem critério de aceitação | Ficam "quase feitos" |
| Passos sem ficheiro concreto | A sessão seguinte redescobre onde mexer |
| Marcar como mecânico um passo com decisões | O modelo pequeno adivinha; corrigir custa mais |
| Decisão estrutural sem ADR | O porquê perde-se e volta a discutir-se |
| Spec que assume esta conversa | Uma sessão nova não a consegue seguir |

## Related Skills

[[skill-implement-todo]] · [[ai-workflow]] · [[documentation-rules]]
