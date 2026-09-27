# Regras de documentação

**When to use**: sempre que se escreve, move ou apaga documentação — e sempre que se termina
um trabalho (o resultado escreve-se no vault).

---

## 1. O vault é a fonte de verdade; o `CLAUDE.md` é um ponteiro

O código diz o que a aplicação faz **hoje**; o vault diz o que foi decidido e **porquê**. Uma
resposta que ignore o vault repete decisões já tomadas.

Um `CLAUDE.md` (raiz ou subpasta) só pode conter:
- para onde ir (tabela de atalhos por pergunta);
- convenções sobre **como trabalhar** naquela pasta.

**Nunca factos sobre o projeto.** Já aconteceu: uma tabela de rotas existia no `CLAUDE.md` e em
`docs/`, e a de `docs/` ficou meses a listar três páginas apagadas. Duas cópias do mesmo facto
divergem sempre, e nunca se sabe qual é a boa. O hook de pre-commit avisa quando um `CLAUDE.md`
cresce mais de 10 linhas ou ganha um bloco de código.

## 2. Uma cópia de cada facto

Se dois documentos precisam do mesmo facto, um tem-no e o outro linka. Isto inclui tabelas de
rotas, listas de endpoints, versões de stack, intervalos de migrações.

## 3. `docs/` vs `notes/` vs `sessions/`

| Pasta | Versionada? | O que tem |
|---|---|---|
| `docs/` | ✅ | Factos sobre o sistema: arquitetura, schema, API, segurança, convenções, skills, ADRs, specs de features |
| `notes/` | ❌ git-ignored | Pessoal e de trabalho: ToDo, ideias, bugs, work log, planos, lições |
| `sessions/` | ✅ | Handoff entre chats/pessoas — decisões que interessam ao projeto (com a flag `sessions`) |

Uma spec que orienta semanas de trabalho é documentação de projeto, não nota pessoal — vai para
`docs/features/`, versionada. Se o disco morrer, o `notes/` vai com ele.

## 4. Um ficheiro só sobrevive se um passo do ciclo lhe escrever

Um ficheiro que nenhuma skill atualiza fica vazio ou apodrece — já aconteceu com um `learning.md`
e um `backlog.md` vazios durante dois meses, enquanto o work log tinha 65 entradas porque a
skill `implement-todo` o obrigava. **Todo o ficheiro de `notes/` e `docs/` tem de ter dono:**
uma skill que lhe escreve num passo concreto. Se não tem, ou se lhe dá um dono, ou não se cria.

## 5. Estado explícito por documento

Cada doc em `docs/` diz no topo o seu estado quando isso não é óbvio:

- ✅ **Decidido/implementado**
- 🚧 **Por implementar** — descreve a intenção, o código ainda não existe
- ❓ **Em aberto** — há uma decisão por tomar

Num projeto acabado de gerar, quase tudo é 🚧 — isso é normal e está assinalado de propósito.

## 6. Decisões estruturais são ADRs, e ADRs não se editam

Decisão nova ("usamos X em vez de Y") → ADR novo, numerado e datado, com contexto, opções, porquê
e consequências. **Nunca editar um ADR antigo para mudar de decisão** — cria-se um novo que o
referencia e marca-se o antigo como substituído. Uma escolha estrutural feita em silêncio
dentro de uma spec ou de um commit perde o porquê e volta a ser discutida.

## 7. Documentação proativa, não reativa

A documentação atualiza-se **no momento em que a feature é implementada** (cada skill tem um
item de documentação no seu Final Checklist), não quando o hook de pre-commit avisa. O hook é a
rede de segurança, não a via normal.

## 8. Handoffs são descartáveis

Um guia de integração backend → frontend, um brief de redesign: servem enquanto a feature está
aberta. Quando fecha, **apagam-se** — o que era verdade está no código e em `docs/`, as decisões
no work log. Deixados, desatualizam-se (três guias ficaram duas semanas a descrever DTOs que já
tinham mudado).

## Relacionado

[[code-best-practices]] · [[ai-workflow]] · [[../skills/process/skill-implement-todo]]
