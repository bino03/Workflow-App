# Feature: Pré-visualização remota de uma app em desenvolvimento

| | |
|---|---|
| **Estado** | 🚧 Em curso |
| **Criada** | 2026-10-23 |
| **Última sessão** | 2026-10-23 |
| **Passos** | 7 / 8 concluídos |

> Escrita para uma sessão que **não viu a conversa que a originou**. Se algo só faz sentido com contexto
> externo, falta escrevê-lo.

---

## 1. O que é e porquê

O dono trabalha num projeto através de um terminal da app (o `claude` no desktop de casa corre o servidor de
dev desse projeto — um Vite, um Next…). Quando está **noutra rede**, no seu PC, não tem como ver a UI desse
projeto sem push/pull. Pedido verbatim (2026-10-23): *"gostava que a minha aplicação fosse capaz de correr isto
em tempo real e me enviasse um link específico para eu poder correr no meu PC. Isto feito remotamente, estando
ligado a outra internet. E esse link deveria ficar apenas disponível para esse utilizador, ou seja, para mim."*

**Como sei que está bem feito:** com o `npm run dev` de um projeto a correr num terminal, o dono manda
`/preview` ao bot (ou carrega no atalho na app), recebe no Telegram e vê no cabeçalho do terminal um
`https://<desktop>.<tailnet>.ts.net:8443`, abre-o no PC dele fora de casa e vê a app com hot reload; de um
dispositivo fora da tailnet o link não abre. Ao fechar o terminal o link deixa de funcionar e o bot avisa.

## 2. Âmbito

### Dentro
- Descobrir as portas TCP em escuta nos **processos descendentes** do terminal (Windows **e** Linux).
- Ligar `tailscale serve` (HTTPS, tailnet) para uma dessas portas, a pedido; desligar à mão, ao sair/fechar/
  reabrir o terminal, ou quando a porta deixa de escutar.
- Entregar o link **no Telegram e na app** (etiqueta no cabeçalho do terminal com o link e ✕ para desligar).
- Ligar **pela app** (ação nova no catálogo de atalhos editáveis) **ou pelo bot** (`/preview`).
- Várias portas no mesmo terminal → o dono escolhe (botões na app e no Telegram).
- Limpeza no arranque e no fecho do backend (só as portas da gama da app).

### ⛔ Fora — não implementar nesta feature
- **Link público** (`tailscale funnel`, Cloudflare Tunnel) — só a tailnet ([[../adr/0018-pre-visualizacao-por-tailscale-serve|ADR 0018]]).
- **Expor a própria Workflow App** fora de `127.0.0.1` e fixar o `rpID` das passkeys — é o ADR em aberto
  "Como expor fora de casa", não este.
- A Workflow App a **fazer de proxy** da app em teste.
- **Corrigir a app em teste** (o `localhost` da API, `server.allowedHosts` do Vite): só se avisa no texto do link.
- **Arrancar o servidor de dev** pela app — quem o arranca é o `claude` no terminal (ou o dono, a pedir-lho).
- **Ligar automaticamente** quando um dev server aparece, ou o Claude pedir a pré-visualização — só a pedido do dono.
- Persistir pré-visualizações no `state.json` — é estado em memória, morre com o backend.
- Instalar/configurar o Tailscale (é do dono; vai para a checklist de `docs/operations.md`).

> Esta lista impede uma sessão futura de expandir o âmbito sozinha.

### Segunda fase (se houver)
- Tempo limite opcional; partilhar com outra pessoa (só com `funnel` + auth e ADR novo).

## 3. Decisões tomadas

