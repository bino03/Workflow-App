# Feature: Atalhos de teclado editáveis

| | |
|---|---|
| **Estado** | ✅ Concluída (2026-10-20) |
| **Criada** | 2026-10-20 |
| **Última sessão** | 2026-10-20 |
| **Passos** | 7 / 7 concluídos |

> Escrita para uma sessão que **não viu a conversa que a originou**. Se algo só faz sentido com contexto
> externo, falta escrevê-lo.

---

## 1. O que é e porquê

Os atalhos dos terminais estão fixos no código (`frontend/src/hooks/useTerminalShortcuts.ts`). O dono
quer criar as próprias binds e mudar as atuais, nas Definições, e ter ações novas de navegação
(projetos, terminais, páginas) que hoje só se fazem com o rato.

**Como sei que está bem feito:** abrir Definições → Atalhos, mudar "Saltar para o terminal 1" para
`Alt+Q`, fechar o drawer, carregar `Alt+Q` num terminal em foco e o terminal 1 ter saltado. Recarregar a
página e reiniciar o backend e a bind continua lá. "Repor predefinidos" volta tudo ao início.

## 2. Âmbito

### Dentro
- Secção **Atalhos** nas Definições: uma linha por ação, com a bind atual, "Alterar" (captura a
  combinação) e "Remover" (fica sem bind).
- **Ações atuais, todas editáveis**: novo terminal, dividir/juntar, fechar, renomear, zoom +/−/repor,
  lateral (AltGr+.), saltar para o terminal 1…9 (uma linha cada).
- **Ações novas** (começam sem bind, "por determinar"):
  - Trocar para o projeto seguinte / anterior.
  - Fechar o projeto ativo.
  - Saltar para o terminal seguinte / anterior do projeto ativo.
  - Ir para Terminais; ir para Biblioteca.
- Persistência em `state.json` (campo `keybindings`, só alterações), esquema v2 com migração.
- Endpoints para ler e gravar as binds, com validação no servidor.
- Aviso ao gravar uma combinação que o Claude Code ou o shell usam (grava na mesma, por decisão do dono).
- "Repor predefinidos".
- Documentação atualizada (`docs/api.md`, `docs/features/terminais.md` §Atalhos, `docs/frontend-conventions.md`).

### ⛔ Fora — não implementar nesta feature
- Atalhos com `Ctrl`, `Meta` ou `Shift`, e `Esc`. Ficam reservados: são do Claude Code e do browser.
- Atalhos de várias teclas (chords).
- Importar ou exportar binds.
- Editar as ações da Biblioteca (só a navegação "ir para Biblioteca" entra).
- Mudar o predefinido de uma ação pela UI. Os predefinidos ficam no código.
- Guardar binds fora do `state.json` (ver ADR 0016).
- Atribuir uma bind às ações novas por defeito. Ficam sem bind até o dono decidir.

### Segunda fase (se houver)
- Chords (`Alt+K` depois `Alt+N`).
- Atalhos para ações da Biblioteca.

## 3. Decisões tomadas

| Decisão | Escolha | Porquê | Alternativa rejeitada |
|---|---|---|---|
| Onde guardar | `state.json`, campo `keybindings` (ADR 0016) | O dono escolheu; fica com o resto do estado | `localStorage` — só neste browser, fora do modelo |
| Âmbito da edição | Todas as ações, incluindo as atuais | Pedido do dono | Só as ações novas — deixaria o `Alt+N` fixo |
| O que se grava | Só as alterações; predefinidos no código | Uma ação nova recebe o predefinido sem migração de dados | Mapa completo — um predefinido novo não chegaria às binds guardadas |
| Ações sem bind | Permitido (`null`) | "Por determinar" pelo dono; ações novas começam assim | Obrigar a uma bind — empurra para um default arbitrário |
| Colisão interna | Recusada, com o nome da ação que já a usa | Duas ações na mesma tecla não têm resultado claro | Trocar as duas em silêncio — esconde o que mudou |
| Colisão com Claude Code/shell | Aviso, grava na mesma | Decisão do dono; a app não sabe tudo o que o `claude` usa | Recusar sempre — bloqueia uma escolha consciente |
| Modificadores | `Alt+<tecla>` e `AltGr+<tecla>`; sem `Ctrl`, `Meta`, `Shift` | Regra do ADR 0008 e do teclado PT (AltGr = Ctrl+Alt) | Permitir Ctrl — colide com o Claude Code e o browser |
| Tecla guardada | `event.code` (física) | Como hoje; independente do layout | `event.key` — muda com o layout e com o Shift |
| Saltos 1…9 | Nove ações separadas | Modelo uniforme; cada bind editável | Uma ação com prefixo — mais complicado para pouco ganho |

