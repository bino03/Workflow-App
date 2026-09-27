# Skill: Frontend Error Handling

**When to use**: qualquer componente que chama a API; qualquer código de erro novo no backend.

**Time**: ~15 min por feature

> 📐 Lê primeiro [[error-model]]. ⚠️ **Os códigos nascem no backend** (`ErrorCode.java` ou equivalente),
> nunca no frontend. Esta skill só **espelha**. Se o caso ainda não tem código, cria-o primeiro com
> `add-backend-feature` (não incluída — backend 📋 sem skills).

---

## Estrutura

```
src/errors/
├── error.types.ts     ← tipos da resposta de erro, ErrorConfig; enums de conveniência (opcionais)
├── errorMessages.ts   ← ERROR_MESSAGES: código → mensagem PT (fonte de verdade, 1:1 com o backend)
└── errorHandler.ts    ← ErrorHandler.handle() + marca de "erro tratado"
```

## Step 1: Confirmar o código no backend

Existe no enum? Se não, criá-lo lá primeiro (no bloco do módulo, depois de procurar um equivalente).

## Step 2: Mapear para mensagem

```ts
// errors/errorMessages.ts
export const ERROR_MESSAGES: Record<string, string> = {
  // ── Orders ─────────────────────────────
  'ORDER_001': 'Encomenda não encontrada. Pode ter sido removida.',
  'ORDER_002': 'Esta encomenda já existe.',
  // …
  'DEFAULT': 'Ocorreu um erro. Por favor, tente novamente.',
};

export function getUserFriendlyMessage(errorCode?: string): string {
  return (errorCode && ERROR_MESSAGES[errorCode]) || ERROR_MESSAGES['DEFAULT'];
}
```

Mesma string exata do backend (underscore). Agrupado por módulo, pela ordem do enum, para os dois
ficheiros se compararem lado a lado.

## Step 3: O handler centralizado

```ts
// errors/errorHandler.ts
const HANDLED = Symbol.for("workflow-app.errorHandled");
export const wasErrorHandled = (e: unknown) => !!(e as any)?.[HANDLED];

export class ErrorHandler {
  static handle(error: unknown, config: ErrorConfig = {}) {
    const { showNotification = true, notificationType = "error", customMessage } = config;
    if (error && typeof error === "object") (error as any)[HANDLED] = true;   // reclama, mesmo em silêncio

    if (isAxiosError(error)) {
      const data = error.response?.data as ApiErrorResponse | undefined;
      if (data?.fieldErrors?.length) {
        if (showNotification) notificationService.validationError(data.fieldErrors);
        return data;
      }
      const message = customMessage || getUserFriendlyMessage(data?.errorCode);
      if (showNotification) notificationService[notificationType]("Erro", message);
      return data;
    }
    if (showNotification) notificationService[notificationType]("Erro", customMessage || ERROR_MESSAGES.DEFAULT);
    return null;
  }

  static getMessage(error: unknown): string { /* mesma lógica, sem notificar */ }
}
```

- **Nunca mostrar `data.message`** — é contexto para logs.
- `ErrorConfig`: `showNotification`, `notificationType`, `customMessage`. Para calar: `showNotification: false`.
- O interceptor em `api.ts` adia um tick e só notifica se `!wasErrorHandled(error)`; erros de rede
  (sem `response`) notificam logo. Ver [[services-and-error-handling]].

## Step 4: Usar nos componentes

```ts
// lista
setLoading(true);
try {
  setData((await getOrders(filters)).content);
} catch (e) {
  ErrorHandler.handle(e);
} finally {
  setLoading(false);
}

// formulário — erros por campo no próprio form
try {
  await createOrder(values);
} catch (e) {
  const fe = (e as AxiosError<ApiErrorResponse>).response?.data?.fieldErrors;
  fe?.forEach(({ field, message }) => form.setError(field as any, { message }));
  ErrorHandler.handle(e);
}
```

**`try/finally` sem `catch` à volta de uma chamada à API é bug.**

## Step 5: Em hooks de lista

Apanhar, passar ao handler, e guardar `ErrorHandler.getMessage(e)` em estado se a UI mostrar o erro inline.

## Final Checklist

- [ ] O código existe no backend (verificado, não inventado)
- [ ] Entrada em `ERROR_MESSAGES` com a mesma string exata
- [ ] `ErrorHandler.handle()` em todos os `catch` de chamadas à API
- [ ] Nenhum `try/finally` sem `catch`; loading limpo no `finally`
- [ ] `fieldErrors` aplicados ao formulário quando o endpoint tem validação
- [ ] `showNotification: false` só onde há UI própria para o erro
- [ ] Testado com erros reais (não só o caminho feliz)

## Related Skills

[[error-model]] · [[skill-frontend-design-system]] · `add-backend-feature` (não incluída — backend 📋 sem skills)
