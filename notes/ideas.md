# 💡 Ideias

Ideias ainda em bruto. Só passam para o [[ToDo]] quando forem uma tarefa acionável — `/refine-idea`
ajuda a fechá-las e move-as.

Itens deixados pelo `/refine-idea` ou devolvidos pelo `/implement-todo` trazem o contexto já investigado:

```markdown
- <texto original>
  > Contexto (via implement-todo | refine-idea, AAAA-MM-DD): <o que foi investigado e o que falta para desbloquear>
```

---

- Ler os docs completos da biblioteca (princípios, padrões, skills) na app, não só o registo.
- Notificação quando uma sessão fica à espera de input.
  > Contexto (via refine-idea, 2026-11-12): o estado das sessões passou ao ToDo (Terminais) sem notificações; esta ideia reutiliza esse estado ("Precisa de ti" / "À tua espera"). Hipóteses já levantadas: Notification API do browser e/ou o bot de Telegram (ADR 0017/0018). · falta decidir: canal, quando notificar (só "Precisa de ti"?), e se a app tem de estar aberta.
- 2FA (TOTP) no login, antes de expor na web.
- **Botão "Resumir" num terminal vivo** — pedir ao próprio Claude um resumo curto do que foi feito, só quando o utilizador carrega, nunca automático.
  > Contexto (via implement-todo, 2026-09-28): no `/design-database` o dono quis o resumo do histórico feito pelo Claude; a proposta de escrever um prompt no PTY ao fechar foi recusada (suja a conversa gravada, interfere com tarefas/permissões a meio, fecho lento e frágil). No MVP o resumo vem do `.jsonl` (`ai-title` / última mensagem). `claude -p` e a API estão fora (ADR 0002), por isso "Resumir" tem de escrever no PTY com o terminal parado à espera de input, e extrair a resposta do `.jsonl` (não do ecrã). Acrescenta `summarySource: "claude"` ([[../docs/database]]).
- **App desktop** (Tauri ou Electron) por cima do mesmo backend — "no futuro quero fazer uma app".
  > Contexto (conversa, 2026-09-28): a janela desktop deve **abrir o URL do backend** (local ou remoto) em
  > vez de trazer o frontend empacotado — assim a origem é a mesma e o cookie HttpOnly, a verificação do
  > `Origin` e o WebSocket funcionam sem mudanças. Empacotar o frontend muda o `Origin`
  > (`http://tauri.localhost`, `tauri://localhost`, `file://`/`null`) e torna o cookie cross-site
  > (`SameSite=None; Secure` → HTTPS). **Não** pôr o `node-pty` no processo do Electron em vez do backend:
  > perde-se o acesso "onde quiser", ficam dois caminhos de código e o `node-pty` passa a precisar de
  > `electron-rebuild`. Detalhes a tratar: no Electron em Windows o `Alt` abre a barra de menu (os atalhos
  > da app são `Alt+…`, ADR 0008) — esconder o menu; empacotar as fontes Geist; no WebKit (Tauri fora do
  > Windows) testar o renderer do xterm.js. Pré-requisitos já no ToDo: backend serve a SPA, URL da API
  > configurável. Quando avançar: ADR novo ("Forma final da UI", [[../docs/adr/README]]).
- **Ecrã de capturas da verificação no browser** — ver na app as capturas e GIFs que o Claude grava ao
  testar uma app no desktop de casa, sem precisar de remote desktop.
  > Contexto (conversa, 2026-09-28): decorre de [[../docs/operations]] → "Testar outras apps no browser a
  > partir da app" — o browser e os testes correm no desktop, o dispositivo do dono é só o ecrã. Por
  > resolver: **de onde vêm os ficheiros** — os GIFs da extensão Claude in Chrome vão para a pasta de
  > downloads do Chrome do desktop; os artefactos do Playwright para `test-results/`/`playwright-report/`
  > de cada projeto. Hipótese: uma pasta de verificação configurável (tipo `VERIFICATION_DIR`, dentro de
  > `ALLOWED_ROOTS`) que o backend lista **só leitura**, por projeto/terminal e por data, com pré-visualização
  > de imagem/GIF e link para o relatório HTML do Playwright. Cuidado: servir ficheiros do disco é
  > superfície nova — validar o caminho com o `cwdPolicy`, como as pastas dos terminais (ADR 0004).
  > Ligação natural: mostrar a última captura no próprio painel do terminal que a gerou.