| Decisão | Escolha | Porquê | Alternativa rejeitada |
|---|---|---|---|
| Como fica "só para mim" | `tailscale serve` na tailnet do dono | Só os dispositivos dele chegam; HTTPS real; sem portas abertas; o dono só usa PCs seus | Cloudflare Tunnel + Access (qualquer PC, mas domínio + email OTP + link público até ao login) |
| Entrega do link | Telegram **e** cabeçalho do terminal na app | No PC remoto o dono não tem a app (só em `127.0.0.1`); na app serve para quem está em casa | Só um dos dois |
| Quem liga | O dono, a pedido (atalho ou `/preview`) | Nada fica exposto sem intenção | Automático ao detetar um dev server; o Claude pedir |
| Quando desliga | Terminal sai/fecha/reabre, a porta deixa de escutar, ou ✕/botão | Não deixar links vivos para nada | Tempo limite; só à mão |
| Várias portas | O dono escolhe; com uma só, liga logo | Vite + API na mesma árvore é comum; adivinhar erra | A que responde HTML; uma por porta |
| UI na app | Ação nova no catálogo de atalhos + etiqueta "Pré-visualização" com link e ✕ no cabeçalho | O cabeçalho não tem botões por decisão do dono (2026-09-29, `TerminalPane.tsx:78-80`); a etiqueta segue o padrão do **RC** | Botão no cabeçalho; ação só na lateral |
| Sistemas | Windows **e** Linux | O desktop é Windows hoje e passa a Linux ([[../adr/0013-linux-no-desktop-de-casa|ADR 0013]]) | Só um |
| Âmbito do ADR | Só pré-visualizações; a Workflow App fica em `127.0.0.1` | Não arrastar passkeys/`rpID`/pre-deploy para esta feature | Fechar já "Como expor fora de casa" |
| Como chega ao frontend | Campo `preview` no `TerminalView` (GET + polling de 10 s já existente) | É o padrão do `remoteControl` (`terminalsService.ts:24-25`) | Mensagem WS nova |

**ADRs gerados:** [[../adr/0018-pre-visualizacao-por-tailscale-serve|ADR 0018]].

## 4. Desenho técnico

### 4.1 Dados
Nada no `state.json`. Em memória, no `PreviewService`:

```ts
Map<terminalId, { devPort: number; httpsPort: number; url: string; startedAt: string; pid: number }>
```

Configuração nova (`backend/src/config.ts`, `docs/environment.md`):

| Variável | Omissão | Nota |
|---|---|---|
| `TAILSCALE_BIN` | vazia = **feature desligada** | Caminho ou nome do CLI (`tailscale` / `tailscale.exe`) |
| `PREVIEW_HTTPS_PORTS` | `8443-8446` (o spike mostrou que qualquer porta serve) | Gama das portas HTTPS do `serve`; nunca a `PORT` do backend |

Ambas entram na denylist do ambiente do `claude` (`backend/src/terminals/spawnClaude.ts`, `DENIED_*`).

### 4.2 Endpoints
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `POST` | `/api/terminals/:id/preview` | sessão | Body `{ devPort?: number }`. Sem `devPort`: uma porta descoberta → liga (`200 { preview }` — 200 e não 201, porque também é a resposta de "já estava ligada"); várias → `200 { ports }` para escolher; nenhuma → `PREVIEW_001`. Com `devPort`: tem de estar entre as descobertas (`PREVIEW_003`). Já ligada → devolve a existente |
| `DELETE` | `/api/terminals/:id/preview` | sessão | Desliga; `204` (idempotente) |

O `GET /api/terminals` passa a trazer `preview` em cada terminal.

### 4.3 Tipos / DTOs
```ts
type TerminalPreview = { url: string; devPort: number; httpsPort: number; startedAt: string };
type DevPort = { port: number; pid: number; process: string };            // process = nome do executável
type StartPreviewResult = { preview: TerminalPreview } | { ports: DevPort[] };
// TerminalView ganha: preview: TerminalPreview | null   (backend + frontend/src/types/terminal.ts)
```

Módulo novo `backend/src/preview/`:
- `processTree.ts` — `listDescendants(pid)` Windows (o atual de `spawnClaude.ts:151-178`, movido) **e Linux**
  (`/proc/*/stat` → PPID); o `spawnClaude.ts` passa a importá-lo (o kill da árvore no Linux ganha com isso).
- `listeningPorts.ts` — `listeningPorts(pids)` → `DevPort[]`. Windows: `Get-NetTCPConnection -State Listen`
  (PowerShell com comando fixo, como hoje) ou `netstat -ano`; Linux: `/proc/net/tcp` + `/proc/net/tcp6`
  (estado `0A`) cruzado com os inodes de `/proc/<pid>/fd`. Exclui `config.port` e `9229`; só endereços de
  loopback ou *any*.
- `tailscale.ts` — o único sítio que lança o `TAILSCALE_BIN`, só com as formas do ADR 0018; `hostName()` de
  `status --json` (`Self.DNSName` sem o ponto final); erros reescritos para `PREVIEW_005`.
- `previewService.ts` — registo, `start/stop/get`, `attach` ao terminal (`onExit`/`onClose`,
  `terminalManager.ts:6-11`), verificação periódica da porta (a cada 15 s), `cleanupOwnPorts()` no arranque e no
  `onClose` do Fastify (`app.ts:144-147`), `notifier` opcional para o Telegram.
- `preview.routes.ts` — as duas rotas.

