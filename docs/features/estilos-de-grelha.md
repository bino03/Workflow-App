# Feature: Estilos de grelha

| | |
|---|---|
| **Estado** | 📋 Planeada |
| **Criada** | 2026-09-29 |
| **Última sessão** | 2026-09-29 |
| **Passos** | 0 / 5 concluídos |

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
teclado. Ao recarregar a página, o projeto volta à grelha 3×2 de sempre. Duplo clique ou `Alt+1…9`
continuam a ampliar um terminal para fullscreen, por cima de qualquer estilo.

## 2. Âmbito

### Dentro
- **Quatro estilos de grelha**, escolhidos por um botão no cabeçalho da grelha (só aparece com a grelha
  ativa): **Grelha 3×2** (o comportamento de hoje, por omissão) · **Colunas iguais** (2, 3 ou 4 colunas
  lado a lado, sem linhas) · **2×2** (quatro quadrantes iguais) · **Principal + laterais** (um grande à
  esquerda + dois pequenos empilhados à direita).
- **Por projeto**: cada separador guarda o seu estilo (como o foco/split/ampliado de hoje,
  [[separadores-de-projetos]] §4.1) — trocar de separador e voltar mostra o estilo tal como foi deixado
  **durante a mesma visita à página**; recarregar (F5) volta todos os projetos à grelha 3×2.
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
- **Persistir o estilo entre recarregamentos** (`localStorage` por projeto). Reinicia sempre para a
  grelha 3×2, como o resto do estado por projeto hoje.
- **Reordenar ou fixar manualmente** qual terminal vai para qual lugar, além do "+" (lugar vazio) e do
  clique na lateral (troca com o lugar em foco). Sem arrastar terminais entre lugares.
- **Estilos assimétricos novos** além dos quatro listados (ex.: "2 grandes + 3 pequenos", colunas
  desiguais). Podem nascer de uma segunda fase, se os quatro de agora não chegarem.