- **Antes de sair de `127.0.0.1`** — decidir como expor (Tailscale / túnel com auth / proxy+TLS) e fechar [[roadmap/pre-deploy-security]] ([[../docs/adr/0004-exposicao-e-modelo-de-ameaca|ADR 0004]]) — **e fixar `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGINS` no domínio escolhido** (as passkeys, [[../docs/adr/0015-passkeys-webauthn|ADR 0015]], só funcionam no iPhone depois disto; mudar o `rpID` mais tarde obriga a registá-las outra vez)
  > Contexto (via implement-todo, 2026-09-28): o dono adiou — ainda não é preciso aceder de fora. Já feitas as proteções 1-6 do ADR 0004 (bind `127.0.0.1`, login com rate limit 5/min, `Origin` no WS, binário e argumentos fixos, ambiente do filho limpo, cookie `httpOnly`/`sameSite: strict`/`secure` configurável). Falta: ADR novo com a forma (Tailscale `tailscale serve` com HTTPS em `<host>.ts.net` / Cloudflare Tunnel + Access / Caddy + TLS + auth); CSP e cabeçalhos de segurança (adiados pelo ADR 0010); `trustProxy` e rever o rate limit atrás do túnel (IP sempre igual); `COOKIE_SECURE=true`; 2FA (ideia acima). O `pre-deploy-security.md` é genérico — recuperação de password, bloquear conta, N+1, índices e backups da BD não se aplicam (marcar N/A). Convém vir depois de Terminais: o gateway WebSocket é a superfície principal a expor.
- A Conta Secundária mostra no `/status` 7 servidores MCP "need auth" e 2 "failed" (a Principal: 1 a pedir autenticação), contra os mesmos MCP na configuração. Os OAuth autenticam-se uma vez por conta (spec contas, spike (c)), mas os 2 "failed" não foram investigados: ver `/mcp` num terminal dessa conta e decidir se é config copiada, token em falta ou outra coisa.
  > Contexto (via implement-todo, 2026-11-07): o dono adiou. Lido no código: o `syncMcpServers` (`backend/src/accounts/accountDirs.ts:181-191`, chamado em `prepareForLaunch`) copia o objeto `mcpServers` da principal **inteiro e verbatim** para o `.claude.json` da conta — sem filtro, sem reescrever caminhos nem `env`. Só vão os servidores de scope user; os de projeto (`.mcp.json`) resolvem-se pela pasta do projeto e os de plugins vêm das pastas partilhadas. Os OAuth ("need auth") são esperados: o token é por conta. A causa dos 2 "failed" **não se tira do código**; só se vê com `/mcp` num terminal real da Conta Secundária. Hipóteses: (1) servidor http/OAuth que falha em vez de pedir autenticação; (2) stdio que lê ficheiros de config sob a pasta da principal ou depende de uma variável que a conta não herda; (3) falha igual na principal (o ToDo só diz "1 a pedir autenticação" lá — falta saber se há "failed"); (4) `npx`/`uvx` ou PATH. Falta: ver o `/mcp` na Secundária (e na principal, para comparar). Pode acabar sem alteração de código: só autenticar, ou documentar.

---

## Tornar a app num IDE para desenvolver aplicações (análise de 2026-11-10)

