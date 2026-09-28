# Tokens & Colors

> ✅ Baseado em `frontend/src/index.css`, `theme.ts`, `terminal/xtermTheme.ts`; verificado em Chrome
> headless (estilos computados + screenshot da página `/_tokens`) a 2026-09-28.

> Parte de [[../frontend-visual-consistency]].

**Design: Violeta + Geist** (via Claude Design, handoff de 2026-09-27 →
[[../../../design/handoff-2026-09-27/README|docs/design/handoff-2026-09-27]]). Decisão e alternativas:
[[../../../adr/0008-identidade-visual]].

Só tema **escuro**. Preto azulado, superfícies separadas por luminosidade, **um** acento violeta para
foco/ação. As cores de estado são reservadas aos estados dos terminais — nada mais na moldura usa verde,
âmbar ou vermelho de estado.

## Fonte de verdade

- **`src/index.css`**: as variáveis `--wfa-*` abaixo, **copiadas literalmente** (o handoff gera-as
  a partir de OKLCH em `wfa-tokens.js`, mas o código usa os hex, sem gerador em runtime).
- **`src/theme.ts`**: o tema do Ant Design **espelha** esses valores (§10). Os componentes herdam
  daqui; não se redefine cor de botão/input/tabela por ficheiro.
- **`src/terminal/xtermTheme.ts`**: o `ITheme` do xterm.js (§8), que é o único sítio onde o hex
  aparece em JS, porque o xterm.js não aceita `var(...)`.

**Regra**: qualquer cor/raio/sombra nova vem destes ficheiros. Nunca um hex num `style={{}}`. Usar
`var(--wfa-…)`.

### Tailwind e antd no mesmo CSS

- **Só existem as cores, fontes, raios e sombras dos tokens no Tailwind.** O `index.css` apaga as
  paletas por omissão (`@theme { --color-*: initial; … }`) e expõe os tokens com `@theme inline`:
  `bg-surface-1`, `text-text-3`, `border-border`, `text-accent`, `rounded-md`, `font-mono`,
  `shadow-overlay`… `bg-blue-500` não compila — de propósito.
- **Ordem das camadas**: `@layer theme, base, antd, components, utilities;` antes do `@import
  'tailwindcss'`, e `<StyleProvider layer>` (de `@ant-design/cssinjs`) à volta do `ConfigProvider` em
  `main.tsx`. Sem isto o preflight do Tailwind (sem camada no antd) apaga bordas e margens dos
  componentes do antd. As classes utilitárias abaixo e a pele da tabela vivem em `@layer components`
  — ganham ao antd, perdem para os utilitários do Tailwind.
- Em dev, `/_tokens` mostra os tokens aplicados a componentes do antd (Tooltip, Badge, Radio,
  toasts, tabela…) — o sítio para ver o efeito de uma mudança no `theme.ts`.

## 1. Cores base

```css
--wfa-color-bg: #090911;            /* página e fundo do terminal (elevação 0) */
--wfa-color-surface-1: #101018;     /* lateral, cabeçalhos, drawer (elevação 1) */
--wfa-color-surface-2: #171820;     /* painel em foco, hover, modal (elevação 2) */
--wfa-color-surface-3: #1F2029;     /* item selecionado, trilho das barras */
--wfa-color-border: #2A2B33;        /* hairline */
--wfa-color-border-strong: #40424B; /* inputs, botões secundários, anel dos overlays */
--wfa-color-text-1: #EFF0F6;        /* texto principal */
--wfa-color-text-2: #BBBDC8;        /* secundário */
--wfa-color-text-3: #9799A4;        /* terciário: metadados, pastas, atalhos */
--wfa-color-accent: #A88FFF;        /* foco, ação primária, kicker, links */
--wfa-color-accent-hover: #B9A9FF;
--wfa-color-accent-pressed: #9379E7;
--wfa-color-accent-subtle: #27223C; /* fundo de item escolhido (rádio, filtro, pasta) */
--wfa-color-accent-border: #574A86;
--wfa-color-on-accent: #0C0D14;     /* texto sobre accent e sobre error */
--wfa-color-mask: rgba(0,0,0,.62);  /* máscara de drawer/modal */
```

`--wfa-color-divider` (nome do scaffold) = `--wfa-color-border`. Usar `border`.

