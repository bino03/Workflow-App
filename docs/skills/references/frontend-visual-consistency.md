# Consistência visual e estrutural do frontend (router)

> 🚧 Convenção prospetiva — ainda sem código neste projeto que a valide.

> No projeto gerado este ficheiro vira `docs/skills/references/frontend-visual-consistency.md`, e os
> sub-ficheiros vão para `docs/skills/references/design/`. Com mais do que um frontend, cada
> sub-ficheiro ganha o prefixo da app (`backoffice-tables-and-lists.md`, `portal-…`).

**Não é uma skill** — é o ponto de entrada que qualquer skill lê antes de escrever UI, para decidir
qual sub-ficheiro é relevante. Os padrões de UX por trás estão em [[../../../frontend/ux-patterns]].

> 🚧 **Estado: prospetivo.** Estas convenções foram trazidas do Worksite pelo Workflow e ainda não
> há código neste projeto que as valide. Cada sub-ficheiro tem a secção "Drift encontrado" vazia. À
> medida que as páginas nascem, o topo de cada sub-ficheiro passa a dizer "baseado em
> `<ficheiros>`, auditado em `<data>`".

---

## Qual sub-ficheiro cobre o que vais construir?

Lê **só** o(s) da área que estás a tocar.

| Vais construir/editar… | Lê |
|---|---|
| Cores, sombras, raios, tipografia | [[design/tokens-and-colors]] |
| Um card / secção com cabeçalho | [[design/cards]] |
| Um Drawer ou Modal | [[design/drawers-and-modals]] |
| Uma tabela/lista (colunas, ações, estado, pesquisa, paginação) | [[design/tables-and-lists]] |
| Botões, confirmação de ações destrutivas, ícones | [[design/buttons-and-icons]] |
| Um formulário (campos, validação, submit, erros por campo) | [[design/forms-and-validation]] |
| Uma chamada à API, serviço novo, tratamento de erro | [[design/services-and-error-handling]] |
| Uma rota, item de menu, gate por role | [[design/app-shell-and-auth]] |
| Separadores tipo browser (esconder, não fechar) | [[design/browser-tabs]] |
| Grelha com estilos/arranjos escolhíveis, lugares fixos e "+" vazio | [[design/grid-styles]] |

## Princípios

1. **Nunca um hex novo** se já existe um token (`--wfa-*` / `theme.ts`) com esse valor ou perto.
2. **Nunca reimplementar um padrão que já existe** como classe ou componente partilhado.
3. **Nunca estilizar por manipulação imperativa do DOM** (`onMouseEnter` a escrever `style`).

## Relacionado

[[code-best-practices]] · [[skill-frontend-design-system]] · [[skill-frontend-error-handling]] · [[project-vocabulary]]
