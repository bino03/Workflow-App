# Feature: Várias contas do Claude

| | |
|---|---|
| **Estado** | 🚧 Em curso |
| **Criada** | 2026-11-01 |
| **Última sessão** | 2026-11-05 |
| **Passos** | 9 / 10 concluídos |

> Escrita para uma sessão que **não viu a conversa que a originou**. Se algo só faz sentido com contexto
> externo, falta escrevê-lo.

---

## 1. O que é e porquê

O dono tem mais do que uma subscrição do Claude. Hoje, para mudar de conta, faz `/logout` e `/login` num terminal,
abre o link no browser onde está a conta certa e cola o código no terminal. Repete isto **a cada troca**, e todos os
terminais ficam sempre na mesma conta. Quando a quota de uma conta acaba a meio de uma conversa, não há forma simples
de continuar com a outra.

**Como sei que está bem feito:** a quota da conta A acaba. Escolho a conta B no menu do cabeçalho, sem login nenhum,
e carrego em "Continuar noutra conta" no terminal parado. A mesma conversa continua na conta B, e a barra lateral
passa a mostrar a quota de B. O login de cada conta fez-se **uma vez** e nunca mais.

## 2. Âmbito

### Dentro
- Contas extra criadas pela app ("Adicionar conta"), cada uma com a sua pasta de configuração e o login feito uma vez
  num terminal da app.
- **Conta ativa** escolhida no menu do cabeçalho. É a omissão de tudo o que se cria: terminais, sessões guiadas,
  importações, Upwork e bot do Telegram.
- Escolher outra conta **por terminal**: ao criar um terminal novo, ao retomar uma conversa gravada, e ao reabrir um
  terminal parado ("Continuar noutra conta"), com aviso do tamanho do contexto.
- Quota **por conta**. A barra lateral mostra só a da conta ativa e o painel de contas mostra a de todas.
- Partilhados entre contas: conversas e memória (`projects/`), skills, plugins, agents, commands, mods
  (`dev-mods/`), `settings.json`, `CLAUDE.md`, `keybindings.json` e os servidores MCP do utilizador (a chave
  `mcpServers` do `.claude.json`). Os connectors do claude.ai (Gmail, Drive…) são da conta e não entram aqui.
- Renomear e remover contas extra. A remoção apaga a pasta e o login.

### ⛔ Fora — não implementar nesta feature
- **Automatizar o próprio OAuth** (abrir o link, apanhar o código). Faz-se à mão **uma vez** por conta, no terminal
  que a app abre. Automatizar isto mexe no fluxo de login da Anthropic e não compensa para um gesto único.
- **Trocar a conta de um `claude` que já está a correr.** Só se muda ao (re)abrir.
- **Mudar de conta sozinho** quando a quota acaba (failover automático). O dono decide, porque o custo do contexto
  é real (ver §3).
- Guardar ou transferir a cache de prompts entre contas. Não é possível: vive nos servidores, fica presa à conta e
  expira em minutos.
- `claude setup-token` / `CLAUDE_CODE_OAUTH_TOKEN` e API keys (ADR 0002, ADR 0027).
- Partilhar `history.jsonl` (histórico de prompts do ↑) e a confiança das pastas entre contas.
- Editar as skills ou os settings de uma conta extra em separado. A principal é sempre a fonte.
- Mover a conta principal para `DATA_DIR/accounts/`.

### Segunda fase (se houver)
- Botão "Mudar para <outra conta>" no aviso dos 90% do limite da sessão (o aviso é um item próprio do
  [[../../notes/ToDo|ToDo]], que não depende desta spec; aqui só se acrescenta o botão).
- Escolher a conta no bot do Telegram (`/conta`).

## 3. Decisões tomadas

| Decisão | Escolha | Porquê | Alternativa rejeitada |
|---|---|---|---|
| Mecanismo | Uma pasta `CLAUDE_CONFIG_DIR` por conta | Login uma vez; contas em simultâneo; o `claude` não precisa de nada especial | Trocar o `.credentials.json`: uma conta por máquina, e os terminais a correr reescrevem o token (ADR 0027) |
| Onde vivem | Principal = a pasta de hoje (`CLAUDE_CONFIG_DIR` ou `~/.claude`), id `primary`; extra = `DATA_DIR/accounts/<uuid>/` | Não mexer no que já funciona; o caminho deriva do id e nunca vem de um pedido | Mover tudo para `DATA_DIR` |
| Escolha | Conta ativa (seletor no menu do cabeçalho) + escolha por terminal | Dono: "Conta ativa + troca por terminal" | Só global; só por terminal |
| Partilha | `projects/`, `skills/`, `plugins/`, `agents/`, `commands/`, `dev-mods/` por junction/symlink; `settings.json`, `CLAUDE.md`, `keybindings.json` e a chave `mcpServers` do `.claude.json` copiados da principal antes de cada arranque | Dono: partilhar. Partilhar `projects/` dá uma só lista Retomar, a mesma memória, e torna "continuar noutra conta" um simples reabrir. Ficheiros não se ligam no Windows sem privilégios | Separar e copiar o `.jsonl` ao continuar |
| Continuar noutra conta | Sim, com aviso do tamanho | Dono: "sim, com aviso do tamanho". Ao retomar, o `claude` reenvia a conversa inteira, e a cache não passa de uma conta para a outra. Esperar que a quota volte e retomar na mesma conta horas depois custa o mesmo (a cache já expirou) | Não permitir |
| Tamanho do contexto | `usage` da última resposta do assistente no `.jsonl`: `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` | É o tamanho real do último pedido; não precisa de tokenizar | Estimar pelos bytes do ficheiro |
| Quota | Um ficheiro por conta. Barra lateral = só a ativa; painel "Escolher conta" (novo item **por cima de Definições** no menu do cabeçalho) = todas | Dono, textualmente | Todas sempre visíveis na barra |
| Adicionar | Pela app: cria a pasta e as ligações e abre uma janela por cima da página com um terminal escondido para o `/login` (revisto 2026-11-05) | Dono: "Pela app". Um login não é um projeto: como terminal normal, abria um separador chamado "projetos" (o nome da pasta de `DEFAULT_CWD`) | Linha no `.env` com reinício; terminal normal na grelha (o desenho original); página própria (uma rota para um gesto único) |
| Remover | Apaga a pasta e o login, **desfazendo as ligações primeiro**. Recusado com terminais a correr. Os terminais parados dessa conta passam para a principal | Dono: "Apaga a pasta e o login" | Só tirar da lista |
| Limite | 5 contas no total (principal incluída) | Um painel legível; a pasta de cada uma é pequena | Sem limite |