## 2. Escalas

| Passo | neutral | accent |
|---|---|---|
| 100 | #EFF1FD | #F2F0FF |
| 200 | #D2D3DF | #D4CDFF |
| 300 | #B2B3BF | #B6A4FF |
| 400 | #93949F | #9980EE |
| 500 | #72747E | #795EC9 |
| 600 | #53545E | #5A3CA5 |
| 700 | #393A43 | #411C84 |
| 800 | #22232C | #2B0063 |
| 900 | #12131B | #19003F |

⚠️ **Tema escuro: 100 é claro, 900 é escuro.** Texto sobre o fundo só com 100–400 (o `accent-700`
sobre `bg` dá 1.6:1). Os passos 600–900 servem para fundos e bordas. Para texto de acento usa-se
`--wfa-color-accent`.

## 3. Semânticas e estados

```css
--wfa-color-success: #6AD18A;
--wfa-color-warning: #EEA743;   /* também: quota perto do limite */
--wfa-color-error: #FF958D;     /* também: fundo do botão destrutivo, com on-accent por cima */
--wfa-color-info: #64C1FF;
```

**Estados do terminal**: cor **e forma**, nunca só cor.

| Estado | Token | Hex | `-subtle` (fundo) | `-border` | Forma |
|---|---|---|---|---|---|
| A trabalhar | `--wfa-state-work` | #60DB89 | #0F2817 | #26673C | arco (anel com um quarto aberto) que roda devagar (1.4s linear ∞) |
| À tua espera | `--wfa-state-wait` | #FFB755 | #2E1E07 | #784E0D | losango cheio |
| Terminado | `--wfa-state-stop` | #9697A1 | #212123 | #57585D | quadrado vazio |
| Erro / desligado | `--wfa-state-err` | #FC6661 | #371715 | #8C3B37 | ✕ |

- **A correr** (MVP, sem os estados "a trabalhar"/"à tua espera" — spec Terminais §2): ponto cheio 8 px em
  `accent` (`.state-icon.is-run`) e tag `.tag-run` (`accent` / `accent-subtle` / `accent-border`). Forma
  própria: círculo cheio ≠ quadrado vazio de terminado/parado. Os estados de trabalho acima ficam para a
  segunda fase.
- Tag de estado: texto na cor do estado, fundo `-subtle`, borda `-border`, raio `sm`, altura 22.
- Um terminal **escondido** que passa a "À tua espera" ganha fundo `-subtle` + borda `-border` na
  lista, e um losango ao lado de "Terminais" na navegação de topo.
- **Maturidade da biblioteca** (✅/🟡/📋) vira tag com forma: ✓ `success` "Provado" · meio círculo
  `warning` "Parcial" · quadrado tracejado `text-2` "Rascunho". Os emoji ficam só no markdown.