Pedido do dono (via `/plan-feature`, 2026-11-10): "tornar esta app no IDE super completo e adaptado ao desenvolvimento de
aplicações". "IDE completo" não cabe numa spec: são vários pilares, cada um com a sua. Ficou tudo aqui para o dono
**escolher o que fazer e por que ordem**; cada item passa a spec com `/plan-feature` (ou a ToDo com `/refine-idea`, os
pequenos). Hoje a app gere sessões do Claude, biblioteca, projetos, pré-visualização e Upwork — **nada mostra o código**.

**Já respondido pelo dono nesta conversa** (não voltar a perguntar):
- **Ordem**: fundação técnica primeiro, pilares depois.
- **Ficheiros**: só leitura + diff na primeira versão; sem escrita no disco a partir do browser.
- **Correr comandos**: tarefas lançadas **por nome** (scripts do `package.json`), nunca um shell livre.
- **Por escolher**: que pilares entram, e por que ordem.

### Fundação (antes dos pilares)

- **PTYs num processo à parte ("pty host")** — o backend fala com um processo filho que é o único dono dos PTYs.
  > Contexto (via plan-feature, 2026-11-10): hoje os PTYs vivem no processo do backend (`backend/src/terminals/terminalManager.ts`).
  > Duas consequências: (1) o segfault do node-pty 1.1.0 em Node 24/Windows ([[ToDo]] → Manutenção) mata o backend e **todos**
  > os terminais de uma vez; (2) a regra 8 do `CLAUDE.md` — o reinício do `tsx watch` mata as sessões. Com um processo à parte,
  > um crash nativo perde no máximo esse processo (ou só um terminal, se for um host por terminal), e o backend reinicia sem
  > matar nada. Falta decidir: um host para todos ou um por terminal; o protocolo (IPC do Node vs. socket local); como o
  > backend reencontra os PTYs vivos ao voltar; e o que acontece ao `closeGracefully`/`processTree`. É estrutural → **ADR
  > novo**. Liga-se à decisão pendente do node-pty (beta 1.2 / esperar / aceitar).
- **Um canal de eventos servidor → browser, em vez de sondagens.**
  > Contexto (via plan-feature, 2026-11-10): tudo o que muda no servidor chega ao browser por temporizador — `hooks/useTerminals.ts`,
  > `contexts/UsageContext.tsx`, `contexts/AccountsContext.tsx`, `hooks/useGuidedSession.ts` (1,5 s),
  > `components/upwork/ApplicationDetail.tsx` (3 s), `hooks/useCurrentImport.ts`, `hooks/useBackendHealth.ts`. Git, ficheiros e
  > estado das sessões por este caminho não escalam. Hipótese: um WebSocket (ou SSE) único `/api/events`, com a mesma guarda
  > do gateway dos terminais (cookie + `Origin`), e eventos tipados (`terminal.changed`, `usage.changed`, `guided.changed`, …).
  > Falta decidir: WS vs. SSE; migrar as sondagens todas ou só as novas; o que acontece ao religar (reler tudo). Toca o
  > protocolo → `docs/api.md`.
- **Partir a `TerminalsPage.tsx` e separar o layout da área de trabalho.**
  > Contexto (via plan-feature, 2026-11-10): `frontend/src/pages/TerminalsPage.tsx` tem 872 linhas e 41 hooks: separadores de
  > projeto, foco dividido/grelha, lugares, pré-visualização, contas, renomear, zoom e atalhos no mesmo componente. Qualquer
  > painel de IDE (ficheiros, git, tarefas) cairia aqui. Hipótese: um hook por assunto (`useProjectTabs`, `useProjectLayout`,
  > `usePreviewActions`, …) e um componente de área de trabalho com zonas (lateral · centro · painel direito/inferior) onde os
  > painéis novos encaixam. Sem mudança de comportamento; os cenários de `scripts/verify/` servem de rede.
