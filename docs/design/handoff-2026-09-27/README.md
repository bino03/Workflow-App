# Workflow App — handoff de design

Protótipos de referência (não código final): `Workflow App.dc.html` (canvas com todas as opções), `Terminais.dc.html`, `Biblioteca.dc.html`. Tokens gerados em `wfa-tokens.js` a partir de OKLCH.

## Direção
Preto profundo, superfícies por luminosidade, um acento para foco/ação. Cores de estado reservadas e sempre acompanhadas de forma:

| Estado | Forma |
|---|---|
| A trabalhar | arco (roda devagar) |
| À tua espera | losango cheio |
| Terminado | quadrado vazio |
| Erro / desligado | ✕ |

Atalhos da app em **Alt+…** (Alt+1–9 saltar, Alt+N novo, Alt+\ dividir, Alt+W fechar, Alt+R renomear). Evitar Ctrl+… (Claude Code / browser) e Ctrl+Alt+… (AltGr em teclado PT).

## Paleta: Gelo
Aço frio, acento gelo. O mais sóbrio: a cor fica quase toda para os estados.

### Cores
| Token | Hex |
|---|---|
| `--wfa-color-bg` | #070B0F |
| `--wfa-color-surface-1` | #0D1216 |
| `--wfa-color-surface-2` | #15191E |
| `--wfa-color-surface-3` | #1D2227 |
| `--wfa-color-border` | #272C31 |
| `--wfa-color-border-strong` | #3E4349 |
| `--wfa-color-text-1` | #EDF0F4 |
| `--wfa-color-text-2` | #B8BEC5 |
| `--wfa-color-text-3` | #949BA1 |
| `--wfa-color-accent` | #7CD6F2 |
| `--wfa-color-accent-hover` | #9FE8FF |
| `--wfa-color-accent-pressed` | #65BFDB |
| `--wfa-color-accent-subtle` | #162A30 |
| `--wfa-color-accent-border` | #2D5D6B |
| `--wfa-color-on-accent` | #090E12 |
| `--wfa-color-success` | #6AD18A |
| `--wfa-color-warning` | #EEA743 |
| `--wfa-color-error` | #FF958D |
| `--wfa-color-info` | #64C1FF |

### Estados do terminal
| Token | Hex | vs surface-1 |
|---|---|---|
| `--wfa-state-work` (A trabalhar) | #60DB89 | 10.8:1 |
| `--wfa-state-wait` (À tua espera) | #FFB755 | 10.9:1 |
| `--wfa-state-stop` (Terminado) | #9399A0 | 6.6:1 |
| `--wfa-state-err` (Erro / desligado) | #FC6661 | 6.5:1 |

Cada estado tem também `-subtle` (fundo) e `-border`: work #0F2817 / #26673C · wait #2E1E07 / #784E0D · stop #202223 / #55585C · err #371715 / #8C3B37

### Escalas
| Passo | neutral | accent |
|---|---|---|
| 100 | #ECF3FA | #DEF7FF |
| 200 | #CED5DC | #8AE3FF |
| 300 | #AFB5BC | #68C3DE |
| 400 | #90969C | #46A3BE |
| 500 | #6F757B | #1B819B |
| 600 | #50565C | #005F75 |
| 700 | #363B41 | #004252 |
| 800 | #20252A | #002934 |
| 900 | #101419 | #00171F |

### Contraste do texto
| Par | Rácio | Nível |
|---|---|---|
| text-1 / bg | 17.3:1 | AAA |
| text-2 / bg | 10.5:1 | AAA |
| text-3 / bg | 7.0:1 | AAA |
| text-2 / surface-2 | 9.4:1 | AAA |
| text-3 / surface-3 | 5.7:1 | AA |
| accent / bg | 12.0:1 | AAA |
| on-accent / accent | 11.8:1 | AAA |
| accent / surface-2 | 10.7:1 | AAA |

### Tema xterm.js (ITheme)
| Cor | Hex | vs background |
|---|---|---|
| black | #7C8894 | 5.5:1 AA |
| red | #F66D67 | 6.9:1 AA |
| green | #5FD37F | 10.4:1 AAA |
| yellow | #F1CA47 | 12.5:1 AAA |
| blue | #6AA7F4 | 7.9:1 AAA |
| magenta | #DF7FD7 | 7.7:1 AAA |
| cyan | #44D4E2 | 11.1:1 AAA |
| white | #CBD2D9 | 12.9:1 AAA |
| brightBlack | #97A3B0 | 7.7:1 AAA |
| brightRed | #FF958D | 9.3:1 AAA |
| brightGreen | #82EC9C | 13.6:1 AAA |
| brightYellow | #FFE47C | 15.6:1 AAA |
| brightBlue | #91C1FF | 10.6:1 AAA |
| brightMagenta | #F0A1E9 | 10.3:1 AAA |
| brightCyan | #80EBF7 | 14.2:1 AAA |
| brightWhite | #F4F7FB | 18.4:1 AAA |