### 4.4 Interface
- **Onde vive:** cabeçalho do painel do terminal (`frontend/src/components/terminals/TerminalPane.tsx`, junto da
  etiqueta RC, `:111-117`): etiqueta **"Pré-visualização"** com o link (abre noutro separador) e um ✕ que desliga.
- **Como se chega lá:** ação nova `togglePreview` ("Pré-visualizar o terminal") no catálogo
  (`backend/src/keybindings/catalog.ts` + `frontend/src/keyboard/shortcuts.ts`), tratada em
  `TerminalsPage.tsx` (`useShortcuts`, `:474-520`); default `Alt+…` livre, a escolher no passo 7 sem colidir
  ([[../adr/0016-atalhos-editaveis-no-state|ADR 0016]]).
- **Várias portas:** modal pequeno com uma linha por porta (`5173 · node`), um clique liga.
- **Estado vazio/erros:** `PREVIEW_001` → "Nenhum servidor de dev à escuta neste terminal"; feature desligada
  (sem `TAILSCALE_BIN`) → a ação mostra `PREVIEW_006`.
- **Bot:** `/preview` → lista de terminais a correr (como o `/parar`, `botActions.ts:91-98`) → liga ou mostra
  as portas como botões; a mensagem com o link traz um botão "Desligar". Desligar automático → mensagem
  "Pré-visualização de <projeto> desligada (<motivo>)". O link é enviado ao Telegram **também quando se liga
  pela app**.
- **Texto do link (app e bot):** inclui a nota "Se a página abrir sem dados: a app tem de chamar a API por
  `/api` relativo e aceitar o host `.ts.net` (`server.allowedHosts`)".
- **Visibilidade por role:** um só utilizador ([[../adr/0003-auth-utilizador-unico|ADR 0003]]).

### 4.5 Códigos de erro novos
| Código | HTTP | Mensagem no frontend |
|---|---|---|
| `PREVIEW_001` | 409 | Nenhum servidor de dev à escuta neste terminal. |
| `PREVIEW_002` | 409 | O terminal não está a correr. |
| `PREVIEW_003` | 400 | Essa porta já não está à escuta neste terminal. |
| `PREVIEW_004` | 409 | Todas as portas de pré-visualização estão ocupadas — desliga uma. |
| `PREVIEW_005` | 503 | O Tailscale não respondeu (está instalado, ligado e com permissão?). |
| `PREVIEW_006` | 404 | A pré-visualização está desligada (falta `TAILSCALE_BIN`). |
| `PREVIEW_007` | 503 | O Serve do Tailscale não está ativado na tailnet — ativa-o uma vez na consola. *(acrescentado no passo 4: o spike mostrou o caso; a mensagem do backend traz o link de ativação)* |

Espelho 1:1 em `frontend/src/errors/errorMessages.ts`, mensagens do bot em `backend/src/telegram/botMessages.ts`.

## 5. Passos

Ordem obrigatória. Tiers: `opus` (desenho, não delegar) · `sonnet` (implementação) · `haiku` (mecânico).
**Pré-requisito do dono, antes do passo 1:** instalar o Tailscale no desktop e no PC onde vai abrir os links,
com a mesma conta; ligar MagicDNS e HTTPS Certificates na consola da tailnet.

- [x] **1. Spike: Tailscale CLI + árvore de processos do `claude`** (2026-10-23; (e) parcial → passo 8)
  - Ficheiro: `backend/scripts/preview-spike.ts` (manual, como `remote-control-spike.ts`)
  - Skill: — ([[../backend-conventions]])
  - Tier: `opus`
  - Aceite quando, registado no "Estado" do ADR 0018 e na secção 6:
    (a) `serve --bg --https=<P> http://127.0.0.1:<D>` funciona sem elevação no Windows e que portas `<P>` aceita
    (fixa a omissão de `PREVIEW_HTTPS_PORTS`); (b) forma do `serve status --json` e do `status --json`
    (`Self.DNSName`); (c) `serve --https=<P> off` e a persistência depois de matar o processo que o lançou;
    (d) num terminal real da app, o `claude` corre `npm run dev` (em primeiro plano **e** em background) e o
    `node` do dev server aparece na árvore de descendentes do PID do PTY; (e) o link abre num dispositivo da
    tailnet e **não** abre fora dela.

