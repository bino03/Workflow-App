# Tokens & Colors

> 🚧 Convenção prospetiva — ainda sem código neste projeto que a valide.

> Parte de [[../frontend-visual-consistency]].
<!-- design:pending -->
> ⛔ **Design por escolher.** Os tokens abaixo têm só a **estrutura** e valores neutros provisórios.
> **Não construir UI antes de correr `/choose-design`** — um ecrã feito sobre tokens provisórios é
> refeito depois. O marcador `design:pending` neste ficheiro é o que o hook de pre-commit e a skill
> `frontend-design-system` verificam; o `/choose-design` apaga-o.

## Fonte de verdade

- **`src/index.css`** — as variáveis `--wfa-*`:
  - Base: `color-bg`, `color-surface`, `color-text`, `color-divider`
  - Acento: `color-accent`, `color-accent-2`, escalas `accent-100…900`
  - Neutros: `neutral-100…900`
  - Tipografia: `font-heading`, `font-body`
  - Espaçamento: `space-1…8`
  - Sombras: `shadow-sm/md/lg`
- **`src/theme.ts`** — o tema do Ant Design **espelha** esses valores (`colorPrimary`, `colorError`,
  `colorSuccess`, `colorWarning`, `borderRadius`, `fontFamily`). Os componentes herdam daqui — não
  se redefine cor de botão/input/tabela por ficheiro.
- **Espelho em JS** (ex.: `config/tokens.ts` → objeto com os valores literais) só para o caso que não
  aceita `var(...)` (ex.: `stroke` de SVG). Último recurso.

**Regra**: qualquer cor/raio/sombra nova vem destes ficheiros. Nunca um hex num `style={{}}` — usar
`var(--wfa-…)`.

## Valores (🚧 neutros provisórios — o `/choose-design` substitui)

Estrutura das secções de um design da biblioteca do Workflow; valores neutros só para o scaffold não
ficar sem nada.

### 1. Cores base

```css
--wfa-color-bg: #ffffff;       /* 🚧 */
--wfa-color-surface: #f5f5f5;  /* 🚧 */
--wfa-color-text: #1f1f1f;     /* 🚧 */
--wfa-color-text-2: #595959;   /* 🚧 secundário */
--wfa-color-divider: #d9d9d9;  /* 🚧 */
--wfa-color-accent: #595959;   /* 🚧 */
--wfa-color-accent-2: #434343; /* 🚧 hover / variante */
```

### 2. Escalas

🚧 `--wfa-neutral-100 … -900`, `--wfa-accent-100 … -900` — por definir.

### 3. Semânticas

🚧 success / warning / error / info — por definir.

### 4. Tipografia

🚧 Famílias (títulos / corpo / **mono — importante: é a do terminal**) e escala — por definir.

### 5. Espaçamento e raios · 6. Sombras · 7. Movimento

🚧 Por definir.

### 8. Tema do terminal (específico desta app)

🚧 O xterm.js tem o seu próprio tema (`ITheme`: `background`, `foreground`, `cursor`, 16 cores ANSI). A
TUI do Claude Code usa cores ANSI — o tema do terminal tem de ter contraste suficiente em todas elas, e
decide-se com o resto do design.

### 9. Espelho — `theme.ts`

```ts
// 🚧 neutro — substituído pelo /choose-design
export const theme = { token: { colorPrimary: "#595959", borderRadius: 4, fontFamily: "system-ui, sans-serif" } };
```

## Classes utilitárias

Card (`.card`, `-title`, `-kicker`, `-body`, `-meta`), tags de estado (`.tag` + `-accent`, `-neutral`,
`-outline`), elevação (`.elev-sm/md/lg`). Antes de escrever estilo novo, verificar se uma destas resolve.

## Pele global da tabela

Definida uma vez em `index.css` sobre `.ant-table`: fundo transparente, cabeçalhos em maiúsculas
pequenas com `letter-spacing`, linhas separadas por hairline, hover subtil. **Nunca** redefinir cor
de tabela por ficheiro.

## Drift encontrado — não repetir

_Nenhum ainda._ Candidatos típicos a vigiar: o azul por omissão do AntD (`#1890ff`) escrito à mão
por cima do tema; gradientes ad-hoc por cor de estado; paletas locais (`const D = {...}`) com hex.

## Relacionado

[[cards]] · [[tables-and-lists]] · [[buttons-and-icons]]