- **Aplicar isto ao modo Foco dividido.** Foco dividido não muda — continua um terminal em foco + `Alt+\`
  para dividir em dois, exatamente como hoje. Esta feature só existe dentro do modo Grelha.

> Esta lista impede uma sessão futura de expandir o âmbito sozinha.

### Segunda fase (se houver)
- Divisores arrastáveis, com a proporção a persistir por projeto.
- O estilo escolhido sobreviver a recarregar a página.
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
| Persistência entre recarregamentos | Reinicia (não fica em `localStorage`) | Mesma regra do resto do estado por projeto (spec [[separadores-de-projetos]] §4.1); nada novo para guardar | Persistir por projeto — acumula entradas para projetos apagados/renomeados, e o resto do estado do separador também não persiste |
| Estilo por omissão | Grelha 3×2 (a de hoje) | Continuidade — nenhum projeto muda de comportamento até o dono escolher outra coisa | Começar em "Colunas (2)" — mudaria o comportamento de hoje sem pedido explícito |
| Ampliar (`Alt+1…9`, duplo clique) | Continua a funcionar tal como hoje, por cima de qualquer estilo | Reaproveita o mecanismo já testado nesta sessão (`enlargedId` no `ProjectLayout`); ampliar é sempre "um lugar, fullscreen", independente da forma dos outros | Um mecanismo de ampliar novo por estilo — complexidade sem benefício, o de hoje já serve |

**ADRs gerados:** nenhum (mudança de comportamento dentro do frontend, sem tocar dados, API ou o modelo de
auth — mesmo padrão de [[separadores-de-projetos]], que também não gerou ADR).

## 4. Desenho técnico

### 4.1 Dados

Nenhum — sem base de dados ([[../adr/0009-estado-em-ficheiro-json|ADR 0009]]) e sem persistência nova.
Estado só no frontend, em memória de componente, por projeto (`TerminalsPage.tsx`), tal como o resto do
`ProjectLayout` — não sobrevive a recarregar.

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

- [ ] **1. `gridStyle.ts` — tipos e lógica pura**
  - Ficheiro: `frontend/src/components/terminals/gridStyle.ts`
  - Skill: `frontend-design-system`
  - Tier: `sonnet`
  - Aceite quando: `GridStyle`, `DEFAULT_GRID_STYLE`, `slotCount`, `initialSlotIds` exportados;
    `slotCount('classic')` é `null`; `slotCount({kind:'columns', count:3})` é `3`; `initialSlotIds`
    preenche pela ordem dada e usa `null` para os lugares que sobram quando há menos terminais do que
    lugares; `npx tsc -b` e lint limpos.

- [ ] **2. `GridStylePicker` — o botão e as 6 opções**
  - Ficheiro: `frontend/src/components/terminals/GridStylePicker.tsx`
  - Skill: `frontend-design-system`
  - Tier: `sonnet`
  - Aceite quando: um botão no cabeçalho da grelha abre uma lista com Grelha 3×2 · Colunas 2 · Colunas 3 ·
    Colunas 4 · 2×2 · Principal + laterais; a opção atual aparece marcada; só tokens, nenhum hex novo;
    `npx tsc -b` e lint limpos (ainda sem estar ligado à página — isso é o passo 4).

- [ ] **3. `TerminalGrid` — as quatro disposições e o lugar vazio**
  - Ficheiro: `frontend/src/components/terminals/TerminalGrid.tsx` (reescrito)
  - Skill: `frontend-design-system`
  - Tier: `opus` (a disposição CSS de cada estilo é reutilizada por toda a página — um erro aqui aparece
    em todos os projetos)
  - Aceite quando: recebe `style: GridStyle` e `slotIds: (string | null)[]`; `classic` continua igual a
    hoje; `columns`/`quad`/`spotlight` mostram os lugares nas proporções do §4.4; um `slotIds[i] === null`
    mostra o "+" tracejado; `onSlotNew(index)` chamado ao clicar nesse "+"; `npx tsc -b` e lint limpos.

- [ ] **4. `TerminalsPage` — estado por projeto, troca e excesso**
  - Ficheiro: `frontend/src/pages/TerminalsPage.tsx`
  - Skill: `frontend-design-system`
  - Tier: `opus` (mexe no coração da página — `ProjectLayout`, `selectTerminal`, `visibleIds` — os mesmos
    sítios já delicados desta sessão)
  - Aceite quando: no browser — escolher "2×2" com 2 terminais mostra 2 quadrantes ocupados + 2 com "+";
    clicar um "+" cria um terminal e ele aparece nesse quadrante; com 6 terminais em "2×2", os 2 a mais
    não aparecem na grelha mas continuam "a correr" na lateral; clicar um deles na lateral troca-o para o
    quadrante que tinha o teclado (substitui esse, não outro); duplo clique ou `Alt+1…9` continuam a
    ampliar por cima de qualquer estilo, e sair da ampliação devolve ao estilo e aos lugares de antes;
    trocar de separador e voltar mantém o estilo desse projeto (sem persistir a recarregar); um projeto
    novo (ou recarregar a página) começa sempre em Grelha 3×2.

- [ ] **5. Verificação ponta a ponta + registo do padrão + fecho**
  - Ficheiro: `docs/skills/references/design/grid-styles.md` (novo, como `browser-tabs.md`),
    `docs/features/terminais.md` (§"Layouts" — link para esta spec, edição pontual),
    `docs/product/use-cases.md`, `notes/ToDo.md`, `notes/whatIveDone.md`
  - Skill: `run`
  - Tier: `sonnet`
  - Aceite quando: no browser, com o `claude` real — os quatro estilos testados num projeto com terminais
    a mais e a menos do que os lugares, ampliar/sair a funcionar por cima de qualquer estilo, e a troca de
    separador a preservar o estilo; docs atualizados; plano e work log fechados.

## 6. Estado atual

> ⚠️ **Atualizar SEMPRE no fim de cada sessão.** É a secção que torna esta spec retomável.

**Feito:** nada ainda — spec escrita e entrevistada em 2026-09-29.
**Em curso:** —
**Próxima ação concreta:** passo 1 — `frontend/src/components/terminals/gridStyle.ts`.
**Desvios ao plano:** nenhum ainda.
**O que uma sessão nova precisa de saber:**
- Esta feature vive **só dentro do modo Grelha** ([[../adr/0008-identidade-visual|ADR 0008]]) — o Foco
  dividido não muda em nada.
- O botão "+ Novo terminal" do cabeçalho da grelha já **não existe** (removido em 2026-09-29, ver
  [[terminais]] §"Layouts") — o botão novo desta feature (`GridStylePicker`) fica no lugar onde ele
  estava, não é o mesmo botão.
- `enlargedId`/`activeId`/`clearGridFocus`/`exitEnlarge` já existem em `TerminalsPage.tsx` (sessão de
  2026-09-29) e **não mudam** — esta feature só acrescenta `gridStyle`/`slotIds` ao lado.
- `selectTerminal` (em `TerminalsPage.tsx`) hoje só sabe focar um terminal já visível; o passo 4 tem de
  lhe ensinar a trocar um terminal "de fora" para o lugar em foco quando o estilo não é `classic`.

## 7. Perguntas em aberto

| Pergunta | Bloqueia | Notas |
|---|---|---|
| Vale a pena um atalho de teclado para trocar de estilo? | Não bloqueia — 2ª fase, só clique nesta v1 | Perguntar ao dono depois de usar a v1 |
| Os quatro estilos chegam, ou falta algum arranjo comum? | Não bloqueia — 2ª fase se fizer falta | Reavaliar depois de uso real |

## Relacionado

[[skill-plan-feature]] · [[skill-implement-todo]] · [[../adr/README]] · [[terminais]] ·
[[separadores-de-projetos]] · [[../adr/0008-identidade-visual]]