```ts
export const xtermThemeGelo: ITheme = {
  "background": "#070B0F",
  "foreground": "#DBDEE2",
  "cursor": "#7CD6F2",
  "cursorAccent": "#070B0F",
  "selectionBackground": "#25424B",
  "black": "#7C8894",
  "red": "#F66D67",
  "green": "#5FD37F",
  "yellow": "#F1CA47",
  "blue": "#6AA7F4",
  "magenta": "#DF7FD7",
  "cyan": "#44D4E2",
  "white": "#CBD2D9",
  "brightBlack": "#97A3B0",
  "brightRed": "#FF958D",
  "brightGreen": "#82EC9C",
  "brightYellow": "#FFE47C",
  "brightBlue": "#91C1FF",
  "brightMagenta": "#F0A1E9",
  "brightCyan": "#80EBF7",
  "brightWhite": "#F4F7FB"
};
```

## Paleta: Violeta
Preto azulado, acento violeta elétrico. Foco e ações muito evidentes.

### Cores
| Token | Hex |
|---|---|
| `--wfa-color-bg` | #090911 |
| `--wfa-color-surface-1` | #101018 |
| `--wfa-color-surface-2` | #171820 |
| `--wfa-color-surface-3` | #1F2029 |
| `--wfa-color-border` | #2A2B33 |
| `--wfa-color-border-strong` | #40424B |
| `--wfa-color-text-1` | #EFF0F6 |
| `--wfa-color-text-2` | #BBBDC8 |
| `--wfa-color-text-3` | #9799A4 |
| `--wfa-color-accent` | #A88FFF |
| `--wfa-color-accent-hover` | #B9A9FF |
| `--wfa-color-accent-pressed` | #9379E7 |
| `--wfa-color-accent-subtle` | #27223C |
| `--wfa-color-accent-border` | #574A86 |
| `--wfa-color-on-accent` | #0C0D14 |
| `--wfa-color-success` | #6AD18A |
| `--wfa-color-warning` | #EEA743 |
| `--wfa-color-error` | #FF958D |
| `--wfa-color-info` | #64C1FF |

### Estados do terminal
| Token | Hex | vs surface-1 |
|---|---|---|
| `--wfa-state-work` (A trabalhar) | #60DB89 | 10.8:1 |
| `--wfa-state-wait` (À tua espera) | #FFB755 | 11.0:1 |
| `--wfa-state-stop` (Terminado) | #9697A1 | 6.5:1 |
| `--wfa-state-err` (Erro / desligado) | #FC6661 | 6.5:1 |

Cada estado tem também `-subtle` (fundo) e `-border`: work #0F2817 / #26673C · wait #2E1E07 / #784E0D · stop #212123 / #57585D · err #371715 / #8C3B37

### Escalas
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

### Contraste do texto
| Par | Rácio | Nível |
|---|---|---|
| text-1 / bg | 17.4:1 | AAA |
| text-2 / bg | 10.6:1 | AAA |
| text-3 / bg | 7.0:1 | AA |
| text-2 / surface-2 | 9.4:1 | AAA |
| text-3 / surface-3 | 5.7:1 | AA |
| accent / bg | 7.6:1 | AAA |
| on-accent / accent | 7.4:1 | AAA |
| accent / surface-2 | 6.8:1 | AA |

### Tema xterm.js (ITheme)
| Cor | Hex | vs background |
|---|---|---|
| black | #82849A | 5.4:1 AA |
| red | #F66D67 | 6.9:1 AA |
| green | #5FD37F | 10.5:1 AAA |
| yellow | #F1CA47 | 12.5:1 AAA |
| blue | #6AA7F4 | 8.0:1 AAA |
| magenta | #DF7FD7 | 7.7:1 AAA |
| cyan | #44D4E2 | 11.1:1 AAA |
| white | #CFD0DC | 12.9:1 AAA |
| brightBlack | #9DA0B6 | 7.7:1 AAA |
| brightRed | #FF958D | 9.4:1 AAA |
| brightGreen | #82EC9C | 13.6:1 AAA |
| brightYellow | #FFE47C | 15.7:1 AAA |
| brightBlue | #91C1FF | 10.6:1 AAA |
| brightMagenta | #F0A1E9 | 10.4:1 AAA |
| brightCyan | #80EBF7 | 14.3:1 AAA |
| brightWhite | #F5F6FC | 18.4:1 AAA |

