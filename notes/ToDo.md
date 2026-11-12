# ✅ ToDo

**Próximas implementações — fonte de verdade para o que está pronto a ser implementado.**

Usa `/implement-todo` para analisar, priorizar e implementar os itens daqui.

---

## Fundação

Semeado pelo Workflow a 2026-09-27. A ordem importa: sem a fundação, as skills não têm onde agarrar.

### Backend — `node-fastify` (📋)

### Frontend — `react-vite-antd` (✅)

---

## Modelo de dados

Do `/design-database` de 2026-09-28 — **sem base de dados**, um `state.json` ([[../docs/database|database]],
[[../docs/adr/0009-estado-em-ficheiro-json|ADR 0009]]). O `StateStore` está feito; o resto (Terminais guardados, Pastas) vai na
spec Terminais, em baixo.

---

## MVP — a detalhar

Da entrevista. ⚠️ = ainda por especificar — o `/implement-todo` pergunta os detalhes (ou `/plan-feature`,
quando levar várias sessões).

- [ ] ⏳ Spec [[../docs/features/pre-visualizacao|pré-visualização remota]] — **7/8 passos feitos (2026-10-23)**, código com push; falta só o **passo 8, comigo**: instalar o Tailscale no PC remoto (mesma conta), pôr um `npm run dev` a correr num terminal da app, `Alt+L` ou `/preview`, abrir o link fora de casa, medir a velocidade, e fechar o terminal para ver o aviso. Checklist em [[verificacao-browser-pendente]] → "passo 8"; o que falta documentar depois está na spec §6. `/implement-todo` → "Implementar a partir de uma spec". ([[../docs/adr/0018-pre-visualizacao-por-tailscale-serve|ADR 0018]]; veio de `ideas.md`: "Botão Pré-visualizar num terminal")

- [ ] Spec [[../docs/features/upwork|Upwork]] (11 passos, **10 feitos — 2026-10-26**; falta o 11, comigo: uma candidatura real) — secção **Upwork**: colo um anúncio e uma skill nova do Workflow (`/upwork-proposal`, sessão guiada) gera análise "vale a pena?", carta, respostas de triagem, plano técnico e perguntas ao cliente; a candidatura fica com estado (enviada → entrevista → oferta → ganha/perdida), a mesma conversa ajuda nas mensagens do cliente, e **só quando ganha** passa a projeto pelo `/create` guiado. A app nunca toca na Upwork (ToS). Começa pelos ADRs (app 0022, Workflow 0012). `/implement-todo` → "Implementar a partir de uma spec". (pedido direto do dono, 2026-10-26)

- [ ] Botão **"Continuar no Claude app"** no Novo projeto — ligar o Remote Control na sessão do `/create` para responder às perguntas no Claude app (e por áudio), com o nome "Novo projeto · /create". (pedido direto do dono, 2026-11-12)
  > Decidido (via conversa, 2026-11-12): **(1) Spike primeiro** — num terminal guiado parado à espera (`waiting-text`), escrever `/remote-control` no PTY (bracketed paste + Enter, como o `POST /api/guided/:id/message`, ADR 0020 ponto 7) liga o RC sem reiniciar? aceita um nome? Se não, cair para reabrir com `--resume` + `--remote-control "<nome>"` (o caminho do bot, ADR 0017). **(2) Só no Claude app:** com o RC ligado, o `guided-hook.cjs` deixa passar `AskUserQuestion` e `PermissionRequest` sem output (a TUI/Claude app perguntam nativamente) — senão o hook bloqueante segura a pergunta e o Claude app nunca a vê. O interruptor vive em `DATA_DIR/guided-control/<id>.json` (que só o backend escreve, como o `mode` do ADR 0021), ex.: `remote: true`; a página mostra "A responder no Claude app" em vez dos cartões e continua a mostrar a conversa do `.jsonl`; o `result.json` do fim não muda. Sem voltar atrás nesta versão (desligar o RC = ⚠️ por decidir). **(3) ADR novo**: muda o ADR 0020 (perguntas por hook) e o `claudeArgs.ts:121` ("a guided session never runs with remote control"); a pasta tem de ser de confiança na conta (`TERMINAL_007`). Só o Novo projeto (a Upwork fica de fora, por agora). **Esperar pelo commit da sessão que está a mexer em `terminalsService.ts`/`claudeArgs.ts` (spec [[../docs/features/correr-a-app|correr e parar a app]]).** Pôr em produção reinicia o backend da 7400 e mata os terminais — combinar o momento comigo. Verificar: criação real → botão → a sessão aparece no Claude app com o nome → uma pergunta respondida por voz lá chega ao `/create` e a página mostra-a no feed.

