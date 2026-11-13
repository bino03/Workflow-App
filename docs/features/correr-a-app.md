# Feature: Correr e parar a app de um projeto

| | |
|---|---|
| **Estado** | 🚧 Em curso |
| **Criada** | 2026-11-12 |
| **Última sessão** | 2026-11-13 |
| **Passos** | 6 / 8 concluídos (1-6) |

> Escrita para uma sessão que **não viu a conversa que a originou**. Se algo só faz sentido com contexto
> externo, falta escrevê-lo.

---

## 1. O que é e porquê

Para ver a app de um projeto a correr, hoje o dono abre um terminal desse projeto e escreve `/run`; para a
parar, pede ao mesmo Claude (que é o único que sabe os IDs das tarefas em background) ou fecha o terminal. O
terminal fica a ocupar um lugar da grelha só para manter a app viva, e não há nada que diga, de relance, se
a app está a correr e há quanto tempo. Pedido verbatim (2026-11-12): *"um botão para correr o /run e outro
para fechar, mas para isto precisa de uma skill de /stop (ou com outro nome) para poder facilitar o
processo de correr uma app e matar a instância da app, claro que ao correr a app deveria aparecer algo que
mostrasse que a app está a correr (e há quanto tempo)"*.

**Como sei que está bem feito:** na página Terminais, com o separador de um projeto gerado pelo Workflow
aberto (em grelha **ou** em foco), carrego em **Correr** ao lado do seletor de visualização; o indicador
passa a "A arrancar…" e depois a "● A correr · 0 min · :5173" (a porta é um link para
`http://localhost:5173`), e o tempo vai subindo. Nenhum terminal novo aparece na grelha. Carrego em
**Parar**: o indicador passa a "A parar…" e volta a mostrar **Correr**; as portas deixam de escutar.

## 2. Âmbito

### Dentro
- Botões **Correr** / **Parar** e um indicador de estado por projeto, num **cabeçalho comum** aos dois
  modos (grelha e foco dividido), à direita, logo à esquerda do seletor de grelha (que só existe na grelha).
- **Correr** abre um terminal **sempre escondido** no projeto, com a conta ativa, cuja primeira mensagem é
  `/run`. A app está "a correr" quando há portas em escuta abaixo desse terminal (`devPortsOf`).
- **Parar** escreve `/stop` nesse mesmo terminal (a mesma conversa sabe os IDs das tarefas); se ao fim de
  20 s ainda houver portas, fecha o terminal (o `close` já mata a árvore de processos). No fim fecha sempre
  o terminal escondido.
- Indicador: "A arrancar…" → "A correr · <tempo> · :<porta>[, :<porta>]" (tempo desde que a primeira porta
  abriu; cada porta é um link `http://localhost:<porta>`) → "A parar…" → volta a Correr.
- Erros: "Não arrancou" (3 min sem nenhuma porta, ou o terminal terminou sem portas) e "Parou sozinha"
  (as portas desapareceram com a app a correr), ambos com o botão **Ver terminal**. É a única maneira de
  o terminal escondido aparecer (o `reveal` que já existe).
- **Skill nova `/stop` no Workflow, obrigatória** (aplica-se "sempre", como o `/run`), gerada pelo `/create`
  e pelo `/adopt-project` e levada aos projetos existentes pelo `/upgrade-project`.
- A app só mostra os botões quando o projeto tem **as duas** skills (`.claude/skills/run/SKILL.md` e
  `.claude/skills/stop/SKILL.md`). Se um dia o `/create` deixar de as gerar, os botões somem sozinhos.
- A própria Workflow App **nunca** mostra os botões (correr o `/run` dela a partir dela mata-a — regra 8 do
  `CLAUDE.md`, [[../commands]]).

### ⛔ Fora — não implementar nesta feature
- **Tarefas por nome** (`npm run <script>` sem o Claude) — é outro pilar em `notes/ideas.md`; aqui quem
  arranca é sempre o `claude` com o `/run` do projeto.
- **Aprovar permissões sozinho** no terminal do `/run` (`--permission-mode` ou hooks): corre no modo da conta,
  como um terminal normal. Se ficar preso, vê-se pelo "Não arrancou" + Ver terminal.
- O estado "Precisa de ti" no indicador — depende dos hooks de estado das sessões (ToDo → Terminais); até lá,
  só o limite de 3 min.