```ts
export const xtermThemeVioleta: ITheme = {
  "background": "#090911",
  "foreground": "#DDDDE3",
  "cursor": "#A88FFF",
  "cursorAccent": "#090911",
  "selectionBackground": "#3E365C",
  "black": "#82849A",
  "red": "#F66D67",
  "green": "#5FD37F",
  "yellow": "#F1CA47",
  "blue": "#6AA7F4",
  "magenta": "#DF7FD7",
  "cyan": "#44D4E2",
  "white": "#CFD0DC",
  "brightBlack": "#9DA0B6",
  "brightRed": "#FF958D",
  "brightGreen": "#82EC9C",
  "brightYellow": "#FFE47C",
  "brightBlue": "#91C1FF",
  "brightMagenta": "#F0A1E9",
  "brightCyan": "#80EBF7",
  "brightWhite": "#F5F6FC"
};
```

## Paleta: Sinal
Preto quente, acento amarelo-sinal. Mais dramático; estados em ciano e magenta.

### Cores
| Token | Hex |
|---|---|
| `--wfa-color-bg` | #0C0A07 |
| `--wfa-color-surface-1` | #13110D |
| `--wfa-color-surface-2` | #1B1815 |
| `--wfa-color-surface-3` | #23211D |
| `--wfa-color-border` | #2E2B27 |
| `--wfa-color-border-strong` | #45423E |
| `--wfa-color-text-1` | #F2F0ED |
| `--wfa-color-text-2` | #C1BDB8 |
| `--wfa-color-text-3` | #9D9994 |
| `--wfa-color-accent` | #F9D544 |
| `--wfa-color-accent-hover` | #FFEBA1 |
| `--wfa-color-accent-pressed` | #E1BF20 |
| `--wfa-color-accent-subtle` | #2E2606 |
| `--wfa-color-accent-border` | #665400 |
| `--wfa-color-on-accent` | #0F0D09 |
| `--wfa-color-success` | #63D18F |
| `--wfa-color-warning` | #F6A14F |
| `--wfa-color-error` | #FF9592 |
| `--wfa-color-info` | #00CEEA |

### Estados do terminal
| Token | Hex | vs surface-1 |
|---|---|---|
| `--wfa-state-work` (A trabalhar) | #32D3EE | 10.5:1 |
| `--wfa-state-wait` (À tua espera) | #FF70BB | 7.4:1 |
| `--wfa-state-stop` (Terminado) | #9C9792 | 6.5:1 |
| `--wfa-state-err` (Erro / desligado) | #FF6367 | 6.5:1 |

Cada estado tem também `-subtle` (fundo) e `-border`: work #08262C / #086371 · wait #351525 / #873761 · stop #222120 / #5A5854 · err #371616 / #8D393A

### Escalas
| Passo | neutral | accent |
|---|---|---|
| 100 | #F5F1EC | #FFF2C1 |
| 200 | #D7D4CF | #F5D240 |
| 300 | #B7B4AF | #D4B200 |
| 400 | #989590 | #B09300 |
| 500 | #77746F | #8A7300 |
| 600 | #585550 | #665400 |
| 700 | #3D3A36 | #473900 |
| 800 | #262420 | #2C2300 |
| 900 | #161310 | #1A1300 |

### Contraste do texto
| Par | Rácio | Nível |
|---|---|---|
| text-1 / bg | 17.4:1 | AAA |
| text-2 / bg | 10.6:1 | AAA |
| text-3 / bg | 7.0:1 | AA |
| text-2 / surface-2 | 9.5:1 | AAA |
| text-3 / surface-3 | 5.7:1 | AA |
| accent / bg | 13.8:1 | AAA |
| on-accent / accent | 13.5:1 | AAA |
| accent / surface-2 | 12.3:1 | AAA |