## 4. Tipografia: Geist

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&display=swap">
```

```css
--wfa-font-display: 'Geist', sans-serif;
--wfa-font-sans: 'Geist', sans-serif;
--wfa-font-mono: 'Geist Mono', monospace;   /* a do terminal; zero cortado */
--wfa-display-case: none;
--wfa-display-tracking: -0.02em;
```

| Nível | Tamanho / altura | Peso | Notas |
|---|---|---|---|
| display | 28 / 34 | 600 | título de página; `letter-spacing: var(--wfa-display-tracking)` |
| title | 20 / 26 | 600 | título de drawer |
| title-sm | 16 / 24 | 600 | secções dentro de um drawer |
| body | 14 / 21 | 400 | |
| body-sm | 13 / 18 | 400–500 | tabelas; botões 13.5 |
| caption | 12 / 16 | 400 | |
| kicker | 11 / 16 | 600 | maiúsculas, `letter-spacing: .12em`, cor `accent` |
| mono (terminal) | 13 / 19 | 400 | xterm `fontFamily: 'Geist Mono'`, `fontSize: 13`, `lineHeight: 1.46` |
| mono-sm | 11.5 / 16 | 400 | pastas, atalhos, datas |

Nomes de terminal, pastas, nomes de stacks e atalhos de teclado usam **mono**.

## 5. Espaçamento e raios

```css
--wfa-space-0-5: 2px;  --wfa-space-1: 4px;   --wfa-space-2: 8px;   --wfa-space-3: 12px;
--wfa-space-4: 16px;   --wfa-space-5: 20px;  --wfa-space-6: 24px;  --wfa-space-8: 32px;
--wfa-space-10: 40px;  --wfa-space-12: 48px;
--wfa-radius-sm: 3px;  /* tags, botões pequenos, kbd */
--wfa-radius-md: 5px;  /* botões, inputs, itens de lista */
--wfa-radius-lg: 8px;  /* cartões da grelha, modais, toasts */
```

## 6. Elevação e sombras

A elevação faz-se **por luminosidade**. A sombra só aparece em overlays.

| Nível | Superfície | Uso |
|---|---|---|
| 0 | `bg` | página, terminal |
| 1 | `surface-1` | lateral, cabeçalhos, drawer |
| 2 | `surface-2` (+ `shadow-1`) | painel em foco, hover |
| 3 | `surface-2` + `shadow-overlay` | modal, toast, menu |

```css
--wfa-shadow-1: 0 1px 2px rgba(0,0,0,.5);
--wfa-shadow-overlay: 0 24px 64px rgba(0,0,0,.6), 0 0 0 1px #40424B;
```

## 7. Movimento

```css
--wfa-dur-fast: 120ms;   /* hover, tags, foco de itens */
--wfa-dur-base: 180ms;   /* separadores, toasts, máscara */
--wfa-dur-slow: 260ms;   /* drawer a deslizar */
--wfa-ease-standard: cubic-bezier(.2,0,0,1);  /* entradas */
--wfa-ease-exit: cubic-bezier(.4,0,1,1);      /* saídas */
```

A única animação contínua é o arco "a trabalhar". Com **`prefers-reduced-motion`**, não há deslizes
nem rotação: o arco fica parado e os drawers aparecem por opacidade.

## 8. Tema do terminal (xterm.js)

O fundo do terminal **é** o `--wfa-color-bg`: o terminal funde-se com a página e a moldura sobe um nível.

```ts
export const xtermTheme: ITheme = {
  background: "#090911", foreground: "#DDDDE3", cursor: "#A88FFF", cursorAccent: "#090911",
  selectionBackground: "#3E365C",
  black: "#82849A", red: "#F66D67", green: "#5FD37F", yellow: "#F1CA47",
  blue: "#6AA7F4", magenta: "#DF7FD7", cyan: "#44D4E2", white: "#CFD0DC",
  brightBlack: "#9DA0B6", brightRed: "#FF958D", brightGreen: "#82EC9C", brightYellow: "#FFE47C",
  brightBlue: "#91C1FF", brightMagenta: "#F0A1E9", brightCyan: "#80EBF7", brightWhite: "#F5F6FC",
};
```

Os mesmos valores existem em CSS como `--wfa-ansi-*` (`black` … `bright-white`) e `--wfa-term-bg/-fg/
-cursor/-selection`, para blocos mono fora do xterm.js (ex.: a estrutura de pastas num manifesto). O
`black` do ANSI é propositadamente cinzento (5.4:1), porque a TUI usa-o como texto.

## 9. Contraste verificado (WCAG, 2026-09-27)

| Par | Rácio | | Par | Rácio |
|---|---|---|---|---|
| text-1 / bg | 17.4 | | on-accent / accent | 7.4 |
| text-2 / bg | 10.6 | | on-accent / accent-pressed | 5.7 |
| text-3 / bg | 7.0 | | on-accent / error (botão destrutivo) | 9.2 |
| text-3 / surface-1 | 6.7 | | text-1 / accent-subtle | 13.4 |
| text-3 / surface-3 | 5.7 | | success · warning · error · info / surface-1 | 10.0 · 9.2 · 9.0 · 9.6 |
| accent / bg | 7.6 | | state work · wait · stop · err / `-subtle` | 9.0 · 9.3 · 5.5 · 5.6 |
| accent / surface-2 | 6.8 | | term-fg / term-bg | 14.7 |
| 16 ANSI / term-bg | ≥ 5.4 | | laranja Claude `#D97757` / term-bg | 6.4 |

Todos os pares de texto ≥ 4.5:1 (AA). Mínimo: estados stop/err sobre o próprio `-subtle`, 5.5.

## 10. Espelho: `theme.ts`

