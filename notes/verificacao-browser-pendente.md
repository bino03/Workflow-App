# Verificação no browser — pendente

Registado quando a sessão não consegue abrir o browser (ver [[../docs/skills/references/testing-and-verification|testing-and-verification]]).
Adiada, não dispensada: fazer numa passagem em lote e riscar aqui. Um 🔴 encontrado vai para o ToDo.

## 2026-09-28 — plano `fundacao-frontend-e-spa` (extensão do Chrome sem responder: "No group with id")

Feito na mesma sessão em **Chrome headless via CDP** (estilos computados, DOM, rede, screenshots),
sem a extensão:

- [x] **Tokens** (`/_tokens`) — cores exatas nos componentes do antd (depois de corrigir o `darkAlgorithm`), Tooltip legível, Geist e Geist Mono carregadas, tags/ícones de estado, pele da tabela, toast com o tema. `prefers-reduced-motion` **não** testado.
- [x] **Erros e toasts** — password errada inline sem toast; backend inacessível → um só toast; login offline → inline sem segundo toast.
- [x] **App shell** com `/auth/me` simulado no browser — header 48, barra 26, nav, `/login` com sessão, confirmação não destrutiva, logout.

Por fazer (só o dono — precisa da password real):

- [x] **Login a sério**: entrar com a password real em `http://localhost:7401/login` → cai em `/terminals`; F5 não pisca o `/login`; "Terminar sessão" → `/login` e o `/terminals` volta a pedir login — ✅ 2026-10-21, no Chrome do dono (login feito por ele; extensão do Chrome): F5 sem `/login` em 1411 amostras a cada 2 ms; sair → `/login`, `/api/auth/me` e `/api/terminals` com 401, `/terminals` volta a pedir login
- [x] `prefers-reduced-motion` ligado no SO → o arco "a trabalhar" em `/_tokens` fica parado — ✅ 2026-10-21, emulado em Chrome headless (`Emulation.setEmulatedMedia`, a mesma media query que o SO liga) contra o dev server: sem a preferência `wfa-spin` 1.4 s a rodar; com ela `animation: none`, parado

## 2026-09-28 — spec `separadores-de-projetos`, passo 8 (extensão do Chrome sem responder: "No group with
id", mesmo com o Chrome aberto — tentado 5×, incluindo depois de arrancar o Chrome de novo)

**✅ Feito a 2026-10-21 em Chrome headless via CDP** (instância de teste na 7498, login a sério com credenciais
descartáveis, registo de teste Alfa/Beta/Gama, `CLAUDE_CONFIG_DIR` próprio): 57/57 nos dois blocos (separadores +
estilos de grelha). Cenário em `%TEMP%\claude\…\063b02f3-…\scratchpad\verify-tabs-grid.cjs`.

Automático feito nesta sessão (sem o browser): 172 testes do backend a passar, `tsc -b` + lint do
frontend limpos, `npm run typecheck`/lint do backend limpos (o erro em `test/auth.test.ts` é pré-existente,
sem relação com a spec). App a correr (`/run`), health checks OK. Docs desta spec atualizados
(`docs/product/use-cases.md`, `docs/features/terminais.md`, `docs/skills/references/design/browser-tabs.md`
— padrão novo registado).

Por fazer (só o dono — precisa de login real, a extensão do Chrome não respondeu e a verificação exige a
password real de qualquer forma):

- [x] Abrir `http://localhost:7401`, login real, cair em `/terminals`
- [x] Ver um separador por cada projeto que já tinha terminais a correr (`Worksite`/`BizManager`/outros)
- [x] Clicar na lateral um projeto **ativo** do registo sem terminais (ex.: `HomeLab`, se ainda não tiver
  terminais) → abre um `claude` novo e ganha separador
- [x] Com dois separadores abertos (ex.: `Worksite` e `BizManager`), trocar entre eles: foco dividido/grelha
  de um nunca mostra nem deixa focar os terminais do outro; `Alt+1…9` só salta os do separador ativo
- [x] Esconder (×) um separador com terminais a correr → os terminais continuam "a correr"; clicar o
  projeto na lateral outra vez devolve o separador tal como ficou