- **Repor o ecrã do terminal limpo ao religar (e sobreviver ao reinício).**
  > Contexto (via plan-feature, 2026-11-10): o scrollback guarda bytes crus (`Scrollback` em `terminalManager.ts`) e o
  > `TerminalView.tsx` força um resize ±1 linha depois do `ready` para a TUI se redesenhar por cima. Com `@xterm/headless`
  > (já é devDependency) + o addon serialize, o servidor mantinha o estado do ecrã e enviava-o já composto. Combina com o
  > pty host: o estado ficava do lado que não reinicia. O ADR 0009 diz "scrollback só em memória" — guardar em disco seria
  > decisão nova.
- **Addons do xterm.js**: links clicáveis (`web-links`), pesquisa no terminal (`search`), renderer WebGL, `unicode11`.
  > Contexto (via plan-feature, 2026-11-10): hoje só o `fit` (`components/terminals/TerminalView.tsx`). Pequeno — serve um item
  > no ToDo por addon. A pesquisa precisa de um atalho no catálogo (`backend/src/keybindings/catalog.ts`).
- **Testes do frontend e CI.**
  > Contexto (via plan-feature, 2026-11-10): o frontend não tem testes unitários (decisão "Testes do frontend" em aberto em
  > [[../docs/adr/README]]) e não há CI (`.github/` não existe); a verificação são os cenários CDP de `scripts/verify/`. Antes
  > de crescer para IDE: Vitest para a lógica pura que já existe (`gridStyle.ts`, `projects.ts`, `usageLimits.ts`,
  > `keyboard/shortcuts.ts`, os `*FormSchema.ts`) e um workflow que corra typecheck + lint + testes. ADR novo para a decisão.
- **Arrumações pequenas**: confirmar se o erro de typecheck em `backend/test/auth.test.ts:40` ([[bugs]]) ainda existe e
  corrigi-lo; o `00-INDEX.md` ainda diz "Modelo de dados por desenhar" e o `docs/architecture.md` abre com 🚧 "até haver
  código" — ambos já ultrapassados; o [[refactoring]] está vazio (nenhuma skill lhe escreve).

### Pilares

- **Rever alterações (git)** — painel por projeto: ficheiros alterados, diff, commit, histórico, ramo atual.
  > Contexto (via plan-feature, 2026-11-10): é o que mais falta quando é o Claude a escrever o código — hoje não se vê o que
  > ele mudou sem sair da app. Já existe `GIT_BIN` e um invólucro com argumentos fixos (`backend/src/imports/workflowGit.ts`),
  > mas só para o repositório do Workflow, e o `ImportReviewDrawer.tsx` já mostra um diff. Falta decidir: só ler
  > (status/diff/log) ou também escrever (stage, commit, descartar, trocar de ramo); push fica de fora? (a skill `git-commits`
  > diz "nunca push sem perguntar"); biblioteca de diff no frontend; como se atualiza (canal de eventos + vigiar `.git`).
  > Superfície nova: `git` a correr em qualquer pasta de `ALLOWED_ROOTS` → **ADR novo** (complementa o 0004/0019).
- **Ficheiros** — árvore do projeto e um visualizador ao lado do terminal. **Decidido: só leitura + diff na v1.**
  > Contexto (via plan-feature, 2026-11-10): o backend só lista pastas (`folders/foldersService.ts`, browse) — nunca lê
  > ficheiros de projetos. Superfície nova: servir conteúdo do disco, validado pelo `cwdPolicy` (`realpath` dentro de
  > `ALLOWED_ROOTS`), como já se faz para os prints do portfólio (ADR 0024). Falta decidir: o que nunca se serve (`.env`,
  > chaves, `node_modules`, binários, limite de tamanho) — o dono rejeitou a escrita, mas ler um `.env` no browser também é
  > sensível; respeitar o `.gitignore` na árvore; realce de sintaxe (CodeMirror em só-leitura vs. Shiki — o Monaco é pesado
  > para só ler); abrir um ficheiro a partir de um caminho no terminal (addon de links). **ADR novo**. O editor com gravação
  > é a segunda fase óbvia — desenhar a v1 para não a fechar.
