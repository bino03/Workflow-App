# Skill: Add Backend Feature (Node + Fastify)

**When to use**: uma rota nova, ou um domínio novo, no backend.

**Time**: ~20-45 min

> 📐 Lê primeiro: [[backend-conventions]] (camadas, erros, validação, guarda, testes) · [[api]] · [[error-model]].
>
> 🟡 A sequência abaixo é a que o projeto de origem seguiu em ~13 domínios; como skill escrita ainda não foi
> seguida. Se um passo não bater com o código, o código ganha — e esta skill corrige-se.

---

## Step 0: Imitar o irmão mais recente

Ler o domínio mais recente com a mesma forma (rotas CRUD, rota com processo, rota pública) e o seu teste.
É o padrão vivo.

## Step 1: O schema — `src/<domínio>/<domínio>.schemas.ts`

```ts
import { z } from 'zod';

/** Mirrored in `frontend/src/types/order.ts`. */
export const createOrderSchema = z.object({
  customerId: z.uuid(),
  notes: z.string().trim().max(2000).optional(),
});
export type CreateOrder = z.infer<typeof createOrderSchema>;
```

Corpo, query e params — cada um com o seu schema. Limites de tamanho sempre.

## Step 2: O serviço — `src/<domínio>/<domínio>Service.ts`

A lógica e o acesso ao estado. Recebe as dependências no construtor; lança `AppError('ORDER_00N')` nos casos
de negócio. Não sabe nada de HTTP.

## Step 3: As rotas — `src/<domínio>/<domínio>.routes.ts`

```ts
export type OrderRoutesOptions = { orderService: OrderService };

export async function orderRoutes(app: FastifyInstance, { orderService }: OrderRoutesOptions): Promise<void> {
  app.post('/api/orders', async (request, reply) => {
    const body = parseWith(createOrderSchema, request.body);
    return reply.status(201).send(await orderService.create(body));
  });
}
```

- Sem `schema:` do Fastify — a validação é o `parseWith`.
- Pública só com `config: { public: true }`, e com o porquê em [[api]].

## Step 4: Registar — `src/app.ts`

Construir o serviço em `buildApp` (ou recebê-lo em `deps`, se os testes o substituírem) e
`await app.register(orderRoutes, { orderService })`.

## Step 5: Erros — `src/common/errors.ts`

Um bloco `ORDER_001…` com status e mensagem. **No mesmo commit**, a mensagem no mapa do frontend (o hook
avisa). Um código retirado nunca se reutiliza.

## Step 6: Teste — `test/<domínio>.routes.test.ts`

- `buildApp({ config: testConfig({ … }), … })` com fakes; login por `inject` para ter o cookie.
- **Sem sessão → 401 `AUTH_002`** (todas as rotas protegidas).
- O caminho feliz e cada erro com o `errorCode` esperado; um corpo inválido → `COMMON_001` com `fieldErrors`.
- Dados e pastas só no tmp (`testEnv`). Se o teste lança processos reais → `PROCESS_TESTS` no
  `vitest.config.ts`.

## Step 7: Documentar e fechar

1. Secção ou linha em [[api]] (método · rota · acesso · corpo · resposta · erros).
2. Tipos em `frontend/src/types/<domínio>.ts`, iguais ao schema.
3. `npm run typecheck && npm run lint && npm test`.

## Final Checklist

- [ ] Schema zod com limites; comentário a dizer o espelho no frontend
- [ ] Serviço sem HTTP; `AppError` nos casos de negócio
- [ ] Rotas com `parseWith`; pública só declarada e justificada
- [ ] Registada em `app.ts` com as dependências por opções
- [ ] `ErrorCode` novo + espelho no frontend, no mesmo commit
- [ ] Teste: 401 sem sessão, caminho feliz, cada erro; nada fora do tmp
- [ ] `docs/api.md` e tipos do frontend
- [ ] typecheck + lint + testes verdes

## Related Skills

[[skill-implement-todo]] · [[skill-run]] · [[skill-frontend-integration-guide]]
