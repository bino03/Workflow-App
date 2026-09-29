# Feature: Estilos de grelha

| | |
|---|---|
| **Estado** | 🚧 Em curso — falta só a verificação manual no browser do passo 5 |
| **Criada** | 2026-09-29 |
| **Última sessão** | 2026-09-29 |
| **Passos** | 4 / 5 concluídos |

> Escrita para uma sessão que **não viu a conversa que a originou**. Se algo só faz sentido com contexto
> externo, falta escrevê-lo.

Hoje, o modo **Grelha** ([[terminais]] §"Layouts", [[../adr/0008-identidade-visual|ADR 0008]]) só tem uma
forma: 3 colunas, 2 linhas à vista, scroll a partir de 6 mosaicos — todos os terminais do projeto ativo,
sempre. O dono quer **escolher entre vários arranjos** quando está em grelha, num projeto: colunas iguais
lado a lado, 2×2, ou um terminal principal com dois mais pequenos ao lado. Nasceu de "quando escolho um
projeto e estou em grelha quero ter vários estilos de divisão de telas, tipo meio-meio (horizontal)"
(conversa de 2026-09-29), refinado numa entrevista com o dono na mesma conversa.

---

## 1. O que é e porquê

A grelha 3×2 de hoje trata todos os terminais por igual, sempre no mesmo arranjo fixo. Para um projeto
onde o dono trabalha sobretudo com 2, 3 ou 4 terminais ao mesmo tempo (ex.: um a correr testes, outro o
servidor, outro o `claude`), um arranjo à medida — dois lado a lado, quatro quadrantes, ou um grande com
dois pequenos — aproveita melhor o ecrã do que a grelha genérica com scroll.

**Como sei que está bem feito:** com um projeto ativo em grelha, escolho "2×2" num botão no cabeçalho da
grelha e os terminais desse projeto reorganizam-se em quatro quadrantes iguais; se só há dois terminais,
os outros dois quadrantes mostram um "+" para abrir um terminal ali mesmo; se há seis, os dois a mais
ficam de fora (continuam a correr) e clicar um deles na lateral troca-o para o quadrante que tinha o
teclado. Troco de projeto, navego para a Biblioteca e volto, ou recarrego a página (F5): o projeto continua
no estilo que escolhi, com os mesmos lugares. Duplo clique ou `Alt+1…9` continuam a ampliar um terminal
para fullscreen, por cima de qualquer estilo.

## 2. Âmbito

### Dentro
- **Quatro estilos de grelha**, escolhidos por um botão no cabeçalho da grelha (só aparece com a grelha
  ativa): **Grelha 3×2** (o comportamento de hoje, por omissão) · **Colunas iguais** (2, 3 ou 4 colunas
  lado a lado, sem linhas) · **2×2** (quatro quadrantes iguais) · **Principal + laterais** (um grande à
  esquerda + dois pequenos empilhados à direita).
- **Por projeto, e persistido** (revisto 2026-09-29, pedido do dono): cada projeto guarda o seu estilo e
  lugares em `localStorage`, por caminho — ao contrário do resto do estado do separador (foco/split/
  ampliado, [[separadores-de-projetos]] §4.1), que continua só em memória. Trocar de separador, navegar
  para a Biblioteca e voltar, ou recarregar a página (F5): o estilo e os lugares de cada projeto continuam
  tal como foram deixados. Só se perde se o `localStorage` for limpo, ou nunca chegou a existir (projeto
  novo começa em Grelha 3×2).
- **Lugares vazios**: um estilo com mais lugares do que terminais (ex.: 2×2 com 2 terminais) mostra um
  "+" no(s) lugar(es) livre(s) — clicar abre logo um terminal novo (`mode: 'new'`) ali mesmo.
- **Excesso**: um estilo com menos lugares do que terminais (ex.: 2×2 com 6) deixa os que não cabem de
  fora da grelha — continuam a correr, aparecem na lateral como hoje. Clicar um deles na lateral troca-o
  para o lugar que tinha o teclado (substitui esse, não o mais antigo).