- [x] Recarregar a página (F5) → reabre logo um separador por cada projeto com terminais existentes
- [x] Se tudo bater certo: marcar o passo 8 como `[x]` em `docs/features/separadores-de-projetos.md`,
  atualizar a secção 6 para "concluído", mudar o Estado da tabela para "✅ Concluída", e riscar este bloco
  daqui

## 2026-09-29 — spec `estilos-de-grelha`, passo 5 (o frontend não arrancou no início desta sessão: "An
Application Control policy has blocked this file" no binário nativo `@rollup/rollup-win32-x64-msvc" —
resolveu-se sozinho a meio da sessão, sem ação nenhuma daqui; ver `notes/learning.md`) — inclui também
outras alterações mais pequenas da mesma sessão, na mesma página (`AltGr+.`, o filtro "a correr" por
omissão, e o `ResumeSessionModal` novo), nunca verificadas no browser

**✅ Feito a 2026-10-21 em Chrome headless via CDP** (instância de teste na 7498, login a sério com credenciais
descartáveis, registo de teste Alfa/Beta/Gama, `CLAUDE_CONFIG_DIR` próprio): 57/57 nos dois blocos (separadores +
estilos de grelha). Cenário em `%TEMP%\claude\…\063b02f3-…\scratchpad\verify-tabs-grid.cjs`.

Automático feito nesta sessão (sem login real — a extensão do Chrome precisa da password verdadeira de
qualquer forma): passos 1-4 da spec (`gridStyle.ts`, `GridStylePicker`, `TerminalGrid` com as quatro
disposições, `TerminalsPage` com `gridStyle`/`slotIds` por projeto), depois revisto para persistir em
`localStorage` (pedido do dono); atalho `AltGr+.` para esconder/mostrar a lateral
(`useTerminalShortcuts.ts`); filtro "a correr" ativo por omissão na lateral (`TerminalSidebar.tsx`), com
um botão "Ver todos os projetos" quando o filtro não deixa nada visível; `NewTerminalDrawer` (pasta + modo
+ sessão + nome) substituído por `ResumeSessionModal` (só a lista de sessões gravadas, pedido do dono —
"tem demasiado bloat" para o único fluxo que ainda o usava). `npx tsc -b` e `npm run lint` do frontend
limpos a cada passo. Docs atualizados (`docs/product/use-cases.md`, `docs/features/terminais.md`
§"Layouts" e passo 13, `docs/features/separadores-de-projetos.md` §5 passo 6,
`docs/skills/references/design/{grid-styles,drawers-and-modals}.md`).

Por fazer (só o dono — precisa de login real; a extensão do Chrome nunca respondeu nesta sessão):

- [x] Abrir `http://localhost:7401`, login real, cair em `/terminals`
- [x] **Filtro por omissão**: a lateral abre já só com "a correr" ativo (chip marcado); um projeto do
  registo sem nenhum terminal, ou com terminais mas nenhum a correr, não aparece; clicar o chip "a correr"
  outra vez (ou "Ver todos os projetos", se aparecer) mostra tudo
- [ ] → movido para o bloco `atalhos-editaveis` (o CDP não simula AltGr). **`AltGr+.`**: esconde/mostra a lateral em qualquer sítio da página, incluindo com um terminal
  focado a receber texto (não deve escrever nada no terminal)
- [x] **`ResumeSessionModal`**: clicar o ícone "Retomar" de um projeto com sessões gravadas abre o modal
  (não o drawer antigo) só com a lista dessas sessões; uma sessão já aberta noutro terminal aparece
  desativada; escolher uma e "Retomar sessão" abre um terminal nessa sessão e fecha o modal; um projeto
  sem nenhuma sessão gravada mostra "Nenhuma sessão gravada nesta pasta." em vez da lista
- [x] Mudar para o modo Grelha, num projeto com pelo menos 2 terminais; abrir o seletor de estilo no
  cabeçalho da grelha e escolher cada um dos quatro: 3×2 · Colunas (2/3/4) · 2×2 · Principal + laterais
- [x] Com "2×2" e só 2 terminais: 2 quadrantes ocupados + 2 com "+"; clicar um "+" cria um terminal e ele
  ocupa esse quadrante