- Ver os logs da app na UI, reiniciar sozinho quando a app morre, arrancar ao abrir o projeto.
- Mais do que uma instância por projeto; correr em várias contas.
- Pré-visualização (`tailscale serve`) automática ao arrancar — continua a pedido ([[pre-visualizacao]]).
- Botões no Telegram, na lateral, nos separadores ou na página Projetos.
- Sobreviver a um reinício do backend: os PTYs morrem com ele, e a app com eles; o estado vive em memória.
- Correr a própria Workflow App.

> Esta lista impede uma sessão futura de expandir o âmbito sozinha.

### Segunda fase (se houver)
- "Precisa de ti" no indicador, quando o estado das sessões existir.
- Abrir a pré-visualização a partir do indicador; ver o estado também na página Projetos.

## 3. Decisões tomadas

| Decisão | Escolha | Porquê | Alternativa rejeitada |
|---|---|---|---|
| Quem arranca | O `claude` com o `/run` do projeto, num terminal escondido | O `/run` já sabe pré-requisitos, marcadores e health checks de cada stack; continua a ser a subscrição (ADR 0002) e só `CLAUDE_BIN` (ADR 0004) | Lançar `npm run` direto (é o pilar Tarefas, e abre o ponto 4 do ADR 0004) |
| Como parar | `/stop` na mesma conversa + fechar o terminal se ao fim de 20 s ainda houver portas | A conversa do `/run` tem os IDs das tarefas; o `/stop` também desliga o que não é descendente (ex.: `docker compose down`); a rede garante que nunca fica pendurado | Só fechar o terminal (não desliga o que está fora da árvore); só `/stop` (pode falhar) |
| `/stop` obrigatório | Skill "sempre" no Workflow, e a app deteta-a no disco | O dono quer que todos os projetos a tenham; detetar no disco faz a UI acompanhar uma mudança futura no `/create` | Botões sempre visíveis (enviavam `/stop` a quem não o tem) |
| Terminal visível? | Sempre escondido; só aparece por **Ver terminal** num erro | Não ocupa lugares da grelha; um erro tem de ter saída | Visível na grelha |
| Preso (permissão, sem porta) | 3 min sem porta → "Não arrancou" + Ver terminal | Sem hooks de estado não se sabe se está à espera; o limite cobre isso | Aprovar tudo sozinho (corre comandos sem ninguém validar) |
| Sítio na UI | Cabeçalho "Terminais · N abertos" **comum** à grelha e ao foco, controlo à direita | Mesmo sítio nos dois modos; mudar de modo não mexe no layout | Barra dos separadores (muda o layout ao trocar de modo); só na grelha; barra de estado em baixo |
| Quando está "a correr" | Há portas em escuta abaixo do terminal; tempo desde a primeira porta | Reutiliza `devPortsOf` da pré-visualização; não depende de ler o ecrã | Ler a resposta do Claude no `.jsonl` |
| Atualização | Pelas sondagens (o frontend lê o estado a cada poucos segundos) | O canal de eventos ainda não existe | Esperar pelo `/api/events` |

**ADRs gerados:** app **0030** e Workflow **0013** (passo 1). Reabre o "Fora" de [[pre-visualizacao]]
("Arrancar o servidor de dev pela app") — a spec da pré-visualização não se edita no "Fora"; acrescenta-se um
link para esta.

## 4. Desenho técnico

### 4.1 Dados
Nenhum ficheiro novo. O terminal do `/run` é um terminal guardado como os outros (`state.json`, ADR 0009)
com um campo novo `appRun: boolean` (por omissão `false`) em `SavedTerminal`. **Atenção:** o
`isLoginTerminal` (`backend/src/terminals/terminalsService.ts:40`) assume "escondido e sem importId nem
guidedId = login" — tem de passar a excluir `appRun`. No arranque do backend, os terminais `appRun`
guardados são apagados (a app morreu com o backend). O estado da execução (fase, `startedAt`, `runningSince`,
portas, erro) vive **em memória** no `AppRunService`.

