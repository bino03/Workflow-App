# Serviços e tratamento de erros

> 🚧 Convenção prospetiva — ainda sem código neste projeto que a valide.

> Parte de [[../frontend-visual-consistency]]. O padrão completo: [[skill-frontend-error-handling]].

## 1. Espelho 1:1 do enum do backend

`errors/errorMessages.ts` tem uma entrada por código do `ErrorCode` do backend, com a **mesma
string** (`'ORDER_001'`), agrupada por módulo pela mesma ordem. Código sem entrada cai no `DEFAULT`
— é um buraco a tapar. O mapeamento faz parte do checklist da feature, não é "para depois".

> Ao comparar os dois ficheiros por grep de `[A-Z]+_[0-9]+`, classificações por prefixo
> (`startsWith('USER_02')`) aparecem como falsos positivos.

## 2. `ErrorHandler.handle()` em todo o `catch`

Não é opcional nem só para casos complexos. `message.error('…')` com string fixa ignora o
`errorCode` — não é o padrão. `catch` só com `console.error` deixa o utilizador sem nada.

🐛 **`try { … } finally { setLoading(false) }` sem `catch`** à volta de uma chamada à API é bug: o
spinner pára, parece sucesso, e o erro sobe como promise rejeitada não tratada.

### Quem notifica — o handler primeiro, o interceptor só se ninguém o fizer

- **O interceptor global nunca mostra `apiError.message`** — passa sempre pelo mapa PT.
- **`ErrorHandler.handle()` reclama o erro**: marca-o (`Symbol.for("<app>.errorHandled")`), mesmo com
  `showNotification: false` — chamar o handler é assumir o erro, incluindo a decisão de o calar.
- **O interceptor adia um tick** (`setTimeout(…, 0)`) e cala-se se o erro já tem dono (o `catch` do
  componente corre numa microtask, portanto já passou).
- **Erros de rede** (sem `response`) notificam de imediato.

## 3. Camada de serviços

- **Uma instância Axios** (`@/api`). Nunca uma segunda.
- **Um serviço por domínio.**
- **Funções nomeadas**, uma por operação — não um objeto único exportado (`export const orderService = {…}`).
- **Sem `try/catch`** a engolir erros. Exceções legítimas e documentadas: `JSON.parse` de sessão
  guardada; logout que limpa a sessão local mesmo se a chamada falhar.

```ts
// services/orderService.ts
import api from "@/api";
import { normalizeSpringPage } from "@/utils/springPage";

export async function getOrders(params: OrderFilters) {
  return normalizeSpringPage<Order>((await api.get("/orders", { params })).data);
}
export async function getOrderById(id: string) { return (await api.get<Order>(`/orders/${id}`)).data; }
export async function createOrder(data: OrderFormValues) { return (await api.post<Order>("/orders", data)).data; }
export async function deleteOrder(id: string) { await api.delete(`/orders/${id}`); }
```

## 3.1 Páginas

```ts
type SpringPageMeta = { size: number; number: number; totalElements: number; totalPages: number };
type WrappedPageResponse<T> = { content: T[]; page: SpringPageMeta };
```

**Uma** função `normalizeSpringPage<T>()` em `utils/springPage.ts`, que aceita a forma embrulhada e a
plana. Nunca uma segunda cópia do tipo. `number` é 0-based.

## 4. Toasts — um canal

`services/general/notificationService.tsx` (wrapper do `notification` do AntD) é o canal único; o
`ErrorHandler` usa-o. Não misturar com `message.*` do AntD para o mesmo tipo de evento.

## Drift encontrado — não copiar

_Nenhum ainda._

## Relacionado

[[skill-frontend-error-handling]] · [[app-shell-and-auth]] · [[forms-and-validation]]