- [x] Com 6 terminais em "2×2": os 2 a mais não aparecem na grelha mas continuam "a correr" na lateral;
  clicar um deles na lateral troca-o para o quadrante que tinha o teclado (não o mais antigo)
- [x] Duplo clique ou `Alt+1…9` continuam a ampliar por cima de qualquer estilo; sair da ampliação devolve
  ao estilo e aos lugares tal como estavam
- [x] **Persistência (revisto 2026-09-29)**: escolher um estilo != 3×2 num projeto, navegar para a
  Biblioteca e voltar → o projeto continua no mesmo estilo/lugares; recarregar a página (F5) → o mesmo,
  para todos os projetos com um estilo escolhido; um projeto nunca tocado continua em Grelha 3×2
- [x] Se tudo bater certo: marcar o passo 5 como `[x]` em `docs/features/estilos-de-grelha.md`, atualizar a
  secção 6 para "concluído", mudar o Estado da tabela para "✅ Concluída", e riscar este bloco daqui

## 2026-09-30 — spec `upload-de-skills`, passos 5 e 6 — **verificado em Chrome headless (CDP), 39/39**

A extensão do Chrome voltou a falhar ("No group with id", 3 tentativas). Feito pelo driver CDP de
2026-09-28, com **login a sério** numa segunda instância do backend (porta 7498/7499, credenciais de
teste geradas na hora, `WORKFLOW_PATH` = **cópia** da biblioteca real, SPA servida do `frontend/dist`).
Provado por DOM + rede + disco, nunca por screenshot.

**36/36 no fluxo principal** (biblioteca copiada): login; cabeçalho já sem "Só leitura"; botão só na tab
Skills; drawer a 540 px; zona tracejada com o limite visível; "Enviar" desativado sem stack/ficheiro;
arrastar um `.md` válido → `201`, notificação, drawer fecha, a skill aparece na tabela **sem F5** e
ordenada, **sem um segundo `GET /api/library/skills`**; no disco o ficheiro tem o nome do *frontmatter*
(não o do cliente) e o `provides-skills` ganhou o nome com o resto do `STACK.md` intacto; duplicado →
`409` dentro do drawer, que continua aberto, sem notificação por cima e sem tocar no ficheiro;
frontmatter inválido e nome fora de kebab-case → `400` com a lista do que falha; ficheiro > 256 KB
avisado na UI **e** recusado pelo backend, sem escrever; escolher por clique (input escondido) funciona e
faz upload numa segunda stack; reabrir o drawer limpa stack/ficheiro/erro; consola sem erros.

**3/3 no estado vazio** (instância com `library/stacks` vazia): o botão continua visível, o drawer
explica que é preciso uma stack primeiro e diz `/add-stack`, e Select + zona + "Enviar" ficam desativados.

Por fazer — **só isto, e precisa de ti**:

- [x] ✅ 2026-10-23, 18/18 — feito pela sessão com aprovação do dono: instância de `scripts/verify/` com o
  `WORKFLOW_PATH` real, stack `Tauri v2`; limpo (ficheiro, pasta `skills/` criada pelo `mkdir`, `git checkout`
  do `STACK.md`), `git status` do Workflow limpo. Detalhe na spec §6.
- [x] ~~**Uma passagem contra a biblioteca REAL** (`WORKFLOW_PATH` a sério), que é o que o passo 6 pede.~~
  Não a fiz porque escreve numa pasta partilhada por todos os projetos gerados pelo Workflow, fora deste
  repo — a sessão foi impedida de o fazer ("Modify Shared Resources"), e é um guarda que faz sentido.
  O código é exatamente o mesmo que correu 39/39 contra a cópia, e o editor de frontmatter já foi corrido
  **em leitura** contra os 6 `STACK.md` reais (uma linha muda em cada, idempotente).
  Se quiseres fazê-la: `http://localhost:7401` → login → Biblioteca → Skills → "+ Adicionar skill" →
  stack **`Tauri v2`** ou **`Rust + Axum`** (nunca `react-vite-antd` nem `spring-boot`, que são `proven`)
  → arrastar `notes/skill-teste-upload.md` → Enviar. Confirmar em
  `Workflow/library/stacks/tauri/skills/skill-teste-upload.md` e no `provides-skills` do `STACK.md`.
  **Depois apagar o ficheiro e repor `provides-skills: []`** (`git checkout library/stacks/tauri/STACK.md`
  no repo do Workflow chega).