- **Ampliar continua por cima**: duplo clique num lugar ocupado, ou `Alt+1…9`, ampliam esse terminal para
  fullscreen tal como hoje ([[terminais]] §"Layouts", revisto 2026-09-29) — independente do estilo
  escolhido. Sair da ampliação devolve ao estilo e aos lugares tal como estavam.
- **Grelha 3×2 continua a existir** tal como está hoje — é só mais um estilo da lista, o que vem por
  omissão; nenhum projeto muda de comportamento até o dono escolher outra coisa.

### ⛔ Fora — não implementar nesta feature
- **Redimensionar os divisores** entre lugares (arrastar para 60/40 em vez de 50/50). Todos os estilos
  desta versão têm proporções fixas e iguais entre lugares do mesmo tamanho.
- **Reordenar ou fixar manualmente** qual terminal vai para qual lugar, além do "+" (lugar vazio) e do
  clique na lateral (troca com o lugar em foco). Sem arrastar terminais entre lugares.
- **Estilos assimétricos novos** além dos quatro listados (ex.: "2 grandes + 3 pequenos", colunas
  desiguais). Podem nascer de uma segunda fase, se os quatro de agora não chegarem.
- **Aplicar isto ao modo Foco dividido.** Foco dividido não muda — continua um terminal em foco + `Alt+\`
  para dividir em dois, exatamente como hoje. Esta feature só existe dentro do modo Grelha.

> Esta lista impede uma sessão futura de expandir o âmbito sozinha.

### Segunda fase (se houver)
- Divisores arrastáveis, com a proporção a persistir por projeto (o estilo/lugares já persistem,
  ver revisão de 2026-09-29 abaixo).
- Mais estilos (assimétricos, colunas desiguais) se os quatro de agora não chegarem.
- Atalho de teclado para trocar de estilo (esta versão é só clique, como os separadores de projeto).

## 3. Decisões tomadas

| Decisão | Escolha | Porquê | Alternativa rejeitada |
|---|---|---|---|
| Estilos da v1 | Grelha 3×2 (atual) · Colunas iguais (2/3/4) · 2×2 · Principal + laterais | Cobre o pedido original ("meio-meio lado a lado") mais os casos mais comuns (par, quatro, um-grande-mais-pequenos), sem abrir um leque infinito de combinações | Deixar "lado a lado" como estilo à parte de "Colunas iguais" — juntos porque lado a lado é só o caso N=2 |
| Âmbito do estilo | Por projeto | Consistente com o resto do estado do separador (foco/split/ampliado já é por projeto) | Global (um só para toda a app, como Foco dividido/Grelha) — perderia sentido com projetos de tamanhos diferentes |
| Onde se escolhe | Botão no cabeçalho da grelha | Visível sempre que a grelha está ativa, sem abrir Definições | Drawer Definições — mais escondido, mais cliques no dia a dia |
| Lugar vazio (menos terminais que lugares) | Mostra um "+" no lugar livre | Consistente com o estado vazio de um projeto sem terminais; um clique cria e preenche | O estilo encolher sozinho (2×2 com 2 vira "2 colunas") — muda de forma sem o dono pedir |
| Excesso (mais terminais que lugares) | Ficam de fora, a correr; clicar na lateral troca para o lugar em foco | Nunca perde trabalho (o terminal continua vivo) nem obriga a sair do estilo escolhido | Desligar o estilo sozinho e voltar à grelha 3×2 — surpreende o dono a meio do trabalho |
| Principal + laterais | 2 laterais fixos (3 lugares no total) | Simples e previsível; o resto segue a regra do "Excesso" | Laterais sem limite, empilhados com scroll — mistura dois problemas (excesso já resolve isto) |
| Redimensionar | Fixo nesta v1 | Menos trabalho, e nenhum dos quatro estilos precisa de proporções à medida para ser útil | Arrastável já nesta v1 — fica para 2ª fase se fizer falta |
| Persistência entre recarregamentos | **Revisto 2026-09-29**: persiste em `localStorage`, por caminho de projeto | O dono pediu explicitamente, depois de usar a v1, que o estilo sobrevivesse a trocar de página (Biblioteca) e a recarregar — perdê-lo ao sair da página era mais surpreendente do que útil | Reiniciar sempre para a grelha 3×2 (decisão original desta spec) — descartada por pedido explícito; ver nota na spec [[separadores-de-projetos]] §4.1 sobre o resto do `ProjectLayout` continuar só em memória |
| Estilo por omissão | Grelha 3×2 (a de hoje) | Continuidade — nenhum projeto muda de comportamento até o dono escolher outra coisa | Começar em "Colunas (2)" — mudaria o comportamento de hoje sem pedido explícito |
| Ampliar (`Alt+1…9`, duplo clique) | Continua a funcionar tal como hoje, por cima de qualquer estilo | Reaproveita o mecanismo já testado nesta sessão (`enlargedId` no `ProjectLayout`); ampliar é sempre "um lugar, fullscreen", independente da forma dos outros | Um mecanismo de ampliar novo por estilo — complexidade sem benefício, o de hoje já serve |

**ADRs gerados:** nenhum (mudança de comportamento dentro do frontend, sem tocar dados, API ou o modelo de
auth — mesmo padrão de [[separadores-de-projetos]], que também não gerou ADR).

## 4. Desenho técnico

### 4.1 Dados

Sem base de dados ([[../adr/0009-estado-em-ficheiro-json|ADR 0009]]) e sem nada novo no backend. O
`gridStyle`/`slotIds` de cada projeto (**revisto 2026-09-29**, pedido do dono) persistem no `localStorage`
do browser, por caminho (`workflow-app.grid-layout.<caminho>`) — sobrevivem a navegar para a Biblioteca
(desmonta `TerminalsPage`) e a recarregar a página. O resto do `ProjectLayout`
(`selectedId`/`splitId`/`enlargedId`/`activeId`/`previousId`) continua só em memória de componente, como
antes ([[separadores-de-projetos]] §4.1) — só o estilo da grelha ganhou persistência, não o foco/split.

### 4.2 Endpoints

Nenhum — feature só de frontend.

### 4.3 Tipos / DTOs

```ts
// frontend/src/components/terminals/gridStyle.ts (novo)
export type GridStyle =
  | { kind: 'classic' }                       // grelha 3×2 de hoje — sem noção de "lugares"
  | { kind: 'columns'; count: 2 | 3 | 4 }      // colunas iguais lado a lado
  | { kind: 'quad' }                           // 2×2, quatro quadrantes
  | { kind: 'spotlight' };                     // 1 grande + 2 pequenos empilhados