- **Estado das sessões e notificações** — o estado passou ao [[ToDo]] (Terminais, via refine-idea 2026-11-12); as
  notificações ficam na ideia do topo deste ficheiro.
- **Tarefas** — lançar dev server, testes e builds sem pedir ao Claude. **Decidido: por nome, nunca um shell livre.**
  > Contexto (via plan-feature, 2026-11-10): o ADR 0004 ponto 4 diz "só `CLAUDE_BIN`, com argumentos fixos; nunca um shell".
  > A forma escolhida: o backend lê os `scripts` do `package.json` do projeto e lança `npm run <nome>` num PTY próprio — o
  > browser envia só o nome, validado contra a lista lida do disco. Abre o ponto 4 só o necessário (como o `TAILSCALE_BIN` do
  > ADR 0018 e o `GIT_BIN` do 0019) → **ADR novo**. Falta decidir: projetos sem `package.json` (Maven, Python…); monorepos
  > (`backend/` + `frontend/`, como esta app); se contam para o `MAX_TERMINALS`; onde aparece o output (painel inferior);
  > ligar à pré-visualização (o `listeningPorts.ts` procura portas abaixo do `claude` — uma tarefa não está abaixo dele).
  > Nota: o conteúdo de um script é do projeto, por isso "por nome" limita **quem** escolhe o comando, não **o que** ele faz.
- **Pesquisa e paleta de comandos** — pesquisar texto no projeto, abrir ficheiro por nome, `Ctrl+K` com todas as ações.
  > Contexto (via plan-feature, 2026-11-10): a paleta de comandos é barata e independente — o catálogo de ações já existe
  > (`backend/src/keybindings/catalog.ts`, `frontend/src/keyboard/shortcuts.ts`); o `Ctrl+K` colide com a restrição `Alt+…`
  > do ADR 0016. A pesquisa no projeto depende do pilar Ficheiros e pede um binário novo (`rg`) ou `git grep` pelo `GIT_BIN`.
- **O vault de cada projeto na app** — ToDo, specs com o "Estado atual", work log e ADRs do projeto aberto, sem o Obsidian.
  > Contexto (via plan-feature, 2026-11-10): é o que torna o IDE "adaptado" ao Workflow — os projetos gerados têm todos a
  > mesma estrutura (`docs/features/`, `notes/ToDo.md`, `notes/whatIveDone.md`). A página Projetos já tem a ficha de deploy
  > (ADR 0028) e o `components/common/Markdown.tsx` já renderiza Markdown sem HTML. Depende de ler ficheiros (pilar
  > Ficheiros). Extra natural: um botão "Implementar" que abre um terminal com `/implement-todo` nesse projeto. Próxima da
  > ideia do topo "Ler os docs completos da biblioteca".
- **Pré-visualização dentro da app** — o dev server do projeto num painel ao lado do terminal, em vez de noutro separador.
  > Contexto (via plan-feature, 2026-11-10): a descoberta de portas já existe (`backend/src/preview/listeningPorts.ts`). Em
  > `localhost` basta um `<iframe>` para `http://localhost:<porta>`; por `tailscale serve` é o link do ADR 0018. Cuidado:
  > muitas apps recusam ser embebidas (`X-Frame-Options`/CSP) e a app não deve fazer de proxy (superfície nova). Liga-se à
  > ideia do topo "Ecrã de capturas da verificação no browser".

### Ordem sugerida (para decidir)

1. Fundação: partir a `TerminalsPage` → canal de eventos → pty host (o mais arriscado; pede spike e ADR).
2. Estado das sessões (barato depois do canal de eventos, e de uso diário).
3. Rever alterações (git) — o maior salto para "IDE".
4. Ficheiros (só leitura) → pesquisa e vault do projeto, que dependem dele.
5. Tarefas → pré-visualização dentro da app.