**ADRs gerados:** [[../adr/0027-varias-contas-do-claude|ADR 0027]] (`proposto` até ao passo 1).

## 4. Desenho técnico

### 4.1 Dados

Sem base de dados ([[../adr/0009-estado-em-ficheiro-json|ADR 0009]]). Campos novos no `state.json`
(`backend/src/state/state.schema.ts`), todos com `.default()`, **sem subir `STATE_VERSION`** (o padrão de
`remoteControl`/`importId`):

```ts
const accountIdSchema = z.union([z.literal('primary'), z.uuid()]);

export const accountSchema = z.object({
  id: z.uuid(),                                   // só as extra; a principal é implícita
  label: z.string().trim().min(1).max(40),        // mesma allowlist de labelSchema
  createdAt: instant,
});

// stateSchema
accounts: z.array(accountSchema).max(4).default([]),
activeAccountId: accountIdSchema.default('primary'),
primaryAccountLabel: z.string().trim().min(1).max(40).nullable().default(null), // null → "Principal"

// savedTerminalSchema e closedTerminalSchema
accountId: accountIdSchema.default('primary'),
```

Um `activeAccountId` ou `accountId` que aponte para uma conta que já não existe é lido como `primary`
(`accountsService.resolve`). Não é erro.

**Pastas** (`backend/src/accounts/accountDirs.ts`):
- `primaryDir = config.terminals.claudeConfigDir ?? ~/.claude`; `.claude.json` da principal = `claudeJsonPath()`
  existente (`sessions/claudeTrust.ts:14`).
- `extraDir(id) = DATA_DIR/accounts/<id>` (o `id` é validado como UUID antes de entrar no caminho); `.claude.json`
  = `extraDir/.claude.json`.
- `SHARED_DIRS = ['projects', 'skills', 'plugins', 'agents', 'commands', 'dev-mods']`: criadas na principal se não existirem, e
  ligadas com `fs.symlink(target, path, 'junction')` (no Linux o tipo é ignorado e fica um symlink).
- `SYNCED_FILES = ['settings.json', 'CLAUDE.md', 'keybindings.json']`: copiados da principal se existirem
  (`syncSharedFiles(id)`, chamado antes de cada spawn de uma conta extra). Se a principal não tiver o ficheiro, a
  cópia na extra é apagada.
- **Servidores MCP do utilizador** (`syncMcpServers(id)`, no mesmo momento): os `claude mcp add -s user` vivem na
  chave `mcpServers` do `.claude.json`, que é **separado** por conta. Antes de cada spawn, copia-se só essa chave do
  `.claude.json` da principal para o da extra (ler → substituir a chave → escrever por cima com rename atómico); o
  resto do ficheiro da extra (`oauthAccount`, confiança das pastas) não se toca. Sem `mcpServers` na principal, a chave
  é apagada na extra.
- **Separado de propósito**: `daemon/`, `daemon.lock` (o supervisor das sessões em background) e `sessions/` (o
  registo dos `claude` a correr). Cada conta tem o seu supervisor; partilhá-los punha dois a escrever no mesmo sítio.
- `loginState(dir)`: `{ loggedIn, email }`. `loggedIn` exige `.credentials.json` **e** `oauthAccount` no
  `.claude.json`; `email = oauthAccount.emailAddress`. Nunca devolve tokens.
- `removeExtraDir(id)`: primeiro `unlink` de cada ligação de `SHARED_DIRS`, confirmada com `lstat().isSymbolicLink()`
  (no Node, uma junction também dá `true`). Só depois faz `fs.rm(dir, { recursive: true })`. Se alguma entrada de
  `SHARED_DIRS` for uma pasta verdadeira em vez de uma ligação, aborta com `ACCOUNT_005` e não apaga nada.

**Quota** (`backend/src/usage/usageFiles.ts`): o `statusLineScript` ganha `ACCOUNTS_DIR = DATA_DIR/accounts`. Se
`process.env.CLAUDE_CONFIG_DIR` estiver diretamente dentro dele e o nome for um UUID → `usage-<uuid>.json`; senão →
`usage.json` (a principal, compatível com o ficheiro de hoje). `readUsage(dataDir, accountId = 'primary')`.

### 4.2 Endpoints

