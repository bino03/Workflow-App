# Testes e verificação — quando é que está "feito"

**When to use**: antes de dar uma tarefa por concluída; ao desenhar a estratégia de testes de um
projeto novo.

---

## A regra

**Uma tarefa só está feita depois de testada a sério.** Compilar, o type-check e o lint não são
teste. O orçamento apertado de uma sessão reduz **quantas** tarefas se fazem, nunca o rigor de
cada uma.

| Camada | "Testado" significa |
|---|---|
| Backend | Testes relevantes a passar + o endpoint chamado de verdade (curl/HTTP) |
| Frontend | O fluxo real feito no browser, não inspeção do código |
| Migração | A app arrancou e aplicou-a numa BD que não é produção |
| Permissões | A API devolve 403 com a role errada — não "o botão não aparece" |

## Verificação no browser

- **Provar por DOM + rede, não por screenshot.** Um screenshot diz o que parece; ler o DOM e
  chamar a API com a sessão da página diz o que **é**. Os dois têm de concordar — quando não
  concordam, o bug é quase sempre a lista que não recarrega.
- **Escrever na BD só dentro de dados de teste marcados** (uma entidade `is_test`, criada para a
  verificação e apagada no fim, pela ordem certa das FKs). Leitura de dados reais é livre.
- **Quando a sessão não consegue abrir o browser**, a verificação **adia-se, não se dispensa**:
  regista-se em `notes/verificacao-browser-pendente.md` e marca-se "não verificado no browser" no
  plano e no work log. Uma passagem em lote depois é mais barata do que uma ida por feature.
- Um 🔴 encontrado numa passagem vai para o ToDo — não se corrige a meio, senão a passagem nunca
  acaba.

## Estratégia de testes de um projeto

Decidir no início, e escrever em `docs/commands.md`, **que testes ligam a quê**:

| Grupo | Liga à BD? | Corre por omissão? |
|---|---|---|
| Unitários puros | Não | Sim |
| Com mocks (services, controllers) | Não | Sim |
| Contexto completo / integração | **Sim** — a BD configurada | **Não**, se a BD configurada puder ser a real. Excluir e correr só com intenção |
| Probes contra ficheiros reais | Não | Skipped sem parâmetro |

Sem testcontainers nem BD de teste isolada, **ninguém testa SQL nem mapeamentos**: as migrações
só se provam ao arrancar. Isso tem de estar escrito, para não se assumir cobertura que não existe.

## Type-check que não verifica nada

Confirmar que o comando de type-check **analisa ficheiros de facto**. Num projeto com
`tsconfig` só de referências, `tsc --noEmit` sai com 0 erros e 0 ficheiros — parece limpo e não
é; o comando real era `tsc -b`, e um import partido chegou ao ramo principal por causa disso.
Se o build já falha com erros pré-existentes, registar o número e comparar antes/depois.

## Relacionado

[[code-best-practices]] · `verify-in-browser` (não incluída) · [[../skills/process/skill-implement-todo]]