### 4.2 Endpoints
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/app-runs?path=<projeto>` | sessão | Estado da execução de um projeto (`AppRunView`) |
| POST | `/api/app-runs` | sessão | `{ path }` → abre o terminal escondido com `/run`; 409 se já há uma |
| POST | `/api/app-runs/stop` | sessão | `{ path }` → `/stop` + rede de 20 s |
| POST | `/api/app-runs/reveal` | sessão | `{ path }` → mostra o terminal (`reveal`) e devolve o `terminalId` |

`path` validado pelo `cwdPolicy` (`realpath` dentro de `ALLOWED_ROOTS`) e recusado se for a pasta da
própria Workflow App. Atualizar [[../api]].

### 4.3 Tipos / DTOs
```ts
type AppRunPhase = 'unavailable' | 'idle' | 'starting' | 'running' | 'stopping' | 'failed';
type AppRunView = {
  path: string;
  phase: AppRunPhase;
  /** Why 'unavailable': no run/stop skill, or the Workflow App itself. */
  unavailableReason: 'missing-skills' | 'self' | null;
  terminalId: string | null;
  startedAt: string | null;      // click on Correr
  runningSince: string | null;   // first port seen
  ports: number[];
  error: 'no-port' | 'exited' | 'ports-gone' | null;
};
```
- `starting` → `running` na primeira sondagem com portas; `starting` há 3 min sem portas, ou o terminal
  termina → `failed` (`no-port` / `exited`); `running` sem portas → `failed` (`ports-gone`).
- O `/stop` escreve-se com `bracketedPaste('/stop')` + Enter (`backend/src/terminals/paste.ts`); o Claude
  Code põe em fila uma mensagem escrita a meio de um turno.
- O `/run` é a primeira mensagem do terminal, como o `/login` do `createLogin` (`terminalsService.ts:268`):
  um `createAppRun({ cwd, accountId, cols, rows })` novo, que só o módulo `appRuns` chama.

### 4.4 Interface
- **Onde vive:** página Terminais, cabeçalho "Terminais · N abertos" — hoje dentro de
  `frontend/src/components/terminals/TerminalGrid.tsx`; passa para `TerminalsHeader.tsx`, usado pela grelha
  **e** pelo `<main>` do foco dividido em `frontend/src/pages/TerminalsPage.tsx`. O seletor de grelha só na
  grelha; o controlo novo fica à esquerda do seletor e **continua visível com um terminal ampliado**.
- **Ficheiros:** `frontend/src/components/terminals/AppRunControl.tsx`, `frontend/src/hooks/useAppRun.ts`
  (sondagem, só para o projeto ativo), `frontend/src/services/appRunService.ts`,
  `frontend/src/types/appRun.ts`.
- **Estados:** `idle` → botão **Correr** · `starting` → arco a rodar + "A arrancar…" · `running` → ponto
  verde + "A correr · 12 min · :5173" + **Parar** · `stopping` → "A parar…" (botão desativado) · `failed` →
  "Não arrancou" / "Parou sozinha" em `--wfa-state-err` + **Ver terminal** + **Correr** · `unavailable` →
  nada (o controlo não aparece). Cores e formas: [[../skills/references/design/tokens-and-colors]] §3, cor
  **e** forma.
- **Sem projeto ativo:** não aparece.

### 4.5 Códigos de erro novos
| Código | HTTP | Mensagem no frontend |
|---|---|---|
| `APPRUN_001` | 409 | "A app deste projeto já está a correr." |
| `APPRUN_002` | 422 | "Este projeto não tem as skills /run e /stop." |
| `APPRUN_003` | 404 | "A app deste projeto não está a correr." |

Espelhar em `frontend/src/errors/errorMessages.ts` (skill `frontend-error-handling`). Números a confirmar
contra o `ErrorCodes` do backend no passo 3.

## 5. Passos

Ordem obrigatória. Tiers: `opus` (desenho, não delegar) · `sonnet` (implementação) · `haiku` (mecânico).

- [x] **1. ADRs**
  - Ficheiro: `docs/adr/0030-correr-e-parar-a-app-de-um-projeto.md` (+ linha em `docs/adr/README.md`);
    no Workflow, `C:\Users\jlalv\Desktop\Workflow\Workflow\docs\adr\0013-skill-stop-obrigatoria.md`
  - Skill: `engineering:architecture`
  - Tier: `opus`
  - Aceite quando: o 0030 regista as decisões da §3 (terceiro tipo de terminal escondido, `/run` como primeira
    mensagem, `/stop` escrito no PTY, rede de 20 s, limite de 3 min, recusar a própria app) e referencia
    0002/0004/0018/0020; o 0013 do Workflow regista o `/stop` "sempre"; [[pre-visualizacao]] ganha um link
    no "Fora" para esta spec.

- [x] **2. Skill `/stop` no Workflow, obrigatória**
  - Ficheiro: `library/skills/process/skill-stop.md` (nova; usa `{{RUN_STOP}}` e `{{RUN_PORTS}}`),
    `library/skills/process/skill-run.md` (a secção "Parar" passa a apontar para o `/stop`),
    `library/skills/README.md` (linha "**sempre**"), `docs/placeholders.md`, o que o `/create`, o
    `/adopt-project` e o `/upgrade-project` usam para gerar os ponteiros — tudo no repositório do Workflow
  - Skill: `create-new-skill` (do Workflow)
  - Tier: `opus`
  - Aceite quando: o `/stop` (1) na conversa que fez o `/run`, para as tarefas pelos IDs e o que foi
    arrancado à parte (`docker compose down`…); (2) noutra conversa, encontra os processos a escutar nas
    portas do projeto, confirma que pertencem à pasta do projeto, e só então os mata — nunca por nome às
    cegas; confirma por fora que as portas fecharam. Um `/create` de teste gera `.claude/skills/stop/SKILL.md`;
    o `/upgrade-project` acrescenta-o a um projeto antigo. Commit no Workflow.

- [x] **3. Backend: terminal do `/run` e `AppRunService`**
  - Ficheiro: `backend/src/terminals/terminalsService.ts` (`appRun`, `createAppRun`, `isLoginTerminal`,
    limpeza no arranque), `backend/src/appRuns/appRunService.ts` (novo), `backend/src/appRuns/appRun.schemas.ts`
  - Skill: `add-backend-feature` (stack `node-fastify`) · ler [[../backend-conventions]]
  - Tier: `sonnet`
  - Aceite quando: testes com `devPortsOf` e o terminal falsos cobrem `idle → starting → running →
    stopping → idle`, os 3 erros, a rede de 20 s (fecha o terminal), o 409 de uma segunda execução, o
    `missing-skills` e o `self`; um terminal `appRun` guardado não é tomado por login nem aparece em `list()`.

- [x] **4. Backend: rotas**
  - Ficheiro: `backend/src/appRuns/appRun.routes.ts` (novo), registo em `backend/src/app.ts`,
    `docs/api.md`, códigos de erro
  - Skill: `add-backend-feature`
  - Tier: `sonnet`
  - Aceite quando: as 4 rotas exigem sessão, validam `path` pelo `cwdPolicy`, recusam a pasta da própria
    app; testes de rota passam; `docs/api.md` atualizado.

- [x] **5. Frontend: cabeçalho comum**
  - Ficheiro: `frontend/src/components/terminals/TerminalsHeader.tsx` (novo, sai de `TerminalGrid.tsx`),
    `frontend/src/pages/TerminalsPage.tsx` (usar no foco dividido)
  - Skill: `frontend-design-system`
  - Tier: `sonnet`
  - Aceite quando: a linha "Terminais · N abertos" + contagens aparece igual nos dois modos; o seletor só na
    grelha; nada mais muda (cenários de `scripts/verify/` passam).

- [x] **6. Frontend: `AppRunControl`**
  - Ficheiro: `frontend/src/types/appRun.ts`, `frontend/src/services/appRunService.ts`,
    `frontend/src/hooks/useAppRun.ts`, `frontend/src/components/terminals/AppRunControl.tsx`,
    `frontend/src/errors/errorMessages.ts`
  - Skill: `frontend-design-system`, `frontend-error-handling`
  - Tier: `sonnet`
  - Aceite quando: os 6 estados da §4.4 desenham-se com os tokens; o tempo atualiza a cada minuto sem nova
    sondagem; as portas são links; Ver terminal mostra o terminal na grelha; o controlo fica visível com um
    terminal ampliado.

- [ ] **7. Levar o `/stop` aos projetos existentes e a este**
  - Ficheiro: `docs/skills/process/skill-stop.md` + `.claude/skills/stop/SKILL.md` nesta app (os botões
    continuam escondidos aqui — `self`, mas a skill serve o dono no terminal); `/upgrade-project` nos
    projetos de teste
  - Skill: `create-new-skill`
  - Tier: `sonnet`
  - Aceite quando: um projeto de teste tem as duas skills e a app mostra-lhe os botões; um sem `/stop` não.

- [ ] **8. Verificação real no browser**
  - Ficheiro: cenário novo em `scripts/verify/` (ex.: `app-run.mjs`)
  - Skill: `run` + [[../skills/references/testing-and-verification]] (inline, nunca num subagente)
  - Tier: `sonnet`
  - Aceite quando: num projeto real gerado pelo Workflow, em grelha e em foco: Correr → "A correr" com a porta
    certa e o tempo a subir, nenhum terminal novo na grelha; o link abre a app; Parar → as portas fecham e
    volta a Correr; um projeto com o `/run` partido mostra "Não arrancou" + Ver terminal; a página da própria
    Workflow App não tem o controlo. Spec → ✅ e entrada em `notes/whatIveDone.md`.

## 6. Estado atual

> ⚠️ **Atualizar SEMPRE no fim de cada sessão.** É a secção que torna esta spec retomável.

**Feito:** passos 1-6 ✅. Passo 1: ADR **0030** da app (`aceite`) + ADR **0013** do Workflow (`aceite`, 2026-11-13); o "Fora" da [[pre-visualizacao]] tem o link.
- Passo 2 (2026-11-13, commit `6904f56` no Workflow, sem push): `library/skills/process/skill-stop.md` (`applies-when: always`, **`prospective`** até o passo 8 a provar — depois `proven` no Workflow). Dois modos: na conversa do `/run`, pelos IDs + `{{RUN_STOP}}` (`docker compose down` sem perguntar), sem perguntas nem relatório longo (a app só dá 20 s); depois **sempre** `netstat` por fora; o que ainda escuta → PID pela porta, linha de comando e executável do PID e dos pais (`Get-CimInstance Win32_Process`, até 8 níveis; Linux `/proc/<pid>/cwd`); mata (`taskkill /T /F`) só se aparece o caminho do projeto, senão pergunta. Noutra conversa, `docker compose ps` e perguntar antes do `down`. Peças sem porta só pelos IDs. O "Parar" da `skill-run` passa a apontar para o `/stop`; `/adopt-project` lista-a; `/upgrade-project` diz que os `RUN_*` vêm da `skill-run.md` do filho; `placeholders.md`, `provenance.md`, README da biblioteca. Provado: `audit-library` e `dry-run` 0 erros; o `dry-run --out` (fixture `own-api-node`) gera `.claude/skills/stop/SKILL.md` + `docs/skills/process/skill-stop.md` com o aviso 🚧 e as entradas nos índices; o `upgrade-report` contra esta app lista `stop` em "Skills novas…" e o "Parar" da `skill-run` como 🟡 parcial.
- Passo 3: `backend/src/appRuns/appRunService.ts` + `appRun.schemas.ts` (`AppRunView`, fases da §4.3, `/stop` por `paste` e rede de 20 s; com as portas fechadas espera que o turno acabe — `waitForQuiet`, 2 s de silêncio — antes de fechar; `pid <= 0` → sem portas; o GET atualiza a pedido, sem timers). `dropAppRuns()` chamado em `buildApp`. Testes: `test/appRunService.test.ts` (12) + 4 em `terminalsService.test.ts` (`/run` como 1.ª mensagem, escondido e fora do `list()`, não é login, conta para o `MAX_TERMINALS`, `dropAppRuns` só leva os `appRun`). Suite 543/543; `tsc` só com o erro antigo de `test/auth.test.ts`; `eslint .` limpo.
- Passo 4: `backend/src/appRuns/appRun.routes.ts` (as 4 rotas, `appRunPathSchema` estrito), `AppRunService` montado em `buildApp` (`pidOf` = `terminalManager.get(id)?.pid`, `devPorts` = `devPortsOf` sem a `PORT`, `selfPath` = raiz do repo por `import.meta.url`; `AppDeps.appRuns` para os testes). `test/appRun.routes.test.ts` (4: sessão, validação, `self`/`missing-skills`, ciclo completo por HTTP com o claude falso). HTTP real numa instância `scripts/verify` (7498): 401, `missing-skills`, `idle`, `FOLDER_001`, `COMMON_001`, `APPRUN_002`, `TERMINAL_007` numa pasta não confiada sem deixar execução, `APPRUN_003` em Parar/Ver terminal. Docs: `api.md` (secção + `APPRUN_001-004`), `database.md` (`appRun`), `code-map.md`; `errorMessages.ts` do frontend já espelha os 4 códigos. Suite 548/548.
- Passos 5-6 (2026-11-13): `TerminalsHeader.tsx` (sai do `TerminalGrid`, que fica só o contentor; a página desenha-o por cima da grelha e do foco) + `AppRunControl.tsx`/`useAppRun.ts`/`appRunService.ts`/`types/appRun.ts`. Ver terminal → `navigate` com `focusTerminalId` (o mecanismo que já espera pela lista e amplia na grelha). Verificado no browser: `scripts/verify/app-run-ui.mjs` 26/26 (os 6 estados, portas como links, 11 → 12 min sem resposta nova, `1 h 05 min`, cor de erro, o mesmo cabeçalho nos dois modos, controlo à esquerda do seletor, Ver terminal ampliado com o controlo à vista, Alfa sem skills sem controlo, `TERMINAL_007` real ao Correr) e `terminal-menu.mjs` 42/42 (nada mais mudou). Em 9 corridas do `app-run-ui`, 2 falharam no último check com o último estado no ecrã — compatível com a instância que morre a meio (`docs/commands.md`), não confirmado.
**Em curso:** nada (entre passos).
**Próxima ação concreta:** passo 7 — o 7 tem o que copiar: `/upgrade-project` nesta app e nos projetos de teste aplica o `stop` (os `RUN_*` da `skill-run.md` de cada filho).
**Ainda por confirmar num terminal real** (passo 8): se o Claude Code põe em fila um `/stop` escrito a meio de um turno (§7) — a rede de 20 s cobre o caso em que não põe.
**Desvios ao plano:** decidido ao ler o código — o `TerminalView` não ganha campo novo (`hidden` basta); `/stop` num estado `failed` fecha o terminal e volta a `idle`; `Correr` num `failed` fecha o terminal antigo e arranca outro; o `appRun` guardado não deixa histórico ao fechar. **Novo código `APPRUN_004`** (422, "The Workflow App cannot run itself") para recusar a própria app — o `APPRUN_002` diria "falta a skill", o que é falso; uma subpasta da app também é recusada. Ao fechar uma execução com as portas já fechadas, espera-se o fim do turno do `/stop` (até ao fim dos 20 s) para não matar um `docker compose down` a meio. O terminal escondido abre com 120×32. **Frontend (2026-11-13):** **Parar** também em `starting` (o backend aceita; corta um arranque preso numa permissão sem esperar os 3 min). A sondagem é por fase (2 s a arrancar/parar, 5 s a correr, 10 s parado/erro, 30 s indisponível) com `setInterval` — um `setTimeout` por resposta parava de vez se disparasse com a janela escondida (apanhado pelo cenário). O tempo sobe por um relógio de 15 s (até 15 s de atraso no minuto mostrado). **Encontrado pelo teste de rota:** a execução só se esquece **depois** de o `close` acabar (~1,6 s a matar a árvore) — antes, o GET dizia `idle` com o terminal ainda vivo e um Correr nesse intervalo abria um segundo.
**O que uma sessão nova precisa de saber:** o passo 2 é **noutro repositório** (o Workflow, em `WORKFLOW_PATH`)
e é o que torna o `/stop` obrigatório; sem ele, o passo 7 não tem o que copiar. O terminal do `/run` é o terceiro
tipo de terminal escondido — rever todos os sítios que tratam `hidden` (`list()`, `isLoginTerminal`, a grelha,
o bot do Telegram).

## 7. Perguntas em aberto

| Pergunta | Bloqueia | Notas |
|---|---|---|
| ~~O terminal do `/run` conta para o `MAX_TERMINALS`?~~ | — | ✅ **Conta** (dono, 2026-11-12; ADR 0030 ponto 7) — já acontecia: o `TerminalManager` conta todos os PTYs a correr |
| O Claude Code põe mesmo em fila um `/stop` escrito a meio de um turno? | Passo 3 | Confirmar num terminal real; se não, esperar que o `/run` acabe o turno ou fechar logo |
| ~~Como o `/stop` encontra a pasta de um processo em Windows sem ser pelo nome~~ | — | ✅ PID pela porta → linha de comando/executável do PID e dos pais; sem o caminho do projeto, pergunta (dono, 2026-11-13; ADR 0013 do Workflow) |

## Relacionado

[[pre-visualizacao]] · [[terminais]] · [[contas-do-claude]] · [[../skills/process/skill-run]] ·
[[skill-plan-feature]] · [[skill-implement-todo]] · [[../adr/README]]