Todos com sessão (`authGuard`), como o resto da API.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/accounts` | sessão | `{ activeAccountId, accounts: AccountView[] }`, principal primeiro |
| POST | `/api/accounts` | sessão | `{ label }` → cria a pasta e as ligações → `201 AccountView`. Limite → `ACCOUNT_002` |
| PATCH | `/api/accounts/:id` | sessão | `{ label }`. `primary` muda `primaryAccountLabel` |
| PUT | `/api/accounts/active` | sessão | `{ accountId }` → conta ativa |
| DELETE | `/api/accounts/:id` | sessão | `primary` → `ACCOUNT_003`; com terminais a correr → `ACCOUNT_004`; passa os terminais dessa conta (guardados e fechados) para `primary`, apaga a pasta → `204` |
| POST | `/api/accounts/:id/login` | sessão | `{ cols, rows }` → terminal novo nessa conta em `DEFAULT_CWD`, label `Login — <label>`, a primeira mensagem é `/login` se o spike o confirmar (ver §7) → `TerminalView` |
| GET | `/api/usage` | sessão | **Igual a hoje**, mas devolve a quota da conta **ativa** (a barra lateral não muda de chamada) |
| POST | `/api/terminals` | sessão | Ganha `accountId?` (omissão = ativa) |
| POST | `/api/terminals/:id/reopen` | sessão | Ganha `accountId?` (omissão = a do terminal). Uma conta diferente atualiza o `accountId` guardado |
| GET | `/api/terminals/:id/context` | sessão | `{ tokens: number \| null }` — tamanho do contexto da conversa (§3). `null` sem `.jsonl` |
| GET | `/api/sessions` | sessão | Cada sessão ganha `contextTokens: number \| null` e `accountId` (do fechado correspondente, se houver) |

As sessões guiadas (`guided/`), as importações (`imports/`), o Upwork e o bot (`telegram/botActions.ts`) não ganham
parâmetro: usam a conta ativa no momento em que criam, e reabrem na conta guardada.

### 4.3 Tipos / DTOs

```ts
// backend/src/accounts/accounts.schemas.ts  ↔  frontend/src/types/account.ts
type AccountId = 'primary' | string;
type AccountView = {
  id: AccountId;
  label: string;               // "Principal" se primaryAccountLabel for null
  isPrimary: boolean;
  email: string | null;        // oauthAccount.emailAddress
  loggedIn: boolean;
  runningTerminals: number;
  usage: UsageView;            // o tipo de hoje (usage/usageFiles.ts)
};
type AccountsView = { activeAccountId: AccountId; accounts: AccountView[] };