- [x] (2026-10-23) Feito isso: marcar os passos 5 e 6 `[x]` em `docs/features/upload-de-skills.md`, Estado "✅ Concluída",
  apagar `notes/skill-teste-upload.md`, e riscar este bloco daqui.

## 2026-10-09 — passkeys no login ([[../docs/adr/0015-passkeys-webauthn|ADR 0015]])

Feito nesta sessão: **34/34 em `localhost`** (Chrome headless, autenticador virtual do CDP, instância de teste).
Fica por fazer, e só depois de a app estar exposta com HTTPS e um domínio fixo (ideia "Antes de sair de `127.0.0.1`"):

- [ ] Pôr `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGINS` no domínio final; com a password, em Definições → Passkeys → Adicionar, **no iPhone real** → o Face ID cria a passkey no chaveiro do iCloud
- [ ] Terminar sessão no iPhone → "Entrar com passkey" (e a sugestão no campo do nome) → entra sem password
- [ ] Revogar a passkey do iPhone a partir do portátil → a sessão do iPhone cai no pedido seguinte
- [ ] Confirmar que 5 tentativas/min (password + passkey) e o `SESSION_MAX_DAYS` se mantêm atrás do túnel (o IP pode ser sempre o mesmo — `trustProxy`)
- [ ] (opcional, já em local) Windows Hello real no Chrome do desktop em `http://localhost:7400`

## 2026-10-20 — spec `atalhos-editaveis` (feita em Chrome headless via CDP, 40/40)

O fluxo todo foi verificado numa instância de teste (porta 7498, credenciais geradas na hora): gravar,
colisão, Esc, Ctrl recusado, aviso, remapear, remover/repor, `Alt+L` dentro do terminal, recarregar,
reiniciar o backend, "Repor predefinidos". O CDP não consegue simular o **AltGr**.

Por fazer (só o dono, no browser real com teclado PT):

- [ ] **AltGr+.** ainda esconde/mostra a lateral nos Terminais (predefinido de "Esconder / mostrar a lateral") — 2026-10-21: a extensão do Chrome também não o simula (envia Ctrl+Alt+. com `getModifierState("AltGraph") === false`, que a app ignora de propósito); só ao teclado
- [ ] Nas Definições → Atalhos, "Alterar" nessa ação e carregar **AltGr+.** → fica "AltGr+." (e não "Alt+." nem um erro)
- [ ] **Alt+\** (a tecla à esquerda do 1 num teclado PT) continua a dividir/juntar

## 2026-10-23 — spec `pre-visualizacao`, passo 1 (spike) — parte (e)

O link `https://bino.tailb8eca6.ts.net:8443` só foi aberto **no próprio desktop** (a tailnet ainda não tinha outro
dispositivo). Fazer no passo 8, com o Tailscale instalado no PC do dono:

- [ ] O link de uma pré-visualização abre noutro dispositivo da tailnet, fora da rede de casa
- [ ] Com o Tailscale desligado nesse dispositivo, o link não abre

## 2026-10-23 — spec `pre-visualizacao`, passo 8 (precisa do dono: sessão do Claude, password, PC fora de casa)

