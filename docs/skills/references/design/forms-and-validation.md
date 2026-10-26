# Formulários e validação

> 🚧 Parcialmente validada: `FieldError` e o login (`pages/login/`) existem e foram verificados a
> 2026-09-28. §4.1 (zona de arrastar ficheiros) e um drawer com RHF + Zod e campos que mudam com uma escolha
> baseiam-se em `components/library/ImportDrawer.tsx` — **verificado em Chrome headless a 2026-10-25**.

> Parte de [[../frontend-visual-consistency]]. Regras de base em [[skill-frontend-design-system]] → "Forms".

## 1. Biblioteca: React Hook Form + Zod, sempre que há validação no cliente

`useForm` + `zodResolver`. Nada de `Form.useForm()` do AntD em código novo (os dois a competir por
domínio foi o drift principal de um projeto real). Sem campos com regras de validação no cliente (ex.: um drawer com uma escolha e um ficheiro, cuja validade só
o servidor decide) não há esquema a escrever: estado local e botão `disabled`, com o porquê num comentário.
Outra exceção documentada: um card que fala com
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

## 2. Mensagens do Zod: texto PT direto

**Neste projeto não há i18n** ([[../../../adr/0007-omissoes-do-frontend]]): a mensagem do Zod é o
texto final em pt-PT, no tom da app ("Escreve a password."), e o `FieldError` mostra-a tal como está.
Os `t(...)` dos exemplos abaixo vêm da stack e não se aplicam.

## 2.1 Campos do antd: `Controller`, nunca `register`

🐛 `{...form.register('x')}` num `<Input>` do antd **não liga**: o `ref` do antd é um `InputRef`, não o
elemento DOM, e o RHF nunca lê o valor — o campo parece funcionar, mas a validação vê sempre `''`
(visto a 2026-09-28 na `/_tokens`). Todo o campo do antd vai por
`<Controller name control render={({ field }) => <Input {...field} />} />`.

## 3. Submit

```tsx
const form = useForm<OrderFormValues>({ resolver: zodResolver(OrderFormSchema), mode: "onChange", defaultValues });
const { formState: { isValid, isSubmitting } } = form;

<Button onClick={onClose} disabled={isSubmitting}>{t("common.cancel")}</Button>
<Button type="primary" htmlType="submit" loading={isSubmitting} disabled={!isValid}>{t("common.save")}</Button>
```

`mode: "onChange"` é necessário para `isValid` atualizar enquanto se escreve.

## 4. Erro por campo — um componente partilhado

`components/common/FieldError.tsx` (✅): texto em `error` com `✕` à frente (forma, não só cor),
13/18, com altura reservada para o formulário não saltar quando o erro aparece:

```tsx
<FieldError id="name-error" name="name" errors={form.formState.errors} />  // erro do Zod (aceita "a.b")
<FieldError id="password-error" message={submitError} />                  // erro que não vem do schema
```

O `id` liga-se ao campo por `aria-describedby`. O login usa a segunda forma para o erro da API.

Nunca o bloco `{errors.x && <p style={{...}}>}` copiado campo a campo.

Erros de validação vindos da API (`fieldErrors`): no `catch`, `form.setError(field, { message })`
para cada um, além do `ErrorHandler.handle(e)`.

## 4.1 Zona de arrastar ficheiro (2026-09-30)

Nasceu do upload de skills (2026-09-30, entretanto substituído) e vive hoje em
`components/library/ImportDrawer.tsx` ([[../../../features/importar-para-a-biblioteca|importar-para-a-biblioteca]]
passo 9), com **vários** ficheiros (`multiple`) e uma **pasta** por um segundo `<input>` com `webkitdirectory`
(aberto por um `Button type="link"` por baixo da zona — arrastar uma pasta não traz os ficheiros de dentro).
O caminho relativo de cada ficheiro (`webkitRelativePath`, senão o nome) vai no corpo JSON, não no nome da parte.
Os limites (quantos, quanto pesam no total) mostram-se num `FieldError` por baixo e desativam o envio.
**Não usar o `Upload` do antd** — traz
lista de ficheiros e pedido próprios, e aqui o envio é um `POST` do serviço do domínio.

- Um `<button type="button">` a ocupar a largura toda, com `border border-dashed border-border`,
  `bg-surface-2`, `rounded-md`, `px-4 py-7`, conteúdo centrado. Sendo um botão a sério, chega-se lá por
  teclado e o `disabled` funciona sem código extra.
- **A arrastar** (`onDragOver`): `border-accent` + `bg-surface-3`. Em repouso: `hover:bg-surface-3`.
  `onDragOver` e `onDrop` têm de chamar `preventDefault()`, senão o browser abre o ficheiro.
- O `<input type="file">` fica escondido (`className="hidden"`) e é aberto pelo `onClick` do botão.
  No fim do `onChange`, `event.target.value = ''` — sem isso, escolher **o mesmo** ficheiro outra vez
  não dispara o evento.
- Escolhido: mostra só **nome** (mono) e **tamanho**, nunca uma pré-visualização do conteúdo, mais um
  "Escolher outros" em `text-accent`. Os limites aparecem no texto de repouso ("até 200 ficheiros, 10 MB").
- **Erro do backend dentro do drawer**, não em toast: `Alert` `type="error"` com a mensagem mapeada em
  `title` e os `fieldErrors` numa `<ul>` no `description` — o ficheiro escolhido não se perde e o
  utilizador vê o erro ao lado do que o causou. O serviço marca `skipErrorNotification: true` para o
  interceptor não notificar por cima ([[services-and-error-handling]]).
- Sem React Hook Form quando o "formulário" é só um `Select` e um ficheiro: não há nada para validar do
  lado do cliente além de "os dois escolhidos" (o botão fica `disabled`), porque o que torna o ficheiro
  válido está *dentro* dele e quem decide é o backend.
- Todo o fecho do drawer (Cancelar, ✕, `Esc`, máscara, sucesso) passa por **uma** função que limpa o
  estado antes de chamar o `onClose` do pai — nunca um `useEffect` no `open` (o ESLint deste projeto
  recusa `setState` síncrono dentro de um efeito: `react-hooks/set-state-in-effect`).

## 4.2 Texto colado e edição de um documento (2026-10-26)

Base: `components/upwork/{NewApplicationDrawer,ProfileDrawer}.tsx`, verificados em Chrome headless.

- **Texto colado de fora** (um anúncio, uma descrição, uma resposta na conversa) que vai para ficheiros de uma
  sessão e nunca para uma linha de comando: **só `max`**, sem a lista branca de caracteres da regra 6 — um anúncio
  traz "$50/hr", código com `{}`, `<` e `>`. O mesmo que a descrição do Novo projeto e a `ReplyBox` já faziam.
  Escrever o porquê ao lado do schema.
- **Lista "uma por linha"** (perguntas de triagem): um `TextArea` só, partido em linhas não vazias ao enviar; os
  limites (quantas, tamanho de cada) validam-se no schema sobre essas linhas.
- **Drawer que edita um documento já carregado** (o perfil): `useForm({ values })` com o que a página tem — o
  formulário segue o documento sem efeito nenhum; `close()` faz `reset(values)`, e o que não se gravou perde-se.
  "Gravar" desativado enquanto nada mudou (`isDirty`), exceto quando o que está é o modelo inicial ainda por gravar.
- Um erro do backend que **pede outro drawer** (`UPWORK_002`, sem perfil): `showNotification: false`, e o outro
  abre **por cima** — o que se colou no primeiro fica.

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