// TerminalView ganha: accountId: AccountId
```

`SpawnOptions` (`terminals/spawnClaude.ts`) ganha `configDir?: string`. O `claudeSpawner` faz
`env: { ...childEnv(), ...(configDir ? { CLAUDE_CONFIG_DIR: configDir } : {}), TERM, COLORTERM }`. O `configDir` vem
**sempre** de `accountDirs`, nunca do pedido. `TerminalManager.create` passa-o.

### 4.4 Interface

- **Menu do cabeçalho** (`frontend/src/layouts/AppLayout.tsx`, `userMenu`): item novo **por cima de "Definições"**,
  `Conta: <label da ativa>` (ícone de pessoa/troca), que abre o drawer **Escolher conta**.
- **Drawer "Escolher conta"** (`frontend/src/components/accounts/AccountsDrawer.tsx`, Small 540, como o
  `SettingsDrawer`): uma linha por conta, com o nome, o email, um rádio "ativa", o `QuotaMeter` dessa conta (5 h e
  semanal) e as ações (Renomear, Remover — confirmação perigosa —, **Iniciar sessão** quando `!loggedIn`). Ao fundo,
  **Adicionar conta**: nome → `POST /api/accounts` → `POST /api/accounts/:id/login` → abre o `AccountLoginModal`, uma
  janela por cima da página atual com o terminal. O texto diz "Faz o login no browser com esta conta; é só desta vez". O
  **Concluir** só fica ativo com a sessão iniciada e fecha o terminal; o Cancelar pede confirmação (revisto 2026-11-05).
- **Barra lateral dos terminais** (`TerminalsPage.tsx:694`, `QuotaMeter`): só a conta ativa. Com mais de uma conta,
  o nome dela aparece por cima do medidor.
- **Terminais** (`TerminalSidebar.tsx`, `TerminalPane.tsx`): com mais de uma conta, um selo com o nome da conta em
  cada terminal. O "novo terminal" passa a botão dividido, com "Noutra conta ▸". Um terminal parado ou terminado ganha
  **Continuar noutra conta ▸**, que primeiro mostra um modal com o tamanho do contexto
  (`GET /api/terminals/:id/context`): "~N mil tokens vão contar na quota de <conta> na primeira mensagem". A partir
  de 50 mil tokens aparece em destaque, com a sugestão de fazer `/compact` antes.
- **Retomar** (`components/terminals/new/ResumeSessionModal.tsx`): seletor de conta (omissão = ativa) e o mesmo aviso
  de tamanho quando a conta escolhida não é a da conversa.
- **Ficheiros novos**: `services/accountService.ts`, `types/account.ts`, `contexts/AccountsContext.tsx` (o cabeçalho e
  a página dos terminais precisam da ativa; sondagem a 60 s como o `useUsage`), `components/accounts/AccountsDrawer.tsx`,
  `components/terminals/ContextSizeConfirm.tsx`. `useUsage` passa a ler a quota da conta ativa a partir do
  `AccountsContext`, ou continua no `/api/usage` (que já devolve a ativa). Decide-se no passo 8. Desde 2026-11-01 a
  quota já é **uma só sondagem** num `UsageProvider` (`contexts/UsageContext.tsx`, no `AppLayout`), lida pela barra
  lateral e pelo aviso de limite (`components/usage/UsageLimitModal.tsx`). O botão "Mudar para <outra conta>" da
  segunda fase entra nesse modal.
- **Estado vazio**: com uma só conta, nada muda visualmente além do item "Conta: Principal" no menu. Os selos e o
  "Noutra conta" só aparecem com mais de uma conta.
- **Visibilidade por role**: utilizador único (ADR 0003). Não se aplica.

### 4.5 Códigos de erro novos

Em `backend/src/common/errors.ts` e, espelhados 1:1, em `frontend/src/errors/errorMessages.ts`.

| Código | HTTP | Mensagem no frontend |
|---|---|---|
| `ACCOUNT_001` | 404 | Essa conta já não existe. |
| `ACCOUNT_002` | 409 | Já tens 5 contas — remove uma antes de acrescentar outra. |
| `ACCOUNT_003` | 409 | A conta principal não se remove. |
| `ACCOUNT_004` | 409 | Esta conta tem terminais a correr — fecha-os ou para-os primeiro. |
| `ACCOUNT_005` | 500 | Não foi possível preparar (ou limpar) a pasta da conta. Nada foi apagado. |

## 5. Passos

Ordem obrigatória. Tiers: `opus` (desenho, não delegar) · `sonnet` (implementação) · `haiku` (mecânico).

- [x] **1. Spike: confirmar os pressupostos do ADR 0027** (com o dono, que faz o login da 2.ª conta)
  - Ficheiro: `backend/scripts/accounts-spike.ts` (como `import-spike.ts`), numa pasta temporária
  - Skill: — (spike)
  - Tier: `sonnet`
  - Aceite quando, registado na §6 com a versão do `claude`: (a) um `claude` com `CLAUDE_CONFIG_DIR=<pasta nova>`
    pede onboarding/login, e depois do `/login` existem `<pasta>/.credentials.json` e `oauthAccount` em
    `<pasta>/.claude.json`; (b) com `projects/` como junction, o `.jsonl` é escrito através dela e um `--resume` de uma
    conversa da principal funciona na conta nova; (c) as skills, os plugins e os mods ligados aparecem na conta nova, e
    um servidor MCP copiado para a chave `mcpServers` do `.claude.json` dela aparece no `/mcp` (e a chave sobrevive a
    uma sessão completa: o `claude` reescreve o `.claude.json` e não a pode perder);
    (d) o `statusline.cjs` vê `CLAUDE_CONFIG_DIR` no seu `process.env` e recebe `rate_limits` da conta nova;
    (e) `claude "/login"` corre o slash command como primeira mensagem (se não correr, o login é escrito pelo dono);
    (f) `unlink` de uma junction + `fs.rm` da pasta não toca no alvo; (g) com um `claude` a correr em cada conta, há
    dois supervisores (`daemon.status.json` em cada pasta) que não se atropelam, e o Remote Control funciona nas duas.
    Se algum falhar, para-se e revê-se o ADR com o
    dono antes do passo 2. Se tudo passar, o ADR 0027 passa a `aceite` (alterar só o estado).

- [x] **2. Estado: contas no `state.json`**
  - Ficheiro: `backend/src/state/state.schema.ts`, `backend/test/stateStore.test.ts` (ou o teste do schema que existir)
  - Skill: — (não há skill de backend; ler [[../backend-conventions]])
  - Tier: `sonnet`
  - Aceite quando: um `state.json` de hoje carrega com `accounts: []`, `activeAccountId: 'primary'`,
    `primaryAccountLabel: null` e `accountId: 'primary'` em todos os terminais, sem migração. Testes a passar, e
    [[../database]] atualizado.

- [x] **3. Pastas das contas: criar, sincronizar, ler o login, remover com segurança**
  - Ficheiro: `backend/src/accounts/accountDirs.ts` (novo), `backend/test/accountDirs.test.ts`
  - Skill: — (ler [[../backend-conventions]])
  - Tier: `opus` (apagar pastas com junctions: um erro apaga as conversas da principal)
  - Aceite quando: os testes, numa pasta temporária com uma principal falsa, provam que se criam as 6 ligações, que os
    3 ficheiros se copiam (e se apagam quando a principal os perde), que a chave `mcpServers` se copia sem mexer no
    resto do `.claude.json` da extra, que o `loginState` lê o email sem expor tokens, e
    que **remover uma conta deixa intactos `projects/` e `skills/` da principal**. Também provam que uma pasta
    verdadeira no lugar de uma ligação aborta com `ACCOUNT_005` e não apaga nada, e que um id que não é UUID nunca
    entra num caminho.

- [x] **4. Lançar o `claude` na pasta da conta**
  - Ficheiro: `backend/src/terminals/spawnClaude.ts` (`SpawnOptions.configDir`), `terminals/terminalManager.ts:112`,
    `terminals/terminalsService.ts` (`create`, `createImport`, `createGuided`, `reopen`, `spawn` e `assertTrusted` com o
    `.claude.json` da conta), `app.ts:171`, testes `spawnClaude.test.ts` e `terminals.routes.test.ts`
  - Skill: — (ler [[../backend-conventions]])
  - Tier: `sonnet`
  - Aceite quando: um terminal de uma conta extra recebe `CLAUDE_CONFIG_DIR=<DATA_DIR>/accounts/<id>` e os ficheiros
    sincronizados antes do spawn, e um da principal não recebe nada de novo (igual a hoje). O `reopen` com outro
    `accountId` grava-o. A confiança é lida do `.claude.json` da conta certa. As guiadas, as importações e o bot usam a
    ativa. Testes a passar, e [[../security]] (o filho continua só com `CLAUDE_CONFIG_DIR`) e
    [[../environment]] atualizados.

- [x] **5. Quota por conta**
  - Ficheiro: `backend/src/usage/usageFiles.ts`, `usage/usage.routes.ts`, `backend/test/usage*.test.ts`
  - Skill: — (ler [[../backend-conventions]])
  - Tier: `sonnet`
  - Aceite quando: o script, corrido com `CLAUDE_CONFIG_DIR` de uma extra, escreve `usage-<id>.json`; sem ele, ou com
    a principal, escreve `usage.json`; com um caminho fora de `accounts/`, também escreve `usage.json`. O
    `/api/usage` devolve a da ativa. Testes a passar.

- [x] **6. API de contas**
  - Ficheiro: `backend/src/accounts/{accountsService,accounts.routes,accounts.schemas}.ts` (novos),
    `common/errors.ts` (`ACCOUNT_001..005`), `app.ts`, `backend/test/accounts.routes.test.ts`
  - Skill: — (ler [[../backend-conventions]])
  - Tier: `sonnet`
  - Aceite quando: todas as rotas de §4.2 respondem como descrito, com testes `inject` que cobrem: sem sessão → 401,
    limite de 5, remover a principal, remover com um terminal a correr, terminais passados para `primary` ao remover,
    e o `/login` a abrir um terminal na conta certa. Endpoints chamados de verdade com curl numa instância de teste
    (`scripts/verify/instance.mjs`). [[../api]] atualizado.

- [x] **7. Tamanho do contexto + conta nas sessões gravadas**
  - Ficheiro: `backend/src/sessions/claudeSessions.ts` (`contextTokens` a partir do último `usage`),
    `sessions/sessions.routes.ts`, `terminals/terminals.routes.ts` (`GET /:id/context`), testes
  - Skill: — (ler [[../backend-conventions]])
  - Tier: `sonnet`
  - Aceite quando: num `.jsonl` real da principal, o número bate com o `usage` da última resposta. Um ficheiro sem
    respostas dá `null`. A rota responde em menos de 200 ms numa conversa de mais de 5 MB (lê do fim). Testes a
    passar, e [[../api]] atualizado.

- [x] **8. Frontend: menu do cabeçalho, drawer "Escolher conta", quota da ativa**
  - Ficheiro: `frontend/src/layouts/AppLayout.tsx`, `components/accounts/AccountsDrawer.tsx`,
    `contexts/AccountsContext.tsx`, `services/accountService.ts`, `types/account.ts`, `errors/errorMessages.ts`,
    `hooks/useUsage.ts`, `pages/TerminalsPage.tsx:694`
  - Skill: `frontend-design-system`, `frontend-error-handling` (e [[../skills/references/frontend-visual-consistency]])
  - Tier: `sonnet`
  - Aceite quando, no browser (DOM + rede), contra uma instância de teste: o item aparece por cima de Definições e
    abre o drawer. Adicionar uma conta cria-a e abre o terminal de login. Mudar a ativa muda a quota da barra lateral.
    Remover pede confirmação, e com um terminal a correr mostra a mensagem do `ACCOUNT_004`. O `tsc -b` está limpo.

- [x] **9. Frontend: conta por terminal e "Continuar noutra conta"**
  - Ficheiro: `components/terminals/TerminalSidebar.tsx`, `TerminalPane.tsx`, `terminalDisplay.ts`,
    `components/terminals/new/ResumeSessionModal.tsx`, `components/terminals/ContextSizeConfirm.tsx` (novo),
    `services/terminalService.ts`, `types/terminal.ts`
  - Skill: `frontend-design-system`, `frontend-error-handling`
  - Tier: `sonnet`
  - Aceite quando, no browser: com 2 contas, cada terminal mostra o selo. "Noutra conta" cria o terminal na conta
    escolhida (confirmado pelo `accountId` no `GET /api/terminals`). "Continuar noutra conta" mostra o tamanho e
    reabre com `--resume` na outra conta. Com uma só conta, nada disto aparece.
  - Decisão ao implementar (2026-11-05): sem `ContextSizeConfirm.tsx`. A confirmação é o `useConfirm()`, que já traz o
    teclado e o estado de loading, e o texto do tamanho fica em `ContextSizeNotice.tsx`, usado também no
    `ResumeSessionModal`. A lista das contas é o `accounts/AccountPicker.tsx`.

- [ ] **10. Verificação a sério com o dono + documentação final**
  - Ficheiro: [[../architecture]], [[../code-map]], [[terminais]] (§ conta do terminal), `notes/whatIveDone.md`
  - Skill: `run`
  - Tier: `sonnet` (inline, com a extensão do Chrome; nunca num subagente)
  - Aceite quando: na app real, o dono adiciona a 2.ª conta e faz o login uma vez. Um terminal em cada conta mostra a
    conta certa no `/status`. A quota de cada uma aparece separada no drawer. Uma conversa começada na conta A
    continua na B. Depois de reiniciar o backend, ninguém volta a pedir login. Remover a conta de teste deixa
    `~/.claude/projects` intacto (contagem de `.jsonl` antes e depois).

## 6. Estado atual

> ⚠️ **Atualizar SEMPRE no fim de cada sessão.** É a secção que torna esta spec retomável.

**Feito:** spec e ADR 0027 escritos (2026-11-01). **Passo 1 (spike) feito a 2026-11-01** com o `claude` 2.1.316 e
`backend/scripts/accounts-spike.ts`, com o dono a fazer o login da 2.ª conta (Claude Pro). O ADR 0027 passou a
`aceite`. Resultados:
- (a) ✅ `CLAUDE_CONFIG_DIR` novo → login; ficam `.credentials.json` e `oauthAccount.emailAddress` na pasta da conta.
- (b) ✅ Com `projects/` em junction, o `.jsonl` é gravado através dela (pelo PTY da app). `--resume` de uma conversa da
  principal abre-a inteira na conta nova.
- (c) ✅ As skills, os plugins e os mods ligados aparecem. O `wfa-spike` copiado para `mcpServers` aparece ligado no
  `/mcp` e a chave sobrevive a uma sessão completa (o `claude` reescreve o `.claude.json`, com backups em `backups/`).
  ⚠️ Os servidores MCP com **OAuth** (o `notion`) aparecem como "needs authentication": o token é da conta, não da
  configuração. Autentica-se uma vez por conta.
- (d) ✅ A status line vê `CLAUDE_CONFIG_DIR` no `process.env` e recebe os `rate_limits` da conta nova (0%/0% contra os
  da principal).
- (e) ✅ `claude "/login"` arrancou logo o login, sem onboarding antes (dito pelo dono).
- (f) ✅ `unlink` das 6 junctions (`lstat().isSymbolicLink()` dá `true` numa junction) + `fs.rm` da pasta: a cópia da
  principal ficou intacta (skills 440 → 440, plugins 649 → 649, dev-mods 10 → 10).
- (g) ➖ Não exercitado: nem a sessão normal nem o `/remote-control` criaram `daemon.status.json` na conta nova (o
  supervisor só aparece com sessões em background). Cada conta tem o seu `sessions/`. O Remote Control funcionou na
  conta nova.

**Passo 2 feito a 2026-11-01**:
- O que mudou:
  - `accounts`, `activeAccountId` e `primaryAccountLabel` no `state.json`, e `accountId` em `SavedTerminal` e `ClosedTerminal`.
  - Tudo entrou com `.default()`, sem migração.
  - `accountIdSchema` e `MAX_EXTRA_ACCOUNTS = 4` ficam em `state/state.schema.ts`.
- Até ao passo 4, o `terminalsService` cria todos os terminais com `accountId: 'primary'`. Ao fechar, o terminal leva a sua conta para o histórico.
- Testes: backend 470/470.

**Passo 3 feito a 2026-11-01**: `backend/src/accounts/accountDirs.ts` (classe `AccountDirs`, `fromConfig`).
- Interface: `dirOf`, `configDirFor` (`undefined` para a principal), `claudeJsonOf`, `create`, `prepareForLaunch`, `loginState` e `remove`.
- Os códigos `ACCOUNT_001..005` já estão em `common/errors.ts` e espelhados em `errorMessages.ts` (adiantados do passo 6, porque o 3 usa o `ACCOUNT_005`).
- Desvios ao desenho da §4.1:
  - `remove` também procura links **escondidos mais fundo** na pasta. Se encontrar algum, aborta antes de apagar.
  - A procura usa `lstat` por entrada, não o tipo do `Dirent`.
  - Um `.claude.json` da conta ilegível nunca é reescrito (`ACCOUNT_005`), porque guarda o login.
  - `syncMcpServers` só escreve quando a chave muda.
- Testes: `test/accountDirs.test.ts` 11/11. Backend 480/481: a única falha é intermitente e anterior a isto (`guidedHook.test.ts`), e passa 15/15 isolado.
**Passo 4 feito a 2026-11-01**:
- O que mudou:
  - `accounts/accountsService.ts` (ainda mínimo): `resolve`, que lê uma conta guardada que já não existe como `primary`; `activeAccountId`; `require`, que dá `ACCOUNT_001` a uma conta pedida que não existe; e `prepareLaunch`.
  - O `TerminalsService` escolhe a conta de cada `claude`. `create` usa a ativa ou o `accountId` do pedido; as importações e as guiadas usam a ativa; `reopen` usa a do terminal ou o `accountId` do pedido, e grava-a.
  - A confiança lê-se no `.claude.json` da conta.
  - `SpawnOptions.configDir` e `launchEnv()` substituem o `CLAUDE_CONFIG_DIR` herdado, em qualquer capitalização. A principal fica igual a hoje.
  - `POST /api/terminals` e `/reopen` aceitam `accountId`, e o `TerminalView` traz `accountId`.
- Desvio: o `prepareForLaunch` passou a **recriar a pasta** de uma conta que a tenha perdido (antes dava `ACCOUNT_005`).
- Testes:
  - Backend 491/491, em duas corridas seguidas.
  - Numa instância de teste, por HTTP: o `claude` de um terminal da conta extra escreveu `backups/` e `sessions/` na pasta dessa conta. Uma conta inexistente dá 404 `ACCOUNT_001`; um id inválido dá 400.
**Passo 5 feito a 2026-11-01**:
- O `statusline.cjs` escolhe o ficheiro pelo `CLAUDE_CONFIG_DIR` do `claude`. Uma pasta diretamente em `DATA_DIR/accounts/<uuid>` grava `usage-<uuid>.json`; qualquer outra grava `usage.json`.
- `readUsage(dataDir, accountId)` lê o ficheiro dessa conta, e `GET /api/usage` devolve o da conta ativa. Por isso a barra lateral não mudou de chamada.
- Testes: backend 495/495 (duas corridas). Por HTTP numa instância de teste com a conta extra ativa: 7% em vez dos 44% da principal.
**Passo 6 feito a 2026-11-01**:
- O que entrou:
  - `accounts/{accounts.routes,accounts.schemas}.ts` e o `AccountsService` completo: listar, criar, renomear, ativar, remover e abrir o terminal de login.
  - O `claudeArgs` ganhou `kind: 'login'` (`/login` em último lugar, nunca com Remote Control).
  - O `TerminalsService` ganhou `createLogin` e `runningCount`.
  - As contas chegam aos terminais por uma função passada no arranque, para não haver dependência circular.
- Desvios:
  - `POST /:id/login` responde `201`, e não `200`.
  - `PUT /active` devolve a `AccountsView` inteira.
  - A principal também pode abrir um terminal de login (`primary` é um `:id` válido).
- Testes:
  - Backend 505/505, com `test/accounts.routes.test.ts` 8/8.
  - Por HTTP numa instância de teste, 16/16: criar, renomear, ativar e abrir o login, cujo `claude` corre na pasta da conta; remover com um terminal a correr dá 409 `ACCOUNT_004`; depois de fechar o terminal dá 204, a pasta desaparece e a principal fica intacta.
- Corrigido de passagem: um teste do passo 2 tinha um escape inválido que o lint apanhou (`'C:\Windows'`).
**Passo 7 feito a 2026-11-01**:
- O que entrou:
  - `contextTokensOf` e `ClaudeSessions.contextTokens(cwd, id)`, que lê do fim do ficheiro (256 KB, a dobrar até encontrar uma resposta). Ignora os sidechains e as respostas sintéticas a zero.
  - `SessionInfo.contextTokens`.
  - `GET /api/terminals/:id/context` → `{tokens}`.
  - `/api/sessions` com `contextTokens` e `accountId` (a do terminal aberto, senão a do fechado, senão `null`).
- Testes:
  - Num `.jsonl` real de 29.9 MB da principal (só leitura), o resultado é 396216, igual à soma do `usage` da última resposta, e a leitura leva 2-6 ms.
  - Backend 508/508.
  - Por HTTP numa instância de teste, 5/5.
- O frontend espelha os campos novos (`types/session.ts`, `types/terminal.ts`).
- **O backend da spec está completo (passos 1-7).**
**Passo 8 feito a 2026-11-03**:
- O que entrou:
  - `types/account.ts`, `services/accountService.ts`, `contexts/AccountsContext.tsx` (sondagem a 60 s) e `hooks/useAccounts.ts`.
  - `components/accounts/`: `AccountsDrawer`, `AccountQuota`, `AccountNameForm` e `accountFormSchema.ts`.
  - O item "Conta: <nome>" por cima de Definições, e o nome da ativa por cima do `QuotaMeter` com mais de uma conta.
- Decisões:
  - O `useUsage` continua no `/api/usage`. O `UsageProvider` ganhou `refresh()`, que o `AccountsProvider` chama sempre que a ativa muda, seja por que via for.
  - A quota do drawer é compacta (duas barras finas), e não o `QuotaMeter`. Os dois leem a mesma função, `readQuota` (`usage/usageLimits.ts`).
  - Uma leitura que saiu antes de uma mudança é ignorada quando chega depois, nas contas e na quota.
- Desvios:
  - O `TerminalsPage` passou a tratar o `focusTerminalId` num só sítio, também com a página já aberta. O drawer vive no cabeçalho, e em `/terminals` a página não monta de novo; antes, o pedido só era lido ao montar.
  - "Adicionar conta" fica desativado com 5 contas, além do `ACCOUNT_002` do backend.
- Testes: `tsc -b` e lint limpos. `scripts/verify/accounts.mjs` 37/37 em Chrome headless, com o `ACCOUNT_004` real. Sem regressões: `smoke` 6/6, `usage-warning` 27/27, `upwork` 34/34.
- O que não foi testado: o `ACCOUNT_002` pela interface, e um login real (fica para o passo 10).
**Passo 9 feito a 2026-11-05**:
- O que entrou:
  - `accounts/AccountTag.tsx` (o selo, na lateral e no cabeçalho do terminal), `accounts/AccountPicker.tsx` (a lista das outras contas) e `accounts/accountLabel.ts`.
  - `terminals/ContextSizeNotice.tsx`: o custo em tokens, em destaque a partir de 50 mil, com a sugestão do `/compact`.
  - Uma setinha ao lado do "+" na lateral ("Noutra conta"), "Continuar noutra conta" ao lado de Reabrir (terminal parado e terminado), e o seletor de conta no `ResumeSessionModal`.
- Decisões:
  - Dono: uma conta sem login **aparece desativada** nas listas, com "sem sessão iniciada". O login faz-se no drawer.
  - Abrir a lista relê as contas, para quem acabou de fazer o login não esperar pela sondagem de 60 s.
  - Em Retomar, uma conversa que a app nunca correu conta como sendo da principal: foi feita fora da app, e aí o `claude` usa a pasta da principal.
  - O botão dividido da spec ficou só no "+" da lateral. O "+" de um lugar vazio da grelha e o "Novo terminal aqui" continuam na conta ativa.
- **Bug do passo 4 corrigido**: `POST /api/terminals/:id/reopen` aceitava o `accountId` mas não o passava ao serviço, e a conversa reabria na conta antiga. O teste só chamava o serviço diretamente; agora há um teste da rota em `accounts.routes.test.ts`.
- Testes: `tsc -b` e lint limpos. `scripts/verify/accounts-terminals.mjs` 41/41 em Chrome headless, com o processo real lançado com `--resume` e a conta confirmada na API. Sem regressões: `accounts` 37/37, `smoke` 6/6. Backend 509/509.
- O que não foi testado: o `claude` com um login real, porque o cenário escreve um login falso à mão e nada chega ao modelo (fica para o passo 10). O `usage-warning` e o `upwork` não voltaram a correr, porque o passo não lhes toca.
**Revisto a 2026-11-05, a meio do passo 10** (pedido do dono, ao adicionar a conta na app real): o terminal de login abria um separador chamado "projetos", como se fosse um projeto.
- Agora é um terminal escondido, mostrado no `accounts/AccountLoginModal.tsx`, por cima da página e sem navegar. A faixa do `TerminalsPage` saiu.
- O terminal **deixa de ficar aberto** depois do login, ao contrário da decisão de 2026-11-01: fecha-se no Concluir, depois de responder aos diálogos de primeira vez, que continuam a ser respondidos ali.
- Sem histórico ao fechar. Um terminal de login esquecido (o browser fechado a meio) é substituído no login seguinte e termina ao remover a conta. Não conta como terminal a correr, porque o dono não o vê e não o podia fechar para remover a conta.
- Depois de um reinício do backend, um terminal de login esquecido fica parado no `state.json` até ao login seguinte ou até remover a conta. Não aparece em lado nenhum.
- Testes: `accounts.mjs` 53/53 (reescrito para a janela), `accounts-terminals.mjs` 41/41, `smoke` 6/6, backend 512/512.
**Em curso:** passo 10, com o dono.
**Próxima ação concreta:** continuar o passo 10: adicionar a 2.ª conta na janela nova, fazer o login uma vez, e seguir o critério de aceitação do passo.
**Desvios ao plano:** ver "Decisão ao implementar" no passo 9.
**O que uma sessão nova precisa de saber:**
- ❓ **A confirmar no passo 10:** na instância de teste, sem `settings.json` na principal, o terminal de login de uma conta nova abriu no ecrã de escolha de tema ("Let's get started"), antes do login. O spike (e) registou que não havia nada antes do login. A faixa já diz para responder lá aos diálogos, mas pode ser preciso ajustar o texto.
- O aviso de limite ainda não distingue contas: ver a entrada em [[../../notes/ToDo|ToDo]] → Manutenção.
- **Cada conta nova mostra os diálogos de primeira vez** do Claude Code (no spike: "Claude in Chrome extension
  detected"), porque o `.claude.json` dela começa só com `mcpServers`. A confiança das pastas também é por conta. Um
  `claude` sem ninguém no PTY (sessões guiadas, importações, Upwork, Remote Control pelo bot) pode ficar parado num
  destes diálogos (ver §7).
- **`CLAUDE_CODE_CHILD_SESSION`**: um `claude` lançado a partir de outra sessão do Claude Code herda esta marca e **não
  grava transcrições** ("Transcript saving is off"). Foi isto que confundiu o spike. O `childEnv()` da app já não passa
  as variáveis `CLAUDE_CODE_*` ao filho, por isso não afeta a app. Afeta apenas spikes que abram janelas a partir de
  uma sessão.
- **Nunca editar o backend a partir de um terminal servido por ele em `npm run dev`** (CLAUDE.md, regra 8). Os passos
  2-7 correm numa sessão fora da app.
- O spike e a verificação não podem tocar em `~/.claude` além de **ler**. A 2.ª conta do spike vive numa pasta
  temporária, e a principal entra só como alvo das junctions numa **cópia** (ou numa pasta falsa), nunca a real até ao
  passo 10.
- Na pasta principal, o `.claude.json` está em `~/.claude.json` (fora de `~/.claude`) quando `CLAUDE_CONFIG_DIR` não
  está definido. Numa conta extra, está dentro da pasta da conta. O `claudeJsonPath()` já trata isto.

## 7. Perguntas em aberto

| Pergunta | Bloqueia | Notas |
|---|---|---|
| ~~`claude "/login"` corre o login como primeira mensagem?~~ | — | ✅ Spike (e), 2026-11-01: sim. A rota `/login` usa-o |
| ~~As junctions de `plugins/` funcionam com os caminhos absolutos do `known_marketplaces.json`?~~ | — | ✅ Spike (c), 2026-11-01: os plugins aparecem na conta nova |
| ~~Como evitar que um `claude` sem ninguém no PTY fique parado num diálogo de primeira vez de uma conta extra?~~ | — | ✅ Dono, 2026-11-01: os diálogos de primeira vez respondem-se no terminal de login. Não se copiam flags internas do `.claude.json` (mudam entre versões). Revisto a 2026-11-05: respondem-se na janela de login, antes do Concluir, e o terminal não fica aberto depois |
| ~~O `QuotaMeter` do drawer usa o mesmo componente da barra lateral ou uma versão compacta?~~ | — | ✅ Passo 8, 2026-11-03: versão compacta (`AccountQuota`), com a mesma leitura (`readQuota`) |

## Relacionado

[[skill-plan-feature]] · [[skill-implement-todo]] · [[../adr/0027-varias-contas-do-claude|ADR 0027]] ·
[[../adr/0002-motor-via-pty-sobre-subscricao|ADR 0002]] · [[../adr/0004-exposicao-e-modelo-de-ameaca|ADR 0004]] ·
[[../adr/0012-argumentos-do-claude-e-status-line|ADR 0012]] · [[terminais]]
