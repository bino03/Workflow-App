# Desenho de APIs HTTP

**When to use**: antes de escrever um endpoint novo — a "Fase 0" de qualquer feature de backend.

---

## Fase 0: o contrato antes do código

| Operação | Método | Caminho | Status | Corpo da resposta |
|---|---|---|---|---|
| Listar (paginado) | GET | `/resource` | 200 | página de DTOs |
| Obter por id | GET | `/resource/{id}` | 200 | DTO |
| Criar | POST | `/resource` | **201** | DTO |
| Substituir | PUT | `/resource/{id}` | 200 | DTO |
| Atualizar parcialmente | PATCH | `/resource/{id}` | 200 | DTO |
| Apagar | DELETE | `/resource/{id}` | **204** | vazio |
| Ação de negócio | POST | `/resource/{id}/action` | 200/204 | conforme |
| Sub-recurso | GET/POST | `/resource/{id}/sub` | conforme | conforme |

Responder também, antes de escrever:
- **Quem pode chamar cada operação?** (roles, ownership) — ver padrão `roles-and-permissions` do Workflow — não incluído, sem roles
- **A lista precisa de filtros?** (`?q=`, `?status=`) e de que ordenação por omissão?
- **Devolve ficheiros?** → só URLs assinadas, geradas na leitura (padrão `file-storage` do Workflow — não incluído, sem ficheiros)
- **Que códigos de erro novos?** → [[error-model]], procurando primeiro os que já existem

Só se criam os métodos que a tabela marcou. Sem stubs vazios.

## Regras

1. **DTOs de pedido separados dos de resposta.** Um DTO de criação não tem `id`, `createdAt`,
   nem campos que o servidor calcula. Para `PATCH`, campos opcionais onde "ausente" = "não mexer".
2. **Nunca devolver entidades de persistência** diretamente — sempre um DTO de resposta. Evita
   expor campos sensíveis e rebentar lazy-loading fora de sessão.
3. **Validação à entrada** (anotações no DTO, ou equivalente), e o frontend nunca é mais
   permissivo do que o backend.
4. **Nomes de recursos em inglês, `kebab-case`, no plural quando é coleção** — ver
   [[naming-conventions]].
5. **Paginação com forma estável e documentada.** Se o framework mudar a forma da página (ex.:
   `{content, page:{…}}` vs. plana), o frontend tem **um** normalizador partilhado — nunca uma
   cópia do tipo por lista. Atenção à base do índice (0 no servidor vs. 1 na UI).
6. **Na lista, o mínimo; no detalhe, o completo.** Assinar 20 URLs de documentos numa página
   que ninguém abre é trabalho deitado fora — a lista leva a miniatura, o detalhe leva o resto.
7. **Timestamps em ISO 8601 com fuso**, nunca epoch num payload.
8. **Compressão HTTP ligada** quando as respostas repetem muito os nomes de campo (árvores,
   listas grandes) — muitos frameworks trazem-na desligada por omissão.

## Tipos partilhados

Quando o contrato atravessa linguagens (backend ↔ frontend TS), o único elo que o compilador
não verifica é a interface TypeScript escrita à mão. Regra: **mudar o tipo do backend e a
interface TypeScript no mesmo commit, sempre.** Onde a stack o permite (um crate/pacote de
contrato partilhado, geração de tipos a partir de OpenAPI), preferir isso.

## Documentar

Todo o endpoint novo ou alterado entra em `docs/api.md` no mesmo commit: rota, método, quem
acede, corpo, erros. O hook de pre-commit avisa quando um controller ganha mapeamentos, mas a
tabela escreve-se à mão.

## Relacionado

[[error-model]] · [[security-baseline]] · [[data-modeling]]
