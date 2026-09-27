# Skill: Follow Frontend Design System

**When to use**: construir qualquer componente de UI no Workflow App.

**Time**: parte da criação do componente

> 📐 Lê primeiro [[code-best-practices]] (princípios gerais) e [[frontend-visual-consistency]] — é um
> router: diz qual sub-ficheiro de `design/` ler para a área que vais tocar. **Este ficheiro é a casa
> única das regras de frontend.**

---

## Step 0: O design já foi escolhido?

`grep -q 'design:pending' docs/skills/references/design/tokens-and-colors.md`. Se o marcador existe:
**parar**, dizer ao utilizador que o design ainda não foi escolhido e propor `/choose-design`. Só
continuar sem ele se o utilizador disser explicitamente que é um ecrã descartável — e registar em
`notes/refactoring.md` que esse ecrã tem de ser revisto quando o design existir.

## Regras de base (frontend)

1. **Strict mode sempre** — sem `any` sem justificação num comentário.
2. **Naming** → "Naming" abaixo.
3. **Sem `try/catch` nos serviços** — o erro sobe ao componente, que chama o `ErrorHandler` ([[skill-frontend-error-handling]]).
4. **Um ficheiro de serviço por domínio**, funções nomeadas, sem lógica de UI.
5. **Formulários sempre Zod + React Hook Form.**
6. **Texto livre restringe caracteres** (lista branca) e tem `max`; o frontend nunca é mais permissivo
   do que o backend.
7. **Visibilidade de campos por role é sempre perguntada**, e o backend filtra primeiro.
8. **Cores, larguras, tokens e ícones vêm de [[frontend-visual-consistency]]** — nunca inventar.

E uma que não é de código: **testar no browser antes de dar por feito** — type-check e lint não
substituem correr o fluxo real.

## Stack

React + TypeScript strict · Vite · Ant Design 5 · Tailwind 4 · React Hook Form + Zod · React Context
para estado transversal (sem store global) · Axios numa instância única (`src/api.ts`).

## Estrutura de componentes

```
src/components/
├── <domain>/
│   ├── create/
│   │   ├── <domain>FormSchema.ts     ← Zod
│   │   ├── use<Domain>Form.ts        ← hook (se complexo)
│   │   ├── ui/                       ← sub-componentes só usados aqui
│   │   └── Create<Domain>Drawer.tsx
│   ├── edit/Edit<Domain>Card.tsx
│   ├── view/View<Domain>Card.tsx
│   ├── <Domain>List.tsx
│   └── <Domain>ViewDrawer.tsx
└── common/                           ← partilhados (ListActions, SectionCard, FieldError…)
```

## Naming

| Coisa | Forma | Exemplo |
|---|---|---|
| Componentes e ficheiros | PascalCase | `OrderViewDrawer.tsx` |
| Hooks | `use` + … | `useOrders.ts` |
| Serviços | `<domain>Service.ts` | `orderService.ts` |
| Schemas | `<domain>FormSchema.ts` | `orderFormSchema.ts` |
| Tipos | `types/<domain>.ts` → `PascalCase` | `types/order.ts` → `Order` |
| Rotas | `kebab-case`, **em inglês** | `/orders/:id/items` |

Segmento de rota novo sempre em inglês, mesmo aninhado num pai antigo em português.

## Visibilidade de campos por role

Antes de construir uma lista (colunas) ou formulário (campos), **perguntar**: cada campo é visível
para todas as roles, ou só para algumas? Duas camadas:
1. **Backend primeiro** — o DTO não inclui o campo para quem não pode (`permissions-and-auth` (não incluída — sem roles)).
2. **Frontend depois** — condicionar com `useAuth().isAdmin()`, como reforço.

Se o DTO já filtra, isso responde à pergunta para esse campo.

## Forms (React Hook Form + Zod)

**Só perguntar sobre os campos opcionais no backend:**
- Obrigatório no backend (`@NotBlank`/`@NotNull`) → **sempre** `.min(1)` no Zod. Não perguntar.
- Opcional no backend (ou feature nova sem DTO) → perguntar se passa a obrigatório só na UI.
- Nunca relaxar na UI um campo obrigatório no backend.

**Caracteres**: texto livre com lista branca (`/^[\p{L}\p{N}\s.,'-]+$/u`); rejeitar sempre
`< > \` { } $`; email com `z.string().email()`; telefone `/^[\d+\s-]+$/`; texto longo com `.max(N)`;
números com limites explícitos. Mensagens como chaves i18n.

Detalhe (submit, erro por campo, criar/editar partilhados) em [[forms-and-validation]].

## Service layer

```ts
// services/orderService.ts
import api from "@/api";
export async function getOrders(params: OrderFilters) { return (await api.get("/orders", { params })).data; }
export async function createOrder(data: OrderFormValues) { return (await api.post("/orders", data)).data; }
```

Sem `try/catch` — ver [[services-and-error-handling]].

## Erros

```ts
try {
  await createOrder(values);
  notificationService.success(t("order.created"));
} catch (e) {
  ErrorHandler.handle(e);
}
```

## Drawers

Criar/editar/ver uma entidade é um **Drawer**, não uma página nem um Modal. Larguras e estrutura em
[[drawers-and-modals]].

## Estado

- **Lista**: hook local dono do estado (dados, loading, paginação, filtros) — `useOrders()`.
- **Chamada avulsa**: `useApiCall()`.
- **Transversal**: Context (`useAuth()`, `useConfirm()`).
- **Não introduzir uma biblioteca de estado** sem ADR — é decisão de arquitetura.

## Estilo

Ant Design para componentes, Tailwind para estilo próprio, tokens `--wfa-*` para valores.

## Final Checklist

- [ ] Estrutura de pastas segue o padrão; nomes segundo a tabela
- [ ] Perguntada a visibilidade por role; o backend já filtra esses campos
- [ ] Obrigatórios do backend são `.min(1)` sem exceção; só perguntei pelos opcionais
- [ ] Zod com restrição de caracteres em todo o texto livre, e `max`
- [ ] Mensagens de erro de Zod como chaves i18n (se `i18n`)
- [ ] `ErrorHandler.handle()` em todos os `catch`; sem `try/catch` nos serviços
- [ ] Um serviço por domínio, funções nomeadas
- [ ] Drawer para entidades; Modal só para utilitários
- [ ] Sem hex/larguras inventados — tudo de [[frontend-visual-consistency]]
- [ ] Rota de topo nova → item no `AppLayout`
- [ ] **Testado no browser** (ou registado em `notes/verificacao-browser-pendente.md`)
- [ ] Padrão visual novo? → atualizar o sub-ficheiro de `design/` correspondente
- [ ] Porta de entrada nova? → `docs/code-map.md`

## Related Skills

[[code-best-practices]] · [[frontend-visual-consistency]] · [[skill-frontend-error-handling]] · [[skill-frontend-integration-guide]] · `verify-in-browser` (não incluída)