export const DEFAULT_GRID_STYLE: GridStyle = { kind: 'classic' };

/** null = sem lugares fixos (classic mostra sempre todos, nunca há "excesso"). */
export function slotCount(style: GridStyle): number | null;

/** Os primeiros N terminais (ordem do `shortcutIndex`, a mesma do Alt+1…9) preenchem os lugares. */
export function initialSlotIds(style: GridStyle, terminalIdsInOrder: string[]): (string | null)[];
```

```ts
// frontend/src/pages/TerminalsPage.tsx — ProjectLayout ganha dois campos
type ProjectLayout = {
  selectedId: string | null;
  splitId: string | null;
  enlargedId: string | null;
  activeId: string | null;
  previousId: string | null;
  gridStyle: GridStyle;          // novo — por omissão DEFAULT_GRID_STYLE
  slotIds: (string | null)[];    // novo — só usado quando gridStyle.kind !== 'classic'
};
```

`slotIds` guarda ids possivelmente já fechados/inexistentes — ler sempre passado por um filtro
`existsInActive` (lugar cujo id já não existe conta como vazio), nunca por um efeito que os limpa à parte;
evita um `useEffect` extra a sincronizar estado.

### 4.4 Interface

- **Onde vive**: dentro da página Terminais (`/terminals`), só quando a Grelha está ativa
  ([[../adr/0008-identidade-visual|ADR 0008]] decide os dois modos; esta feature não mexe no Foco
  dividido).
- **Como se chega lá**: botão novo no cabeçalho da grelha (`TerminalGrid.tsx`), ao lado de onde estava o
  antigo botão "+ Novo terminal" (removido em 2026-09-29 — [[terminais]] §"Layouts").
- **Ficheiros**:
  - **Novo**: `frontend/src/components/terminals/gridStyle.ts` (tipos + funções puras),
    `frontend/src/components/terminals/GridStylePicker.tsx` (o botão + a lista de 6 opções: Grelha 3×2 ·
    Colunas 2 · Colunas 3 · Colunas 4 · 2×2 · Principal + laterais).
  - **Reescrito**: `frontend/src/components/terminals/TerminalGrid.tsx` (um `switch` no `style.kind` para
    a disposição CSS de cada arranjo; lugares vazios com "+"), `frontend/src/pages/TerminalsPage.tsx`
    (`ProjectLayout` com os dois campos novos; `setGridStyle`, `assignToSlot`; `selectTerminal` estendido
    para trocar um terminal "de fora" para o lugar em foco quando o estilo não é `classic`; `visibleIds`
    calculado a partir de `slotIds` fora do modo `classic`).
  - **Sem mudança de contrato**: `frontend/src/components/terminals/TerminalSidebar.tsx` (o clique num
    terminal continua a chamar `onSelectTerminal`/`selectTerminal` — é a lógica *dentro* de
    `selectTerminal`, em `TerminalsPage.tsx`, que passa a saber trocar para um lugar em vez de só focar).
- **Disposição CSS por estilo** (todos com `gap-3`, dentro do mesmo contentor de hoje):
  - `classic`: inalterado — `grid grid-cols-3 gap-3 overflow-y-auto`, `gridAutoRows: calc((100% - 12px) / 2)`.
  - `columns`: `flex h-full` — N filhos `flex-1 min-w-0 h-full`, sem scroll (o nº de lugares é fixo).
  - `quad`: `grid grid-cols-2 grid-rows-2 gap-3 h-full` — 4 lugares.
  - `spotlight`: `flex h-full gap-3` — lugar principal `flex-[2] min-w-0 h-full`; coluna lateral
    `flex flex-col gap-3 flex-1 min-w-0 h-full` com 2 lugares `flex-1 min-h-0` cada.
- **Lugar vazio**: mesma moldura tracejada que existia no botão removido da grelha (borda tracejada,
  `+` ao centro), mas do tamanho do lugar, não da página toda; `onClick` cria um terminal novo no projeto
  ativo e o resultado ocupa esse lugar específico (`assignToSlot`).
- **Estado vazio**: nenhum a mais — o estado vazio de um projeto sem nenhum terminal
  (`emptyProject`, `TerminalsPage.tsx`) continua a mesma coisa, antes de qualquer estilo se aplicar.
- **Visibilidade por role**: não há roles ([[../adr/0003-auth-utilizador-unico]]).
- **Visual**: sem protótipo do Claude Design (mesma situação dos separadores de projeto) — desenhar só
  com os tokens ([[../skills/references/design/tokens-and-colors]]), e registar o padrão novo em
  `design/grid-styles.md` no passo 5, como o `browser-tabs.md` da spec anterior.

### 4.5 Códigos de erro novos

Nenhum — criar um terminal num lugar vazio usa a mesma rota e os mesmos erros
(`TERMINAL_*`/`FOLDER_001`) já existentes ([[terminais]] §4.5).

## 5. Passos

Ordem obrigatória. Tiers: `opus` (desenho, não delegar) · `sonnet` (implementação) · `haiku` (mecânico).
**Regra 8 do `CLAUDE.md`**: nunca editar o backend a partir de um terminal servido por ele em `npm run dev`
(não se aplica aqui — feature 100% frontend).

- [x] **1. `gridStyle.ts` — tipos e lógica pura** — ✅ 2026-09-29
  - Ficheiro: `frontend/src/components/terminals/gridStyle.ts`
  - Skill: `frontend-design-system`
  - Tier: `sonnet`
  - Aceite quando: `GridStyle`, `DEFAULT_GRID_STYLE`, `slotCount`, `initialSlotIds` exportados;
    `slotCount('classic')` é `null`; `slotCount({kind:'columns', count:3})` é `3`; `initialSlotIds`
    preenche pela ordem dada e usa `null` para os lugares que sobram quando há menos terminais do que
    lugares; `npx tsc -b` e lint limpos.

- [x] **2. `GridStylePicker` — o botão e as 6 opções** — ✅ 2026-09-29
  - Ficheiro: `frontend/src/components/terminals/GridStylePicker.tsx`
  - Skill: `frontend-design-system`
  - Tier: `sonnet`
  - Aceite quando: um botão no cabeçalho da grelha abre uma lista com Grelha 3×2 · Colunas 2 · Colunas 3 ·
    Colunas 4 · 2×2 · Principal + laterais; a opção atual aparece marcada; só tokens, nenhum hex novo;
    `npx tsc -b` e lint limpos (ainda sem estar ligado à página — isso é o passo 4).
  - **Decisão ao implementar**: `Dropdown` do antd com `menu.items`, o mesmo padrão do menu de utilizador
    em `AppLayout.tsx` — sem componente de dropdown próprio.

- [x] **3. `TerminalGrid` — as quatro disposições e o lugar vazio** — ✅ 2026-09-29
  - Ficheiro: `frontend/src/components/terminals/TerminalGrid.tsx` (reescrito)
  - Skill: `frontend-design-system`
  - Tier: `opus` (a disposição CSS de cada estilo é reutilizada por toda a página — um erro aqui aparece
    em todos os projetos)
  - Aceite quando: recebe `style: GridStyle` e `slotIds: (string | null)[]`; `classic` continua igual a
    hoje; `columns`/`quad`/`spotlight` mostram os lugares nas proporções do §4.4; um `slotIds[i] === null`
    mostra o "+" tracejado; `onSlotNew(index)` chamado ao clicar nesse "+"; `npx tsc -b` e lint limpos.
  - **Decisão ao implementar (desvio do §4.4)**: `spotlight` usa **CSS Grid** com `grid-column`/`grid-row`
    explícitos por lugar (`slotPlacement`, movida para `gridStyle.ts` — um ficheiro de componente só pode
    exportar componentes, regra do `react-refresh` do ESLint), não o flex aninhado (lugar principal +
    coluna lateral com 2 filhos) descrito na spec. Mesmo resultado visual (1 grande + 2 empilhados), mas
    **sem aninhar o DOM**: os mosaicos continuam todos filhos diretos do mesmo contentor plano
    (`TerminalGrid`), só com `grid-column`/`grid-row` (ou `order`, em `columns`) a posicioná-los — trocar
    de estilo nunca desmonta um terminal já montado nem desliga o WebSocket, a mesma garantia que o passo
    7 da spec `separadores-de-projetos` já tinha para trocar de separador/modo. `columns`/`quad` só
    precisam de `order` (grid/flex já respeitam `order` no auto-placement); só `spotlight` precisa de
    posição explícita por não caber num auto-placement uniforme.

- [x] **4. `TerminalsPage` — estado por projeto, troca e excesso** — ✅ 2026-09-29 (automático; browser no passo 5)
  - Ficheiro: `frontend/src/pages/TerminalsPage.tsx`
  - Skill: `frontend-design-system`
  - Tier: `opus` (mexe no coração da página — `ProjectLayout`, `selectTerminal`, `visibleIds` — os mesmos
    sítios já delicados desta sessão)
  - Aceite quando: no browser — escolher "2×2" com 2 terminais mostra 2 quadrantes ocupados + 2 com "+";
    clicar um "+" cria um terminal e ele aparece nesse quadrante; com 6 terminais em "2×2", os 2 a mais
    não aparecem na grelha mas continuam "a correr" na lateral; clicar um deles na lateral troca-o para o
    quadrante que tinha o teclado (substitui esse, não outro); duplo clique ou `Alt+1…9` continuam a
    ampliar por cima de qualquer estilo, e sair da ampliação devolve ao estilo e aos lugares de antes;
    trocar de separador e voltar mantém o estilo desse projeto; um projeto novo começa sempre em Grelha
    3×2.
  - **Revisto 2026-09-29 (pedido do dono, depois deste passo já feito)**: o estilo/lugares por projeto
    passam a persistir em `localStorage` (`workflow-app.grid-layout.<caminho>`), não só em memória —
    sobrevivem a navegar para a Biblioteca e a recarregar a página (F5), ao contrário da decisão original
    da spec (§3). `defaultLayoutFor(path)` substitui os `?? EMPTY_LAYOUT` que materializavam o layout de
    um projeto pela primeira vez (em `layoutFor`, `updateLayout`, `focusTerminal`, `selectTerminal`,
    `handleSlotNew`) — lê a preferência guardada antes de cair no `DEFAULT_GRID_STYLE`/`[]`.
    `writeGridPreference` grava sempre que `gridStyle`/`slotIds` mudam: em `setGridStyle`, em
    `handleSlotNew`, e no ramo de troca de lugar do `selectTerminal`. `slotIds` guarda ids de terminais —
    continuam a passar pelo filtro `existsInActive`/`sanitizedSlotIds` já existente, por isso um terminal
    fechado entretanto não deixa o `localStorage` com um id morto a atrapalhar (o lugar mostra "+" na
    mesma).
  - **Decisões ao implementar**:
    - `ProjectLayout` ganhou `gridStyle`/`slotIds` (por omissão `DEFAULT_GRID_STYLE`/`[]`); `sanitizedSlotIds`
      é um `const` simples (não `useMemo`) — o React Compiler do projeto não conseguia preservar a
      memoização manual com `activeLayout` (objeto recalculado a cada render por `layoutFor`), e o
      compilador já memoiza automaticamente onde vale a pena.
    - `selectTerminal`, no ramo `grid`: se o estilo é `classic` ou o id já está num lugar, só muda
      `activeId` (como antes); senão, substitui o lugar de `current.slotIds.indexOf(current.activeId)`
      (ou o lugar 0, se nada tinha o teclado) — é o "troca-o para o quadrante que tinha o teclado".
    - `handleSlotNew` (o "+" de um lugar) chama `create` diretamente (não `handleCreate`/`focusTerminal`,
      que **amplia** o terminal novo em vez de o pôr num lugar) e escreve o id no índice certo de `slotIds`.
    - `setGridStyle` recalcula `slotIds` com `initialSlotIds(novoEstilo, activeTerminals.map(t => t.id))` —
      os primeiros N terminais do projeto (ordem do Alt+1…9) preenchem os lugares novos.
    - Verificação no browser adiada para o passo 5 (mexe na mesma árvore de componentes, e o dono só tem a
      password real — mesma situação da spec `separadores-de-projetos`, passo 8).

- [ ] **5. Verificação ponta a ponta + registo do padrão + fecho**
  - Ficheiro: `docs/skills/references/design/grid-styles.md` (novo, como `browser-tabs.md`),
    `docs/features/terminais.md` (§"Layouts" — link para esta spec, edição pontual),
    `docs/product/use-cases.md`, `notes/ToDo.md`, `notes/whatIveDone.md`
  - Skill: `run`
  - Tier: `sonnet`
  - Aceite quando: no browser, com o `claude` real — os quatro estilos testados num projeto com terminais
    a mais e a menos do que os lugares, ampliar/sair a funcionar por cima de qualquer estilo, a troca de
    separador a preservar o estilo, **e o estilo/lugares a sobreviver a navegar para a Biblioteca e a
    recarregar a página (F5)** (revisto 2026-09-29); docs atualizados; plano e work log fechados.
  - **Feito nesta sessão (2026-09-29)**: automático — `npx tsc -b` e `npm run lint` do frontend limpos
    (passos 1-4); docs atualizados (`use-cases.md`, `terminais.md` §"Layouts",
    `design/grid-styles.md` — padrão novo registado e ligado em `frontend-visual-consistency.md`).
  - **Por fazer**: o backend arrancou (`/run`, health check 200), mas o frontend não — `npm run dev`
    falhou a carregar o Rollup nativo (`@rollup/rollup-win32-x64-msvc`), bloqueado por uma política de
    Application Control do Windows nesta máquina (não é um `node_modules` corrompido; reinstalar não
    resolve). A verificação real também precisa do login com a password verdadeira, que só o dono tem —
    mesma situação da spec `separadores-de-projetos`, passo 8. Checklist completo em
    `notes/verificacao-browser-pendente.md` → "spec `estilos-de-grelha`, passo 5". Adiada, não dispensada.

## 6. Estado atual

> ⚠️ **Atualizar SEMPRE no fim de cada sessão.** É a secção que torna esta spec retomável.

**Feito:** passos 1-4 — `gridStyle.ts` (`GridStyle`, `DEFAULT_GRID_STYLE`, `slotCount`, `initialSlotIds`,
`slotPlacement`), `GridStylePicker.tsx`, `TerminalGrid.tsx` (as quatro disposições + lugar vazio),
`TerminalsPage.tsx` (`ProjectLayout.gridStyle`/`slotIds`, `setGridStyle`, `handleSlotNew`, `selectTerminal`
estendido para trocar de lugar). `npx tsc -b` e `npm run lint` limpos a cada passo. Passo 5 (parte
automática): docs atualizados (`use-cases.md`, `terminais.md` §"Layouts", `design/grid-styles.md`).
**Revisto 2026-09-29 (já com os passos 1-4 feitos)**: o estilo/lugares passam a persistir em
`localStorage` por projeto (`defaultLayoutFor`/`readGridPreference`/`writeGridPreference` em
`TerminalsPage.tsx`) — sobrevivem a navegar para a Biblioteca e a recarregar a página, não só a trocar de
separador. Ver a decisão revista no passo 4 e em §3/§4.1. `tsc -b`/lint continuam limpos.
**Em curso:** passo 5 — falta a verificação manual no browser.
**Próxima ação concreta:** destravar a política de Application Control do Windows que bloqueia o Rollup
nativo (`@rollup/rollup-win32-x64-msvc`) para o frontend arrancar, e depois correr o checklist de
`notes/verificacao-browser-pendente.md` → "spec `estilos-de-grelha`, passo 5" (precisa do dono: a
verificação real também precisa da password verdadeira) — inclui agora testar a persistência (Biblioteca
e F5).
**Desvios ao plano:**
- `spotlight` usa CSS Grid com posição explícita por lugar em vez do flex aninhado do §4.4 — mesmo
  resultado visual, sem aninhar o DOM (nunca desmonta um terminal já montado só por trocar de estilo).
  Ver "Decisão ao implementar" do passo 3.
- `slotPlacement` (originalmente pensada para viver em `TerminalGrid.tsx`) mudou para `gridStyle.ts` — um
  ficheiro de componente só pode exportar componentes (regra do `react-refresh` do ESLint deste projeto).
- A persistência entre recarregamentos, explicitamente excluída na decisão original desta spec (§3),
  passou a fazer-se — o dono pediu depois de o passo 4 já estar feito. Ver revisão em §3/§4.1/passo 4.
- Nesta sessão o frontend não arrancou (bloqueio de Application Control do Windows no Rollup nativo, não
  relacionado com o código desta spec) — ver `notes/verificacao-browser-pendente.md`.
**O que uma sessão nova precisa de saber:**
- Esta feature vive **só dentro do modo Grelha** ([[../adr/0008-identidade-visual|ADR 0008]]) — o Foco
  dividido não muda em nada.
- O botão "+ Novo terminal" do cabeçalho da grelha já **não existe** (removido em 2026-09-29, ver
  [[terminais]] §"Layouts") — o botão novo desta feature (`GridStylePicker`) fica no lugar onde ele
  estava, não é o mesmo botão.
- `enlargedId`/`activeId`/`clearGridFocus`/`exitEnlarge` já existiam em `TerminalsPage.tsx` antes desta
  feature e não mudaram — só `gridStyle`/`slotIds` são novos em `ProjectLayout`, e só esses dois persistem
  em `localStorage` (o resto continua só em memória).
- O código está todo escrito e a passar `tsc`/lint; só falta a verificação no browser (passo 5) — não há
  mais nenhum passo de código por fazer.

## 7. Perguntas em aberto

| Pergunta | Bloqueia | Notas |
|---|---|---|
| Vale a pena um atalho de teclado para trocar de estilo? | Não bloqueia — 2ª fase, só clique nesta v1 | Perguntar ao dono depois de usar a v1 |
| Os quatro estilos chegam, ou falta algum arranjo comum? | Não bloqueia — 2ª fase se fizer falta | Reavaliar depois de uso real |

## Relacionado

[[skill-plan-feature]] · [[skill-implement-todo]] · [[../adr/README]] · [[terminais]] ·
[[separadores-de-projetos]] · [[../adr/0008-identidade-visual]]