- [x] **2. Árvore de processos e portas em escuta (Windows + Linux)** (2026-10-23; `processTree.ts` em `common/`)
  - Ficheiro: `backend/src/preview/processTree.ts`, `backend/src/preview/listeningPorts.ts`,
    `backend/src/terminals/spawnClaude.ts` (passa a importar `listDescendants`); testes
    `backend/test/processTree.test.ts`, `backend/test/listeningPorts.test.ts`
  - Skill: — ([[../backend-conventions]])
  - Tier: `sonnet`
  - Aceite quando: parsers testados com saídas reais capturadas no spike (Windows) e com fixtures de `/proc`
    (Linux); `listeningPorts` exclui `config.port` e `9229`; comandos fixos com `execFile`, sem shell; testes do
    `spawnClaude` continuam verdes; contra um `node` real a escutar numa porta, devolve-a com o nome do processo.

- [x] **3. Cliente do Tailscale + configuração** (2026-10-23)
  - Ficheiro: `backend/src/preview/tailscale.ts`, `backend/src/config.ts` (`TAILSCALE_BIN`, `PREVIEW_HTTPS_PORTS`),
    `backend/src/terminals/spawnClaude.ts` (denylist), `backend/.env.example`; teste `backend/test/tailscale.test.ts`
  - Skill: — ([[../backend-conventions]])
  - Tier: `sonnet`
  - Aceite quando: só as quatro formas de argumentos do ADR 0018 são possíveis (teste com `execFile` falso que
    recusa qualquer outra); portas validadas como inteiros 1-65535 antes de entrar no `argv`; erros sem o caminho
    do binário nem output para o cliente; config testada (vazia = desligada, gama inválida = não arranca).

- [x] **4. `PreviewService`: registo, ciclo de vida, limpeza, erros** (2026-10-23)
  - Ficheiro: `backend/src/preview/previewService.ts`, `backend/src/common/errors.ts` (`PREVIEW_001`–`006`),
    `backend/src/terminals/terminalsService.ts` (`preview` no `view()`), `backend/src/app.ts` (montagem,
    `cleanupOwnPorts` no arranque e no `onClose`); teste `backend/test/previewService.test.ts`
  - Skill: — ([[../backend-conventions]])
  - Tier: `opus` (contrato partilhado por app e bot; ciclo de vida e limpeza são onde se deixa um link vivo)
  - Aceite quando: com `processTree`/`listeningPorts`/`tailscale` falsos — uma porta liga; várias devolvem
    `{ports}`; nenhuma `PREVIEW_001`; terminal não `running` `PREVIEW_002`; gama cheia `PREVIEW_004`; segunda
    chamada devolve a existente; `onExit`/`onClose`/`reopen` e a porta a desaparecer desligam (e chamam o
    `notifier` com o motivo); o arranque desliga só as portas da gama; sem `TAILSCALE_BIN` o serviço não existe
    e as rotas dão `PREVIEW_006`.

- [x] **5. Rotas REST** (2026-10-23)
  - Ficheiro: `backend/src/preview/preview.routes.ts`, `backend/src/app.ts`, `docs/api.md`; teste
    `backend/test/preview.routes.test.ts`
  - Skill: — ([[../backend-conventions]])
  - Tier: `sonnet`
  - Aceite quando: `POST`/`DELETE /api/terminals/:id/preview` como em §4.2, com sessão obrigatória (401 sem
    cookie), UUID validado (`TERMINAL_001`), body com zod (`devPort` inteiro); `GET /api/terminals` traz
    `preview`; `docs/api.md` atualizado; `npm test`, `typecheck` e `lint` verdes.

- [x] **6. Bot: `/preview`, escolha de porta, desligar, avisos** (2026-10-23; bot real → passo 8)
  - Ficheiro: `backend/src/telegram/botMessages.ts`, `backend/src/telegram/botActions.ts`,
    `backend/src/telegram/telegramBot.ts`, `backend/src/app.ts` (notifier); testes
    `backend/test/telegramBot.test.ts`
  - Skill: — ([[../backend-conventions]])
  - Tier: `sonnet`
  - Aceite quando: `/preview` na ajuda e no `setMyCommands`; lista de terminais a correr → liga (ou botões de
    porta) → mensagem com o link, a nota da §4.4 e botão "Desligar"; ligar pela app também envia o link;
    desligar automático envia o aviso; tudo revalidado no clique (terminal ainda a correr, porta ainda à
    escuta); só o ID autorizado; nenhum conteúdo do terminal na mensagem.