---

## Terminais

- [ ] Spec [[../docs/features/correr-a-app|correr e parar a app]] (8 passos, 0 feitos — 2026-11-12) — botões **Correr**/**Parar** no cabeçalho comum da página Terminais (grelha e foco), com "A correr · 12 min · :5173"; o `/run` corre num terminal sempre escondido, e uma skill `/stop` nova, obrigatória no Workflow, desliga a app. Começa pelos ADRs (app 0030, Workflow 0013). `/implement-todo` → "Implementar a partir de uma spec". (pedido direto do dono, 2026-11-12)

- [ ] Terminal novo ocupa o primeiro lugar vazio da grelha — hoje, num estilo com lugares (2×2, Colunas, Principal + laterais), um terminal aberto fora do "+" do próprio lugar (o "+" do projeto na lateral, "Noutra conta", `Novo terminal`, "Retomar sessão", atalho) só é ampliado e, ao sair da ampliação, fica de fora mesmo com um "+" à vista.
  > Decidido (via refine-idea, 2026-11-12): com um lugar livre, o terminal vai para o **primeiro lugar vazio, sem ampliar**, e fica com o teclado (como faz o `handleSlotNew`); **grelha cheia → como hoje** (amplia, fica de fora até ser clicado na lateral; não empurra ninguém); **fechar um terminal não preenche nada** — fica o "+", a grelha nunca muda sozinha; Grelha 3×2 (`classic`) e Foco dividido não mudam. Onde: `focusTerminal`/`focusedLayout` e `handleCreate` em `frontend/src/pages/TerminalsPage.tsx` (lugar livre = `sanitizedSlotIds` a `null`; gravar com `writeGridPreference`). Muda o comportamento da spec [[../docs/features/estilos-de-grelha|estilos de grelha]] §2 — atualizá-la. Verificar no browser: 2×2 com 2 terminais → "+" da lateral → o novo aparece no 3.º lugar, sem ampliar; com a grelha cheia, continua a ampliar.
- [ ] Estado de cada sessão à vista (a trabalhar / à espera de input / terminada) sem abrir o terminal — backend: hooks no `--settings` dos terminais normais e o estado na API — hoje só há `running | exited` e não se sabe que sessão precisa de mim sem a abrir.
  > Decidido (via refine-idea, 2026-11-12): **4 estados** — A trabalhar (`UserPromptSubmit`/atividade) · Precisa de ti (`Notification` de permissão/pergunta) · À tua espera (`Stop`, acabou o turno) · Terminada (o PTY já não corre). Mesmo mecanismo das sessões guiadas (`guidedService.ts:380`, ADR 0020), mas com hooks **não bloqueantes** que só gravam o último evento por sessão em `DATA_DIR`; o estado vai no que o `useTerminals` já sonda — **sem esperar pelo canal de eventos**. Acrescentar hooks ao `claude-settings.json` muda o ADR 0012 ("só tem `statusLine`") → **ADR novo**. Spike primeiro: que eventos disparam num terminal normal e se o stdin do `Notification` distingue permissão de "parado há 60 s" (sem isso, À tua espera vira Precisa de ti ao fim de um minuto). Fora: notificações (ideia à parte). Atualizar `protocol.ts`, [[../docs/api]] e a spec [[../docs/features/terminais|Terminais]] §2. Verificar: testes do hook com stdin real + um terminal real a passar pelos 4 estados.
- [ ] Ícones de estado no cabeçalho de cada terminal e na lateral de projetos — depende do bullet anterior.
  > Decidido (via refine-idea, 2026-11-12): **só ícone + tooltip**, nada de tags, para ficar limpo. Formas de [[../docs/skills/references/design/tokens-and-colors|tokens]] §3: arco verde a rodar = a trabalhar · losango âmbar cheio = precisa de ti · losango âmbar **vazio** = à tua espera (forma nova, mesmo token `--wfa-state-wait`, acrescentar à tabela) · quadrado cinzento vazio = terminada. Na lateral (`TerminalSidebar.tsx`), cada projeto mostra o estado **mais urgente** das suas sessões, com o número no tooltip. Separador do projeto: fora. Verificar no browser, em foco e em grelha.

---

## Manutenção

- [ ] Teste intermitente no backend: um "Worker exited unexpectedly" do pool de forks (`[vitest-pool]: Worker forks emitted error`) — o worker morre a meio e os testes desse ficheiro que faltam não correm (508/512 em vez de 512/512). Visto em **2 de 4** corridas da suite inteira a 2026-11-07 (e antes: 2026-11-01, também com `test/terminalsService.test.ts` isolado, 1 em 3 no commit e0f3eca). O ficheiro que perde o worker não foi identificado hoje; 4 testes em falta. **Causa apurada a 2026-11-08: segfault nativo do node-pty 1.1.0 (ConPTY) em Node v24.16.0 / Windows.** Com `--pool=threads` o processo do vitest termina com **exit 139 (SIGSEGV)** em 4 de 8 corridas do projeto `processes`, em pontos aleatórios dos ficheiros que abrem/fecham PTYs (`terminalsService`, `terminalManager`, `telegramBot`, `imports.routes`, `terminals.gateway`). Não é carga (`--maxWorkers=1` também morre, 2/6, sem timeouts) nem um `taskkill` a atingir o worker por PID reutilizado (instrumentado ×8: nenhum alvo era um worker). O mesmo componente dá o `Cannot create process, error code: 87` (2/10 isolado, 1/5 suite). Experimentado `node-pty@1.2.0-beta.18` (revertido): sem segfault em 8 corridas, mas 2 testes de `terminalManager` (Ctrl+C duplo; kill após a graça) dão timeout sempre — não é substituto direto, e como dependência nativa beta pede ADR. **Feito a 2026-11-12 (opção a):** node-pty 1.2.0-beta.18 + correção do `pty.pid` a 0 ([[../docs/adr/0029-node-pty-beta-1-2|ADR 0029]], `proposto`); suite 4/4 por omissão e 15/16 em threads (1.1.0: 4/8 crashes). **Resta**: 1 corrida em threads com exit 134 (SIGABRT) nunca reproduzida em 8 corridas seguintes com saída completa — vigiar; quando sair a 1.2 estável, subir e passar o ADR a `aceite`; confirmar no uso real (dias) que o backend não crasha. Atenção: o mesmo segfault pode acontecer no backend real e matar todos os terminais — por verificar se já aconteceu fora dos testes. Medições completas em `notes/roadmap/plans/2026-11-08-teste-worker-intermitente.md`. (A parte do `guidedHook.test.ts` que lia o `.tmp` a meio do rename foi corrigida a 2026-11-07.) (encontrado pelo /implement-todo, 2026-11-01)

---

## How to Use

- Tens uma ideia? `/refine-idea` — lê o vault, pergunta o que falta e escreve o item aqui (ou em [[ideas]])
- Novos itens na secção temática certa (criar uma secção se nenhuma encaixa)
- Itens incompletos/ambíguos com ⚠️ — o `/implement-todo` pergunta os detalhes antes de implementar
- **Tier de modelo** no início de cada item: `opus` (há uma decisão, contrato, schema, segurança) ou
  `sonnet` (sabe-se o quê, onde e como se verifica). Abre a sessão no modelo dos itens que vais fazer;
  um item sem tier recebe-o do `/implement-todo` depois da investigação. Critérios em
  [[ai-workflow]] → "Tiers de modelo"