### Tema xterm.js (ITheme)
| Cor | Hex | vs background |
|---|---|---|
| black | #8C857C | 5.4:1 AA |
| red | #F66D67 | 6.9:1 AA |
| green | #5FD37F | 10.5:1 AAA |
| yellow | #F1CA47 | 12.5:1 AAA |
| blue | #6AA7F4 | 8.0:1 AAA |
| magenta | #DF7FD7 | 7.7:1 AAA |
| cyan | #44D4E2 | 11.1:1 AAA |
| white | #D4D0CB | 12.9:1 AAA |
| brightBlack | #A8A097 | 7.7:1 AAA |
| brightRed | #FF958D | 9.4:1 AAA |
| brightGreen | #82EC9C | 13.6:1 AAA |
| brightYellow | #FFE47C | 15.7:1 AAA |
| brightBlue | #91C1FF | 10.6:1 AAA |
| brightMagenta | #F0A1E9 | 10.3:1 AAA |
| brightCyan | #80EBF7 | 14.3:1 AAA |
| brightWhite | #F8F6F4 | 18.3:1 AAA |

```ts
export const xtermThemeSinal: ITheme = {
  "background": "#0C0A07",
  "foreground": "#DFDEDB",
  "cursor": "#F9D544",
  "cursorAccent": "#0C0A07",
  "selectionBackground": "#483C0F",
  "black": "#8C857C",
  "red": "#F66D67",
  "green": "#5FD37F",
  "yellow": "#F1CA47",
  "blue": "#6AA7F4",
  "magenta": "#DF7FD7",
  "cyan": "#44D4E2",
  "white": "#D4D0CB",
  "brightBlack": "#A8A097",
  "brightRed": "#FF958D",
  "brightGreen": "#82EC9C",
  "brightYellow": "#FFE47C",
  "brightBlue": "#91C1FF",
  "brightMagenta": "#F0A1E9",
  "brightCyan": "#80EBF7",
  "brightWhite": "#F8F6F4"
};
```

## Tipografia
Google Fonts: `https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&family=Chakra+Petch:wght@500;600&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap`

| Combinação | --wfa-font-display | --wfa-font-sans | --wfa-font-mono |
|---|---|---|---|
| Plex | 'IBM Plex Sans', sans-serif | 'IBM Plex Sans', sans-serif | 'IBM Plex Mono', monospace |
| Geist | 'Geist', sans-serif | 'Geist', sans-serif | 'Geist Mono', monospace |
| Consola | 'Chakra Petch', sans-serif | 'Barlow', sans-serif | 'JetBrains Mono', monospace |

| Nível | Tamanho / altura | Peso | Notas |
|---|---|---|---|
| display | 28 / 34 | 600 | `text-transform: var(--wfa-display-case)` |
| title | 20 / 26 | 600 | |
| title-sm | 16 / 24 | 600 | |
| body | 14 / 21 | 400 | |
| body-sm | 13 / 18 | 400–500 | tabelas, botões 13.5 |
| caption | 12 / 16 | 400 | |
| kicker | 11 / 16 | 600 | maiúsculas, +0.12em, cor accent |
| mono (terminal) | 13 / 19 | 400 | xterm `fontSize: 13, lineHeight: 1.46` |
| mono-sm | 11.5 / 16 | 400 | pastas, atalhos |

## Espaçamento, raios, elevação, movimento
| Token | Valor |
|---|---|
| `--wfa-space-0-5 … -12` | 2, 4, 8, 12, 16, 20, 24, 32, 40, 48 px |
| `--wfa-radius-sm / md / lg` | 3 / 5 / 8 px |
| `--wfa-shadow-1` | 0 1px 2px rgba(0,0,0,.5) |
| `--wfa-shadow-overlay` | 0 24px 64px rgba(0,0,0,.6) + anel 1px border-strong |
| `--wfa-color-mask` | rgba(0,0,0,.62) |
| `--wfa-dur-fast / base / slow` | 120 / 180 / 260 ms |
| `--wfa-ease-standard` | cubic-bezier(.2,0,0,1) |
| `--wfa-ease-exit` | cubic-bezier(.4,0,1,1) |

Elevação: 0 = bg (página e terminal) · 1 = surface-1 (lateral, cabeçalhos, drawer) · 2 = surface-2 (painel em foco, hover) · 3 = overlay (modal, toast, menu).
`prefers-reduced-motion`: sem deslizes nem rotação; o arco "a trabalhar" fica estático.

## Ecrãs (em Workflow App.dc.html)
- 1a–1c paletas aplicadas a Terminais · 1d–1f tipografia
- 1g Terminais foco · 1h foco dividido · 1i grelha
- 1j Drawer Novo terminal · 1k Confirmar fechar · 1l Biblioteca · 1m Detalhe · 1n Login · 1o tokens base