- [x] **7. Frontend: ação, etiqueta com link, escolha de porta, erros** (2026-10-23; browser 20/20)
  - Ficheiro: `frontend/src/types/terminal.ts`, `frontend/src/services/terminalService.ts`, `frontend/src/hooks/useTerminals.ts` (`startPreview`/`stopPreview`),
    `frontend/src/components/terminals/TerminalPane.tsx`, `frontend/src/components/terminals/PreviewPortsModal.tsx`
    (novo), `frontend/src/pages/TerminalsPage.tsx`, `frontend/src/keyboard/shortcuts.ts`,
    `backend/src/keybindings/catalog.ts`, `frontend/src/errors/errorMessages.ts`
  - Skill: `frontend-design-system`, `frontend-error-handling`
  - Tier: `sonnet`
  - Aceite quando: a ação aparece nas Definições → Atalhos e liga/desliga no terminal focado; a etiqueta mostra
    o link (abre noutro separador) e o ✕ desliga; várias portas → modal; `PREVIEW_*` com mensagem do espelho;
    a etiqueta some quando o backend desliga (polling de 10 s); só tokens; `npx tsc -b` e `npm run lint` limpos.

- [ ] **8. Verificação ponta a ponta + docs + fecho**
  - Ficheiro: `docs/operations.md` (pré-requisitos Tailscale, Windows + Linux/operator; secção "Ver uma app em
    desenvolvimento" passa de 🚧 a ✅), `docs/environment.md`, `docs/security.md` (o que o backend pode lançar),
    `docs/architecture.md`, `docs/code-map.md`, `notes/whatIveDone.md`
  - Skill: `run`
  - Tier: `sonnet`
  - Aceite quando: na app real, com um projeto de teste com Vite num terminal — atalho → link no cabeçalho e no
    Telegram → o dono abre-o **no PC dele fora da rede de casa** e vê a página com HMR; de fora da tailnet não
    abre; Vite + segunda porta → escolha; fechar o terminal → link morto (`curl` falha) e aviso no Telegram;
    reiniciar o backend → `serve status` sem portas da gama. **Medição de velocidade, a partir do PC do dono
    fora de casa** (registada na secção 6): `tailscale ping <desktop>` (direto ou `via DERP`, e a latência);
    primeiro carregamento a frio (cache desligada nas DevTools → "Load" e nº de pedidos) e um F5 com cache, contra
    o mesmo projeto em `localhost` no desktop; tempo de um HMR. Se o primeiro carregamento passar de ~5 s ou a
    ligação for por DERP, abre-se a pergunta da secção 7 "pré-visualizar o build". UI por CDP (`scripts/verify/`, com
    `TAILSCALE_BIN` vazio na instância de teste para os estados de erro; a passagem com o Tailscale real é na
    app do dono). Docs atualizados; spec fechada.

## 6. Estado atual

> ⚠️ **Atualizar SEMPRE no fim de cada sessão.** É a secção que torna esta spec retomável.

**Feito:** spec e [[../adr/0018-pre-visualizacao-por-tailscale-serve|ADR 0018]] (2026-10-23).
**Passo 1 (spike, 2026-10-23)** — `backend/scripts/preview-spike.ts`, Tailscale 1.104.2 no Windows, desktop
`bino.tailb8eca6.ts.net`:
- (a) `serve --bg --https=<P> http://127.0.0.1:<D>` **sem elevação**, em **qualquer porta** (8443, 8444, 9443,
  10443), 50–230 ms; o CLI sai logo e a configuração fica no daemon. → omissão de `PREVIEW_HTTPS_PORTS` = `8443-8446`.
- ⚠️ **Serve não ativado na tailnet** → o CLI **não falha: fica pendurado para sempre** a imprimir
  "Serve is not enabled on your tailnet. To enable, visit: https://login.tailscale.com/f/serve?node=…". O cliente
  (passo 3) tem de ter tempo limite (~10 s), reconhecer esse texto e devolver `PREVIEW_005` com o link de ativação.
- (b) `status --json` → `Self.DNSName` = `"bino.tailb8eca6.ts.net."` (tirar o ponto final). `serve status --json`
  → `{"TCP": {"8443": {"HTTPS": true}}, "Web": {"<host>:8443": {"Handlers": {"/": {"Proxy": "http://127.0.0.1:5199"}}}}}`;
  sem nada → `{}`. Dá para saber que porta local cada `<P>` serve (limpeza no arranque).
- (c) O **primeiro pedido HTTPS de sempre levou 26,6 s** (emissão do certificado); depois 14–70 ms, em qualquer
  porta (o certificado é do host). `serve --https=<P> off` sai 0; numa porta que não está servida sai **1** com
  `error: failed to remove web serve: handler does not exist` → tratar como "já desligada".
- O nome resolve **no DNS público** (8.8.8.8) para `100.82.195.25` (CGNAT, só alcançável dentro da tailnet), e
  fica nos logs públicos de Certificate Transparency: o nome é público, o conteúdo não.
- (d) Um servidor lançado em background por um `claude.exe` 2.1.309 fica na árvore dele:
  `node.exe ← bash.exe ×3 ← claude.exe` (provado com a sessão de Claude Code que fez o spike, não com um terminal
  da app — o PTY lança o `claude` diretamente, `pty.pid`, por isso a cadeia é a mesma; o passo 8 confirma).
  `Get-NetTCPConnection -LocalPort <D> -State Listen` dá o `OwningProcess` sem elevação.
- (e) **Só em parte**: o link abriu (HTTPS válido) **no próprio desktop**; a tailnet ainda não tem outro
  dispositivo. "Abre noutro dispositivo da tailnet / não abre fora" fica para o **passo 8** (registado em
  `notes/verificacao-browser-pendente.md`) — adiado, não dispensado.
**Passo 2 (2026-10-23)** — `backend/src/common/processTree.ts` (`listProcesses`, `descendantsOf`,
`listDescendants`; Windows por `Get-CimInstance`, Linux por `/proc/*/stat`) e `backend/src/preview/listeningPorts.ts`
(`devPortsOf(rootPid, {exclude})` → `DevPort[]`; Windows por `Get-NetTCPConnection`, Linux por `/proc/net/tcp*` +
inodes de `/proc/<pid>/fd`; só loopback/*any*, sem `9229`, uma entrada por porta, ordenadas). O `spawnClaude.ts`
importa o `listDescendants` partilhado e, no Linux, passa a matar com `SIGKILL` os descendentes que sobrevivem ao
fecho (antes a lista vinha sempre vazia). 310 testes verdes (19 novos, incluindo um `node` real à escuta encontrado
pelo `devPortsOf`), lint limpo, typecheck só com o erro antigo de `test/auth.test.ts`. **O Linux só está provado com
fixtures** (`/proc` falso) — a prova real é no desktop Linux (checklist do passo 8).
**Passo 3 (2026-10-23)** — `backend/src/preview/tailscale.ts`: `TailscaleCli(bin, exec?, timeoutMs = 10 000)` com
`hostName()`, `servedPorts()` (`Map<httpsPort, proxyTarget>`), `serve(P, D)`, `off(P)` (idempotente); portas
validadas antes do `argv`; `TailscaleError` com `reason: 'not-enabled' | 'unavailable'`, `enableUrl` (link de
ativação) e `detail` (só para o log). `config.preview = { tailscaleBin, httpsPorts } | undefined`
(`TAILSCALE_BIN` vazia = desligada; `PREVIEW_HTTPS_PORTS` lista/intervalos, máx. 32, recusa a `PORT`).
`TAILSCALE_*`/`PREVIEW_*` na denylist do filho. Documentado em `docs/environment.md` e `backend/.env.example`.
323 testes verdes (13 novos; o `exec` falso recusa qualquer forma fora das quatro do ADR); corrido também contra o
**CLI real** (nome, `serve` 8445, `servedPorts`, `off` duas vezes → vazio). `TAILSCALE_BIN` ainda **não** está no
`backend/.env` do dono — só faz falta quando houver serviço e rotas (passo 4-5).
**Passo 4 (2026-10-23)** — `backend/src/preview/previewService.ts`: `start(id, devPort?)` → `{preview}` | `{ports}`;
`stop(id, reason)` idempotente; `get(id)`; `checkPorts()` (um só `setInterval` de 15 s, só com pré-visualizações vivas,
`unref`); `cleanupOwnPorts()` (só portas da gama e sem pré-visualização viva); `shutdown()`. Um `start` em curso por
terminal (dois cliques → um `serve`), portas HTTPS reservadas antes do primeiro `await` (dois terminais nunca recebem a
mesma), terminal revalidado depois do `serve` (se saiu entretanto, `off` + `PREVIEW_002`). Desligar à mão que o
Tailscale recuse **mantém** a entrada e lança `PREVIEW_005` (dá para tentar outra vez); desligar automático que falhe
larga-a e fica no log (o arranque seguinte limpa). O nome do host é lido uma vez e guardado. `notifier` opcional
(`started`/`stopped` com o motivo; o `shutdown` não notifica) — o bot liga-se no passo 6. Montado em `app.ts` só com
`TAILSCALE_BIN`: `cleanupOwnPorts` no `onReady`, `shutdown` no `onClose`; `AppDeps.preview` deixa os testes trocarem o
Tailscale e a descoberta de portas. `TerminalView.preview` (`terminalsService.ts`). `PREVIEW_001`–`007` no backend e no
espelho do frontend. `docs/database.md` com a linha do estado em memória. 339 testes verdes (16 novos); uma corrida
deu "Worker exited unexpectedly" (a falha intermitente já em `notes/bugs.md`, acrescentada lá) e as duas seguintes
passaram todas. Lint limpo; typecheck só com o erro antigo; `npx tsc -b` do frontend limpo.
**Passo 5 (2026-10-23)** — `backend/src/preview/preview.routes.ts`, registado sempre em `app.ts` (sem
`TAILSCALE_BIN` → `404 PREVIEW_006`): `POST` → `200 {preview}` | `200 {ports}` (body `.strict()`, só `devPort`), `DELETE`
→ `204` idempotente; `TERMINAL_001` para id inválido ou fora do `state.json`. `docs/api.md` atualizado. 10 testes de
rotas (sessão, validação, escolha, GET com `preview`, fecho do terminal e da app desligam, limpeza no arranque só da
gama). Suite 349/349 em duas corridas; uma terceira deu 3 timeouts de hooks com PTYs reais — a falha intermitente, agora
com os nomes dos testes em `notes/bugs.md`. **Chamado de verdade** (instância de `scripts/verify/` com o Tailscale real e
um `claude` real num PTY): o arranque desligou uma porta 8446 deixada à mão e só essa; `POST` num `claude` sem servidor
de dev → `409 PREVIEW_001` em 637 ms (árvore e portas lidas do Windows); 400, 404, 401 e `DELETE` 204 certos; no fim nada
nosso servido.
**Passo 6 (2026-10-23)** — `/preview` (em `COMMANDS`, `HELP` e no `switch` de `telegramBot.ts`) → terminais a correr
(🔗 nos que já têm link) → liga, ou um botão por porta (`5173 · node.exe`) → mensagem com o link, a porta, a nota do
`/api`/`allowedHosts` e "⏹ Desligar o link". `BotAction` ganhou `preview` e `preview-off`; `PREVIEW_001`–`006` com frase
em `botMessages.ts`, e o `PREVIEW_007` responde com o link de ativação tirado da mensagem. O `PreviewService.start`/`stop`
ganharam `{quiet}`: o que o bot pede não volta a ser anunciado pelo notifier (a resposta já é o link). O notifier é montado
em `app.ts` (`previewNotifier`, preenchido quando o bot existe) e envia ao `allowedUserId` — o link ligado pela app e o
"desligado — o terminal terminou / o servidor de dev parou". `AppDeps.telegramApi` para testes. 6 testes novos
(`telegramPreview.test.ts`, bot verdadeiro + `PreviewService` verdadeiro com fakes) e 1 de ponta a ponta em
`preview.routes.test.ts` (ligar por REST → `sendMessage` ao dono com o link e o botão; desligar → aviso). Suite
355/355 em duas corridas; uma terceira deu 11 timeouts de PTYs reais sob carga — a falha intermitente está a piorar
(`notes/bugs.md`, e passou ao ToDo). **Bot real não testado** (o `backend/.env` do dono ainda não tem `TAILSCALE_BIN`):
fica para o passo 8.
**Passo 7 (2026-10-23)** — ação `togglePreview` no catálogo (**`Alt+L`** por omissão — `Alt+P`, `Alt+T` e `Alt+V` são
do Claude Code), tratada em `TerminalsPage.tsx` sobre o terminal com o teclado: desliga a viva, ou liga (uma porta) /
abre o `PreviewPortsModal` (várias; um clique liga). `PreviewTag` no cabeçalho do `TerminalPane` ao lado do RC: `.tag`
com 🔗 + host em mono (link, novo separador, `rel=noreferrer`) e ✕ que desliga; num mosaico compacto só o 🔗. Tipos,
`startPreview`/`stopPreview` no serviço e no `useTerminals`. `PREVIEW_007` → notificação "Tailscale Serve por ativar" com o
botão "Ativar o Serve" (abre o link de ativação). `scripts/verify/cdp.mjs` ganhou `on(evento, fn)`.
**Verificado no browser, 20/20** (instância de teste com o Tailscale real e um `claude` real; Chrome headless por CDP;
cenário no scratchpad): `Alt+L` num `claude` sem servidor de dev → `PREVIEW_001` **real**; com as respostas de
`…/preview` e do `GET /api/terminals` intercetadas (`Fetch.requestPaused`) — várias portas → modal com as duas → 5173
manda `{"devPort":5173}` → modal fecha → etiqueta com o host e o link certo, **sobrevive à releitura de 10 s** → ✕ manda
`DELETE` e a etiqueta sai → `PREVIEW_007` mostra a mensagem pt e o botão, nunca o texto inglês do backend; consola sem
erros; nada servido no fim. Capturas vistas (etiqueta e notificação dentro dos tokens). `npx tsc -b`/lint limpos; backend
355/355. **Uma pré-visualização com um servidor de dev verdadeiro no browser** fica para o passo 8.
**Em curso:** nada.
**Próxima ação concreta:** passo 8 — com o dono. (1) `TAILSCALE_BIN=C:\Program Files\Tailscale\tailscale.exe` no
`backend/.env` e reiniciar o backend (num momento sem terminais a meio). (2) Tailscale no PC do dono, mesma conta. (3)
Num terminal da app, um projeto com Vite: pedir ao Claude `npm run dev` → `Alt+L` → link no cabeçalho e no Telegram →
abrir no PC fora de casa; medições da §5 passo 8; `/preview` no bot real; fechar o terminal → aviso. (4) Docs da lista
do passo 8.
**Desvios ao plano:**
- Spike (e) parcial — ver acima.
- `processTree.ts` ficou em `backend/src/common/`, não em `preview/`: o `spawnClaude.ts` (terminais) também o usa, e os
  terminais não devem depender do módulo de pré-visualização ([[../adr/0006-organizacao-por-dominio|ADR 0006]]).
- Uma melhoria fora do âmbito estrito, mas prevista na §4.3: o kill dos sobreviventes no Linux.
- Um sétimo código, `PREVIEW_007` (Serve por ativar na tailnet), separado do `PREVIEW_005`: é uma ação diferente do
  dono (abrir o link de ativação uma vez), e a mensagem do backend leva o link — o frontend (passo 7) e o bot (passo 6)
  devem mostrá-lo.
- O frontend tira esse link da `message` do backend — exceção à regra "nunca mostrar `data.message`"
  (`skill-frontend-error-handling`): só um URL `https://login.tailscale.com/…` por regex, nunca o texto; a mensagem
  mostrada continua a ser a do espelho pt.
- O `PreviewPortsModal` liga com um clique numa linha, sem "selecionar e confirmar" como o `ResumeSessionModal`: a
  escolha é uma só e desfaz-se com o ✕.
**O que uma sessão nova precisa de saber:**
- Investigação de 2026-10-23: o PID do PTY é o do próprio `claude` (`terminalManager.ts:79`, sem shell pelo meio);
  `listDescendants` já existe só para Windows (`spawnClaude.ts:151-178`) e devolve `[]` no Linux, onde o kill
  da árvore também não percorre descendentes; não há evento para "o dev server morreu" (por isso o polling).
- O bot nunca enviou nada por iniciativa própria; a `TelegramApi` e o `allowedUserId` estão presos na montagem
  em `app.ts:118-135` — o notifier sai daí.
- O `tailscale serve --bg` **persiste no daemon** depois de o backend morrer: a limpeza no arranque não é
  opcional. Nunca `serve reset` (apagaria `serve`s do dono).
- `scripts/verify/` só funciona em Windows.

## 7. Perguntas em aberto

| Pergunta | Bloqueia | Notas |
|---|---|---|
| ~~Que portas HTTPS o `tailscale serve` aceita?~~ | — | ✅ Qualquer uma (spike, 2026-10-23) → `8443-8446` |
| ~~O dev server lançado pelo `claude` em background continua descendente?~~ | — | ✅ Sim (spike (d)) |
| ~~No Windows o `serve` pede elevação?~~ | — | ✅ Não (spike (a)) |
| Atalho por omissão para `togglePreview` | Não — passo 7 | Um `Alt+…` livre no catálogo |
| Acrescentar "pré-visualizar o build" (`vite build && vite preview`, poucos ficheiros, sem HMR)? | Não — só se a medição do passo 8 for má | Em dev o Vite serve cada módulo à parte (centenas de pedidos): cada um paga a ida e volta a casa. Estimativa sem medição (2026-10-23): +1–3 s no primeiro carregamento, F5 seguintes e HMR quase iguais a local. Seria 2.ª fase, com quem arranca o `vite preview` por decidir (hoje a app não arranca servidores) |

## Relacionado

[[skill-plan-feature]] · [[skill-implement-todo]] · [[../adr/README]] ·
[[../adr/0018-pre-visualizacao-por-tailscale-serve]] · [[../adr/0004-exposicao-e-modelo-de-ameaca]] ·
[[../adr/0017-bot-telegram-e-remote-control]] · [[../operations]] · [[bot-telegram]]