**ADRs gerados:** [[../adr/0016-atalhos-editaveis-no-state|ADR 0016]]

## 4. Desenho técnico

### 4.1 Dados

`state.json` passa de `version: 1` para `version: 2`:

```json
{
  "version": 2,
  "terminals": [],
  "closedTerminals": [],
  "folders": [],
  "keybindings": {
    "newTerminal": { "modifier": "alt", "code": "KeyM" },
    "projectNext": null
  }
}
```

- Chave = id da ação (ver catálogo, 4.3). Valor = bind, ou `null` para "sem bind".
- Só entram as ações **alteradas**. Ausente = predefinido do código.
- `code` é um `KeyboardEvent.code` válido na lista de teclas permitidas (letras, dígitos, `Backslash`,
  `Period`, `Equal`, `Minus`, e os sinónimos de teclado numérico).
- Migração v1 → v2: `keybindings` ausente recebe `{}`. Em `backend/src/state/state.schema.ts`.

### 4.2 Endpoints

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/keybindings` | sessão | Devolve `{ actions: [{ id, label, group, default, binding }] }` — `binding` é o efetivo (alteração ou predefinido), `null` se sem bind |
| PUT | `/api/keybindings/:actionId` | sessão | Corpo `{ binding }` (bind ou `null`). Valida, recusa colisões, grava, devolve a lista atualizada |
| DELETE | `/api/keybindings/:actionId` | sessão | Repõe o predefinido desta ação (apaga a alteração) |
| POST | `/api/keybindings/reset` | sessão | Apaga todas as alterações ("repor predefinidos") |

Os avisos de colisão com o Claude Code **não** vêm do servidor: são uma lista na UI (ver 4.4). O servidor
só recusa colisões internas.

### 4.3 Tipos / DTOs

```ts
type Binding = { modifier: 'alt' | 'altGraph'; code: string } | null;
// catálogo: id, label, grupo, predefinido (Binding)
```

Catálogo único em `backend/src/keybindings/catalog.ts` (ids, rótulos, predefinidos, teclas permitidas,
avisos). **Sem espelho no frontend** (revisto ao implementar, passo 2): o `GET` devolve tudo, e o frontend só
tem a mecânica das teclas (sinónimos de código, rótulos) em `frontend/src/keyboard/shortcuts.ts`.

### 4.4 Interface

- **Onde vive**: Definições (`components/settings/SettingsDrawer.tsx`), nova secção "Atalhos" entre o
  layout e as passkeys.
- **Como se chega lá**: ⚙ Definições na lateral (já existe).
- **Ficheiros**: `components/settings/ShortcutsSection.tsx` (novo), `components/settings/ShortcutCapture.tsx`
  (novo, captura), `services/keybindingService.ts` (novo), `hooks/useKeybindings.ts` (novo),
  `hooks/useTerminalShortcuts.ts` (recebe o mapa efetivo em vez do `switch` fixo),
  `components/terminals/TerminalView.tsx` (usa o mesmo mapa no `attachCustomKeyEventHandler`),
  `pages/TerminalsPage.tsx` (executa as ações novas), `errors/errorMessages.ts` (códigos novos).
- **Captura**: "Alterar" põe a linha em modo de captura. A próxima combinação é gravada; `Esc` cancela
  (é reservado, por isso não se grava). Uma combinação com `Ctrl`, `Meta` ou `Shift` é recusada com aviso.
- **Aviso de Claude Code/shell**: lista fixa no catálogo (ex.: `Alt+B`, `Alt+F`, `Alt+D`, `Alt+.`,
  `Alt+Backspace`). Mostra o aviso e grava na mesma se o dono confirmar.
- **Estado vazio**: não existe — há sempre predefinidos.
- **Visibilidade por role**: n/a (um utilizador).

### 4.5 Códigos de erro novos

| Código | HTTP | Mensagem no frontend |
|---|---|---|
| `KEYBIND_001` | 400 | Esta combinação não é permitida (usa Alt ou AltGr, sem Ctrl, Meta ou Shift). |
| `KEYBIND_002` | 409 | Esta combinação já é usada por "{action}". |
| `KEYBIND_003` | 404 | Ação de atalho desconhecida. |

`errorMessages.ts` espelha os três códigos 1:1 (regra de `frontend-error-handling`).

## 5. Passos

Ordem obrigatória. Tiers: `opus` (desenho, não delegar) · `sonnet` (implementação) · `haiku` (mecânico).

- [x] **1. Esquema v2 e migração do `state.json`** — ✅ 2026-10-20 (21 testes de estado a passar, 4 novos)
  - Decisão ao implementar: a bind é `{ modifier: 'alt' | 'altGraph', code }`, e não `{ alt, altGraph, code }`
    — dois booleanos permitiam "nenhum" e "os dois". O esquema só valida a **forma**: um id de ação que o
    catálogo não conheça é mantido, para que tirar uma ação do catálogo nunca impeça o arranque.
  - Ficheiro: `backend/src/state/state.schema.ts`, `backend/test/state*.test.ts`
  - Skill: `design-database` (a alteração ao modelo) · `/implement-todo` para o resto
  - Tier: `sonnet`
  - Aceite quando: um `state.json` v1 carrega com `keybindings: {}`; v3 continua recusado; testes de
    migração a passar.

- [x] **2. Catálogo e validação (contrato partilhado)** — ✅ 2026-10-20 (sessão Opus)
  - Decisões ao implementar: (a) **sem espelho no frontend** — o catálogo só existe no backend e chega pelo
    `GET` ("uma cópia de cada facto"); (b) a validação vive no `KeybindingsService` (não num `validate.ts` à
    parte — é uma função e meia); (c) teclas permitidas com `Alt`: letras, dígitos e pontuação; sem setas
    (`Alt+←` é o "voltar" do browser), sem F-keys (`Alt+F4`), sem `Esc`; `AltGr` só com `.` (AltGr + letra
    escreve um carácter num teclado PT); (d) o servidor só aceita códigos **canónicos** — o frontend converte
    o teclado numérico e o `\` do teclado PT (`Backquote`/`IntlBackslash`) antes de enviar; (e) 5 avisos
    (`Alt+B/F/D/E/.`), escritos como "em muitos shells…" — não se afirma o que o Claude Code usa.
  - Ficheiros: `backend/src/keybindings/catalog.ts` (novo), `backend/src/keybindings/validate.ts` (novo),
    `frontend/src/config/shortcutCatalog.ts` (novo)
  - Skill: `frontend-design-system` (para o espelho do frontend)
  - Tier: `opus` (contrato partilhado entre backend e frontend)
  - Aceite quando: o catálogo tem as ações atuais (com os sinónimos de código — o `\` aceita
    `Backslash`, `IntlBackslash` e `Backquote`, como hoje) e as novas; `validate` recusa `Ctrl`, `Meta`,
    `Shift`, `Esc` e colisões internas com `KEYBIND_001/002`. Testes unitários a passar.

- [x] **3. Endpoints** — ✅ 2026-10-20 (`backend/test/keybindings.test.ts`, 14 testes; `curl` numa instância
  de teste: 401 sem sessão, PUT 200, colisão 409, `ctrl` 400 `COMMON_001`, `Escape` 400 `KEYBIND_001`, DELETE e
  reset a limpar o `state.json`)
  - Decisão ao implementar: um `modifier: 'ctrl'` dá `COMMON_001` (o esquema nem o deixa exprimir), e não
    `KEYBIND_001` como o critério original dizia. `KEYBIND_001` é para teclas não permitidas.
  - Ficheiros: `backend/src/keybindings/keybindings.routes.ts` (novo), `backend/src/app.ts` (registo),
    `docs/api.md`
  - Skill: `frontend-error-handling` (para os códigos) · `/implement-todo`
  - Tier: `sonnet`
  - Aceite quando: `curl` com sessão: GET devolve o efetivo; PUT com colisão devolve 409; PUT com
    `Ctrl` devolve 400; DELETE e POST reset repõem; sem sessão devolvem 401. Alteração persiste após
    reinício do backend.

- [x] **4. Mapa efetivo no hook de atalhos e no terminal** — ✅ 2026-10-20
  - Decisões ao implementar: `hooks/useTerminalShortcuts.ts` **saiu**, substituído por
    `keyboard/shortcuts.ts` (funções puras, usadas pelo xterm, pelos listeners e pela captura) +
    `hooks/useShortcuts.ts`. O mapa vive num `KeybindingsProvider` no `AppLayout`, com um `indexRef` que o
    xterm lê sem se voltar a registar. "Ir para Terminais/Biblioteca" corre num listener do `AppLayout`
    (tem de funcionar nas duas páginas); o resto no `TerminalsPage`. Só as combinações **com bind** deixam de
    chegar ao PTY — um `Alt+B` sem bind volta a ir para o shell (antes, qualquer combinação da app era cortada).
  - Ficheiros: `frontend/src/hooks/useTerminalShortcuts.ts`, `frontend/src/hooks/useKeybindings.ts` (novo),
    `frontend/src/services/keybindingService.ts` (novo), `frontend/src/components/terminals/TerminalView.tsx`,
    `frontend/src/pages/TerminalsPage.tsx`
  - Skill: `frontend-design-system` + `frontend-error-handling`
  - Tier: `sonnet`
  - Aceite quando: as ações atuais funcionam com o mapa carregado do servidor (sem alterações, igual ao
    comportamento de hoje); as ações novas executam; no terminal em foco o atalho chega ao hook (não ao PTY).

- [x] **5. Secção "Atalhos" nas Definições** — ✅ 2026-10-20
  - Decisão ao implementar: sem React Hook Form (não há texto livre nem regras no cliente — regra 5 de
    `frontend-design-system`). A colisão mostra o nome da ação a partir da vista que o frontend já tem, antes
    de enviar; o 409 do servidor fica como rede de segurança.
  - Ficheiros: `frontend/src/components/settings/ShortcutsSection.tsx` (novo),
    `frontend/src/components/settings/ShortcutCapture.tsx` (novo), `frontend/src/components/settings/SettingsDrawer.tsx`
  - Skill: `frontend-design-system` · `frontend-error-handling`
  - Tier: `sonnet`
  - Aceite quando: captura grava; `Esc` cancela; `Ctrl` recusado com aviso; colisão mostra o nome da
    ação; aviso de Claude Code aparece e grava se confirmado; "Remover" deixa sem bind; "Repor predefinidos"
    volta tudo.

- [x] **6. Verificação** — ✅ 2026-10-20: **40/40** em Chrome headless via CDP (DOM + rede), numa instância
  de teste (porta 7498, credenciais geradas na hora, `DATA_DIR` próprio, SPA do `frontend/dist`, um `claude`
  real num terminal). Fase 1 (32): gravar, colisão com nome, Esc sem fechar o drawer, Ctrl recusado,
  `Alt+F4` recusado pelo servidor, aviso de `Alt+B` e "Gravar mesmo assim", remapear a lateral, remover e
  repor, `Alt+L` com o foco **dentro do terminal** a ir para a Biblioteca, recarregar. Fase 2 (8), depois de
  reiniciar o backend: as binds continuam, "Repor predefinidos" pede confirmação e deixa `keybindings: {}`.
  Sem erros na consola. 259 testes do backend a passar.
  - Testes: backend com os testes relevantes a passar (estado, validação, rotas).
  - Browser (inline, não em subagente): DOM + rede, não screenshot. Escrever uma bind de teste, usá-la,
    recarregar, reiniciar o backend, repor. Os atalhos de teste devem ser repostos no fim.
  - Aceite quando: o caminho "como sei que está bem feito" da secção 1 passa e fica registado em
    `notes/whatIveDone.md`. Se o browser não estiver disponível, fica em `notes/verificacao-browser-pendente.md`.

- [x] **7. Documentação** — ✅ 2026-10-20 (`api.md`, `database.md`, `code-map.md`, `frontend-conventions.md`,
  `terminais.md`, `use-cases.md`, `design/buttons-and-icons.md`)
  - Ficheiros: `docs/features/terminais.md` (§Atalhos), `docs/frontend-conventions.md` (linha dos atalhos),
    `docs/product/use-cases.md`, `docs/api.md` (feito no passo 3), `docs/code-map.md`
  - Skill: `/implement-todo` (Final Checklist)
  - Tier: `sonnet`
  - Aceite quando: nenhum documento diz que os atalhos são fixos; `code-map` aponta para os ficheiros novos.

## 6. Estado atual

> ⚠️ **Atualizar SEMPRE no fim de cada sessão.** É a secção que torna esta spec retomável.

**Feito:** os 7 passos (2026-10-20; passo 1 em modo NORMAL, 2-7 em LAZY a pedido do dono). Ver as notas
"Decisão ao implementar" de cada passo na secção 5.
**Em curso:** nada.
**Próxima ação concreta:** nenhuma nesta spec. As ações novas continuam sem bind até o dono lhes dar uma nas
Definições.
**Desvios ao plano:**
- Forma da bind `{ modifier, code }` em vez de `{ alt, altGraph, code }` (passo 1).
- Catálogo só no backend, sem espelho no frontend; sem `validate.ts` à parte (passo 2).
- `useTerminalShortcuts.ts` substituído por `keyboard/shortcuts.ts` + `useShortcuts.ts` (passo 4).
- `Ctrl` responde `COMMON_001`, não `KEYBIND_001` (passo 3).
**O que uma sessão nova precisa de saber:**
- `StateStore.update` aplica `stateSchema.parse` ao rascunho. Acrescentar `keybindings` ao esquema sem
  `STATE_VERSION` 2 e sem o passo de migração faz falhar o arranque de um `state.json` v1.
- O `attachCustomKeyEventHandler` do xterm (`TerminalView.tsx`), os listeners (`useShortcuts.ts`) e a
  captura (`ShortcutCapture.tsx`) usam todos `keyboard/shortcuts.ts`. Uma regra de teclas nova muda-se lá.
- O `AltGr+.` é detetado por `getModifierState('AltGraph')` (`bindingFromEvent`) e gravado como
  `modifier: 'altGraph'`. O CDP não simula AltGr — essa combinação não foi verificada no browser, só os
  `Alt+…`.
- Uma ação nova: acrescentá-la ao catálogo do backend **e** ao `switch` de quem a executa (`TerminalsPage`
  ou `NavigationShortcuts` no `AppLayout`). Sem o segundo, aparece nas Definições e não faz nada.
- As Definições já têm uma secção de passkeys que só monta com o drawer aberto
  (`SettingsDrawer.tsx`). Seguir o mesmo padrão para a secção de atalhos.

## 7. Perguntas em aberto

| Pergunta | Bloqueia | Notas |
|---|---|---|
| Qual a bind de cada ação nova? | Não | Ficam sem bind até o dono decidir. Pode ser feito pela própria UI depois. |
| Lista exata de combinações que avisam (Claude Code/shell) | Não | Começar com `Alt+B`, `Alt+F`, `Alt+D`, `Alt+.`, `Alt+Backspace`; rever no passo 2. |

## Relacionado

[[skill-plan-feature]] · [[skill-implement-todo]] · [[../adr/0016-atalhos-editaveis-no-state|ADR 0016]] · [[terminais]] · [[../adr/README]]
