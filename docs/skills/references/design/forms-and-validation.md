# Formulários e validação

> 🚧 Convenção prospetiva — ainda sem código neste projeto que a valide.

> Parte de [[../frontend-visual-consistency]]. Regras de base em [[skill-frontend-design-system]] → "Forms".

## 1. Biblioteca: React Hook Form + Zod, sempre

`useForm` + `zodResolver`. Nada de `Form.useForm()` do AntD em código novo (os dois a competir por
domínio foi o drift principal de um projeto real). Exceção documentada: um card que fala com
vários endpoints em passos (ex.: galeria de ficheiros com upload imediato + guardar diferido) pode
ter estado local — escrevendo porquê.

```ts
// components/order/create/orderFormSchema.ts
import { z } from "zod";
const SAFE_TEXT = /^[\p{L}\p{N}\s.,'-]+$/u;

export const OrderFormSchema = z.object({
  name: z.string().min(1, "order.formErrors.nameRequired").max(120).regex(SAFE_TEXT, "common.formErrors.invalidChars"),
  total: z.number().positive("order.formErrors.totalPositive").max(1_000_000_000),
  notes: z.string().max(2000).optional(),
});
export type OrderFormValues = z.infer<typeof OrderFormSchema>;
```

## 2. Mensagens do Zod: chaves i18n

Mensagem de Zod é **chave i18n**, renderizada com `t(...)`. Uma string fixa é um buraco de tradução
silencioso.

## 3. Submit

```tsx
const form = useForm<OrderFormValues>({ resolver: zodResolver(OrderFormSchema), mode: "onChange", defaultValues });
const { formState: { isValid, isSubmitting } } = form;

<Button onClick={onClose} disabled={isSubmitting}>{t("common.cancel")}</Button>
<Button type="primary" htmlType="submit" loading={isSubmitting} disabled={!isValid}>{t("common.save")}</Button>
```

`mode: "onChange"` é necessário para `isValid` atualizar enquanto se escreve.

## 4. Erro por campo — um componente partilhado

`components/common/FieldError.tsx`, com `<Text type="danger">` e o `t(...)` num sítio só:

```tsx
<FieldError name="name" errors={form.formState.errors} />
```

Nunca o bloco `{errors.x && <p style={{...}}>}` copiado campo a campo.

Erros de validação vindos da API (`fieldErrors`): no `catch`, `form.setError(field, { message })`
para cada um, além do `ErrorHandler.handle(e)`.

## 5. Criar e editar partilham secções

Quando os campos são os mesmos, o editar reutiliza as secções do criar dentro de um `FormProvider`
próprio, com `Schema.pick({...})` a recortar os campos. Diferenças de comportamento entram como
props das secções (ex.: `showActiveToggle`), com o valor por omissão = comportamento do criar.

## 6. Antes de escrever o schema — perguntar

- Campos obrigatórios no backend → `.min(1)` sem perguntar.
- **Só** os opcionais no backend: "passa a obrigatório só na UI?"
- Visibilidade por role de cada campo.

## Drift encontrado — não copiar

_Nenhum ainda._ Vigiar: mensagens de erro em cor neutra; schemas com enums reutilizados de outro
campo (validam o que não devem); `Form.useForm()` do AntD a competir com RHF.

## Relacionado

[[drawers-and-modals]] · [[services-and-error-handling]] · [[cards]]