Já feito pela sessão: `TAILSCALE_BIN` no `backend/.env`, backend reiniciado — a pré-visualização está ligada na app
(http://localhost:7401). O código foi verificado com fakes, contra o Tailscale real (ligar/desligar/limpeza) e no
browser com respostas intercetadas (20/20); **falta a passagem com um servidor de dev verdadeiro**.

- [ ] Tailscale instalado no PC remoto, mesma conta; `tailscale status` no desktop mostra-o
- [ ] Num terminal da app, projeto com Vite, o Claude corre `npm run dev` em background
- [ ] `Alt+L` na app → etiqueta 🔗 com o host no cabeçalho do terminal **e** mensagem no Telegram com o link e "Desligar"
- [ ] `/preview` no bot real → lista o terminal → (várias portas? botões) → link
- [ ] No PC fora de casa o link abre a app e o HMR funciona (uma alteração aparece sozinha)
- [ ] Medições (registar na spec §6): `tailscale ping bino` (direto ou `via DERP`, ms); DevTools → Network com
      "Disable cache": "Load" e nº de pedidos, comparado com o mesmo projeto em `localhost` no desktop; F5 com cache;
      tempo de um HMR. > ~5 s a frio ou DERP → abrir a pergunta "pré-visualizar o build" (spec §7)
- [ ] Tailscale desligado no PC remoto → o link não abre (é a parte (e) do spike, acima)
- [ ] Parar o `npm run dev` → em ≤ 15 s o link cai e o Telegram avisa "o servidor de dev (porta …) parou"
- [ ] Fechar o terminal com o link ligado → aviso "o terminal terminou"; no desktop
      `tailscale serve status --json` → `{}`
- [ ] "Desligar o link" no Telegram e o ✕ na app desligam (e a etiqueta sai em ≤ 10 s na outra vista)

## 2026-10-26 — spec `novo-projeto-guiado`, passo 10 (precisa do dono: o `claude` real gasta quota, e a criação é longa)

O código está verificado: o mecanismo com o `claude` real (spike, 10 min de espera, motor de produção), o `/create`
real por HTTP até à proposta (2×, ~2 min), e o browser com a skill simulada (`/_guided` 30/30, `/new-project` 30/30).
**Falta a passagem completa, com o `/create` real a gerar um projeto, pela UI.**

**✅ Feito com o dono a 2026-10-26** (a Estante, destino em `projetos/` em vez de `_teste-create` — por isso o Abrir projeto deu "fora das pastas autorizadas" na instância de teste). Resultados e achados na spec §6, passo 10.

- [x] Instância: `npm run build` no frontend; `node scripts/verify/instance.mjs start --port 7498 --fresh --workflow
      <Workflow real> --real-claude` (o `~/.claude` do dono; o Workflow nas roots). Para o **Abrir projeto** funcionar,
      o destino tem de ficar dentro das roots da instância (o "Outro" do E1 com `<run dir>/roots/_teste-create`)
- [x] `git status` do Workflow limpo antes de começar; HEAD anotado
- [x] Novo projeto → descrição de um projeto de teste → Começar; responder às perguntas abertas na caixa
- [x] Todas as escolhas chegam como cartões (vocabulário, B, C, D, E1-E5, confirmação) — anotar alguma que venha em
      texto livre (e se o E5 é perguntado: numa corrida a seco não foi)
- [x] A proposta aparece formatada (tabelas, listas) → **Gerar**
- [x] Permissões como cartões: a escrita no destino, o `git init`, a linha em `projects/INDEX.md` → Permitir
- [x] A atividade da geração é legível ("Escreveu N ficheiros…"); nenhuma permissão que devesse estar na allowlist
- [x] Fim → resumo, decisões em aberto, próximo passo → **Abrir projeto** → Terminais com o projeto num separador e
      um terminal lá
- [x] Medir: tempo total; quantas vezes foi preciso **Ver terminal** (objetivo: zero); o polling a 1,5 s parece fluido?
      (spec §7 — se não, SSE numa 2.ª iteração)
- [x] Limpar: apagar a pasta do projeto de teste; `git checkout -- projects/INDEX.md` (e o que mais o `/create` tenha
      tocado) no Workflow; `git status` limpo; parar a instância (`stop --clean`)

## 2026-10-26 — ADR 0021 (permissões das sessões guiadas): contar numa criação real

Verificado: o hook real com o modo e o destino (testes de unidade sobre o `guided-hook.cjs` gerado), e o seletor no
browser (14/14, instância `--git-workflow`). **Falta**: uma criação real com o `/create` atualizado.

- [ ] Na próxima criação real (pode ser um projeto a sério), em **Perguntar**: quantas permissões aparecem? Eram 53;
      o esperado é só `git init`, o commit, a linha do `projects/INDEX.md` e comandos fora da allowlist
- [ ] O `destination.json` aparece na pasta do brief logo a seguir ao "Gerar"
- [ ] Trocar para **Automático** a meio: a permissão que estava à espera passa, e não aparecem mais cartões