```ts
import { theme as antdTheme, type ThemeConfig } from "antd";

export const theme: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: "#A88FFF",
    colorSuccess: "#6AD18A",
    colorWarning: "#EEA743",
    colorError: "#FF958D",
    colorInfo: "#64C1FF",
    colorTextLightSolid: "#0C0D14",   // texto sobre primary/error = on-accent
    colorBgBase: "#090911",
    colorBgLayout: "#090911",
    colorBgContainer: "#101018",
    colorBgElevated: "#171820",
    colorBorder: "#40424B",
    colorBorderSecondary: "#2A2B33",
    colorText: "#EFF0F6",
    colorTextSecondary: "#BBBDC8",
    colorTextTertiary: "#9799A4",
    colorBgMask: "rgba(0,0,0,.62)",
    borderRadius: 5, borderRadiusSM: 3, borderRadiusLG: 8,
    fontFamily: "'Geist', sans-serif",
    fontFamilyCode: "'Geist Mono', monospace",
    fontSize: 14,
    motionDurationFast: "0.12s", motionDurationMid: "0.18s", motionDurationSlow: "0.26s",
    motionEaseOut: "cubic-bezier(.2,0,0,1)",
  },
};
```

O `theme.ts` real tem **mais do que isto**, por duas coisas vistas no browser a 2026-09-28:

- 🐛 **O `darkAlgorithm` do antd 6 reescreve as cores de marca.** Trata `colorPrimary` como semente e
  deriva o primário final: `#A88FFF` saía `#927DDC`, `#FF958D` saía `#DC827B` — botões, switch e radio
  fora dos tokens. → `algorithm: [darkAlgorithm, pinBrandColors]`: um segundo passo repõe
  `colorPrimary*` (hover/active/bg/border/text com `accent-hover/-pressed/-subtle/-border`) e
  `colorSuccess/Warning/Error/Info` exatos. **Nunca tirar esse passo.**
- ⚠️ **`colorTextLightSolid` escuro**: certo no botão primário, no destrutivo, no Badge e no Radio
  sólido (texto `on-accent` sobre violeta/`error`). **Errado no Tooltip**, que o usa como cor do texto
  sobre `colorBgSpotlight` (um azul derivado `#2A2A75`) — ilegível. → `colorBgSpotlight` = `surface-3`
  e `components.Tooltip.colorTextLightSolid` = `text-1`. Um componente novo que use o token sobre um
  fundo escuro precisa do mesmo override.
- `components.Modal`: título 18/24 ([[drawers-and-modals]] → Confirmações).

## Classes utilitárias

- Card (`.card`, `-title`, `-kicker`, `-body`, `-meta`): `surface-1`, borda `border`, raio `lg`.
- Tags: de estado (`.tag-work`, `.tag-wait`, `.tag-stop`, `.tag-err`, ver §3), de maturidade
  (`.tag-ok`, `.tag-mid`, `.tag-draft`) e neutra (`.tag`: `surface-2` + `border` + `text-2`, para
  tecnologias).
- Ícone de estado: `.state-icon.is-run|is-work|is-wait|is-stop|is-err` (forma + cor, §3); tags `.tag-run|tag-work|tag-wait|tag-stop|tag-err`.
- Atalho de teclado: `.kbd` (mono 10.5, `text-3`, borda `border`, raio `sm`).
- Elevação: `.elev-1/2/3` (§6).

Antes de escrever estilo novo, verificar se uma destas resolve.

## Pele global da tabela

Definida uma vez em `index.css` sobre `.ant-table`: fundo transparente; cabeçalho 12 px peso 500 em
`text-3` (sem maiúsculas); linhas de 52 px separadas por hairline `border`; hover `surface-2`; linha
selecionada `surface-2`. **Nunca** redefinir cor de tabela por ficheiro.

## Drift encontrado — não repetir

_Nenhum ainda._ Candidatos típicos a vigiar: o azul por omissão do AntD (`#1890ff`) escrito à mão
por cima do tema; `accent-600…900` usados como cor de texto; uma cor de estado usada fora de um
estado; paletas locais (`const D = {...}`) com hex.

## Relacionado

[[cards]] · [[tables-and-lists]] · [[buttons-and-icons]] · [[app-shell-and-auth]]
