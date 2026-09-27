# Convenções de nomenclatura

**When to use**: sempre que se nomeia um ficheiro, tabela, coluna, classe, variável, endpoint
ou rota.

---

## A regra: identificadores vs. comunicação entre pessoas

| Em inglês 🇬🇧 | Em português 🇵🇹 |
|---|---|
| Tabelas, colunas, classes, entidades, variáveis, métodos | Documentação do vault |
| Endpoints e rotas da API | Comentários explicativos no código |
| Nomes de ficheiros de código | **Mensagens de commit** |
| Segmentos de rota do frontend (URL) | Descrições de PR e issues |
| Prefixos de commit (`feat:`, `fix:`) e palavras-chave do GitHub (`Closes`) | Texto da UI (via i18n quando há `i18n`) |

**Código sempre em inglês.** Tudo o que é escrito para uma pessoa ler, em português. Um
identificador citado numa frase fica em inglês, porque é o nome real da coisa: "corrige o
scoping de `OrderRepository`", não "do Repositório de Encomendas".

**Porquê**: evita `negocio_id` ao lado de `getName()`, casa com frameworks e bibliotecas (todas em
inglês) e mantém o código legível para qualquer developer.

## Segmentos de rota (URL)

Sempre em inglês, **incluindo quando se aninham debaixo de um segmento antigo em português**.
Um projeto que herdou segmentos em português mantém-nos por continuidade, mas não os estende:
`/empreendimentos/:id/budget`, não `/empreendimentos/:id/orcamento`. Misturar idiomas dentro
da mesma funcionalidade é pior do que uma mistura já existente entre funcionalidades.

## Formas

| Coisa | Forma | Exemplo |
|---|---|---|
| Tabela | `snake_case`, singular ou plural — **decidir no ADR de stack e manter** | `order_item` |
| Coluna | `snake_case` | `created_at`, `business_id` |
| Classe / tipo / componente | `PascalCase` | `OrderService`, `OrderViewDrawer` |
| Método / variável | `camelCase` | `findByIdAndBusinessId` |
| Constante | `UPPER_SNAKE_CASE` | `MAX_PROOF_BYTES` |
| Hook React | `use` + `PascalCase` | `useOrders` |
| Ficheiro de serviço frontend | `camelCase` + `Service` | `orderService.ts` |
| Rota URL | `kebab-case` | `/accept-invite` |
| Código de erro | `MODULE_NNN` | `ORDER_001` |
| Ficheiro de doc | `kebab-case.md` | `backend-conventions.md` |
| Skill (ficheiro do vault) | `skill-<nome>.md` | `skill-add-backend-feature.md` |
| Skill (comando) | `<nome>` sem prefixo | `/add-backend-feature` |

## Vocabulário do domínio

Cada projeto gerado tem um `project-vocabulary.md` com a tabela conceito (PT, como se fala) →
identificador (EN, como está no código). Quando dois termos parecem sinónimos e não são
(ex.: "fatura" = o documento, "despesa" = a afetação desse documento), o vocabulário é o sítio
que o diz — é a confusão que mais tempo custa em conversa.

## Relacionado

[[code-best-practices]] · [[project-vocabulary]] · [[api-design]]
