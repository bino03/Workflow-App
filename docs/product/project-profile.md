# Perfil do projeto (entrevista de criação)

> O registo das respostas que o `/create` recebeu a 2026-09-27 e das decisões que tirou delas. Não se edita
> para "atualizar" — as decisões que mudarem vão para ADRs novos. Serve para perceber, daqui a meses,
> porque é que o vault nasceu assim.

## Respostas

### Contexto dado ao lançar o `/create` (verbatim)

> - Objetivo do projeto: uma app pessoal que dá uma UI própria ao Claude Code, para gerir várias
>   sessões/terminais ao mesmo tempo e ver/lançar o Workflow sem abrir o Obsidian.
> - Só para mim (jlalvescarvalho53@gmail.com), uso pessoal, sem intenção de comercializar.
> - Motor: NÃO usar Claude Agent SDK nem modo headless da API (`claude -p`) — ambos faturam à parte
>   da subscrição. A app pilota o Claude Code interativo normal (o mesmo login/subscrição
>   Pro/Max), correndo-o dentro de um pseudo-terminal (PTY) gerido pelo backend, servido ao
>   frontend por WebSocket (padrão "web terminal": tipo node-pty + xterm.js). Isto já está
>   registado como decisão em docs\adr\0005-motor-via-pty-sobre-subscricao.md (do Workflow).
> - Funcionalidades mínimas esperadas (MVP): abrir/fechar terminais (cada um = uma sessão do Claude
>   Code) a partir da UI; ver e escrever em cada terminal em tempo real; correr skills/slash
>   commands normalmente (são só bytes para o stdin); navegar o registo da biblioteca do Workflow
>   (stacks, designs, skills, maturidade) lido a partir de library.
> - Consequência a não esquecer no design: os limites de uso da subscrição (janela de 5h / tecto
>   semanal do Max) são partilhados por conta, não por terminal.
> - Stack técnica: NÃO está na composição conhecida do registo de stacks do Workflow (é
>   Spring Boot + React + Supabase — não serve para isto); vai precisar de uma combinação nova
>   (backend capaz de gerir processos/PTYs + WebSocket, frontend com terminal emulator). Se não
>   houver módulo na biblioteca que sirva, avança com um módulo 📋 mínimo criado na hora em vez de
>   forçar `/add-stack` primeiro, a não ser que reconheças uma stack já madura na biblioteca que
>   encaixe.
> - Ainda em aberto (perguntar normalmente na entrevista): nome definitivo, ecrãs
>   exatos além dos terminais, forma final da UI (desktop/web), onde fica o repositório.

### Bloco A — Produto

Propostas do `/create` confirmadas ou corrigidas pelo utilizador (verbatim entre aspas):

- **A1** (nome + frase): proposta `workflow-app` — "Uma UI própria para o Claude Code: gerir várias
  sessões ao mesmo tempo e navegar a biblioteca do Workflow sem abrir o Obsidian." → "A1 ok"
- **A2** (problema): "correto para alem de ser mais fácil acompanhar o que estou a fazer posso facilicar o meu trabalho"
- **A3** (quem, onde, como): "neste momento o meu pc é um portatil, mas futuramente estava a pensar em
  deixar isto a correr no meu desktop que tenho em casa e depois poderia usar onde quisesse"
- **A4** (papéis): "sim, não precisa de roles visto que vou ser o unico a usar, mas claro que vai
  precisar de login tendo em conta que no futuro vou dar deploy na web e qualquer pessoa pode usar isto"
- **A5** (MVP): "exato, no fundo tem que dar para fazer tudo que consigo fazer neste momento no
  terminal, o resume , escolher a pasta de cada terminal indicador de cota usada tambem, lançar o create
  tambem deve fazer mas está longe de ser uma prioridade neste momento portanto deve ficar apenas
  documentado para o futuro"
- **A6** (entidades): "aqui ainda não sei, decido mais tarde"
- **A7** (dois ecrãs): "tudo do frontend também ainda vou desenhar mais tarde, por agora ainda não sei, fica em standby"
- **A8** (piloto): "confirmo, uso pessoal"

### Blocos B–E

O utilizador respondeu "podes fazer tudo" e deu:
- pasta do projeto: `C:\Users\jlalv\Desktop\utad\projetos\WorkFlow App`
- repositório: `https://github.com/bino03/Workflow-App.git`

Tudo o resto dos blocos B–E foi decidido pelo `/create` com as omissões abaixo (**não foram perguntadas**
— rever se alguma não servir; cada uma que tenha peso tem ADR):

| # | Decisão por omissão | Porquê |
|---|---|---|
| B1 | Forma: backend próprio + UI web (servida pelo backend em produção) | Acesso "onde quiser" exige um servidor; a forma final (web/desktop) fica em aberto |
| B2 | Login próprio, um só utilizador (password + cookie HttpOnly) — **não** Supabase Auth | Um utilizador, sem BD obrigatória; ver [[../adr/0003-auth-utilizador-unico]] |
| B3 | Nenhuma capacidade extra (ficheiros, notificações, jobs, idiomas) | Nada na entrevista as pede |
| B4 | Sem visibilidade por campo | Sem roles |
| C | `node-fastify` (📋, criado na hora) + `react-vite-antd` (✅) + xterm.js; sem plataforma | Ver [[../adr/0001-stack-tecnologica]] |
| D1 | Design: **decidir mais tarde** | A7: frontend em standby |
| D2/D3 | Portátil/desktop; responsivo por decidir | A3 fala de "usar onde quisesse" — fica em aberto |
| D4 | UI em pt-PT | Omissão |
| E2 | Vault na raiz, `backend/` + `frontend/` | Padrão Worksite |
| E3 | Specs de features multi-sessão (`/plan-feature`) | O PTY, a auth e a quota são features de várias sessões |
| E4 | Sem espelho no Notion | Omissão |
| E5 | `git init` + remoto dado | Resposta do utilizador |

## Perfil derivado

| | |
|---|---|
| **Flags ligadas** | `has-backend` · `has-frontend` · `auth` · `feature-specs` · `design-pending` · `prospective` |
| **Stacks** | `node-fastify` (📋 criado na hora — Node + TypeScript + Fastify + node-pty) + `react-vite-antd` (✅) + xterm.js |
| **Tema** | pending |
| **Layout do repo** | backend `backend/`, frontend `frontend/`, vault em `.` |

## O que ficou de fora, e porquê

| O quê | Porquê ficou de fora |
|---|---|
| Stack `spring-boot` (✅) | Gerir PTYs + WebSocket é possível (pty4j), mas o ecossistema de terminais web (node-pty, xterm.js) é Node — ver [[../adr/0001-stack-tecnologica]] |
| Stack `rust-axum` (🟡) | `portable-pty` serve, mas a stack está parcial e custaria aprender Rust para uma app pessoal; `conflicts-with` nada aqui — descartada por custo |
| Stack `supabase` (✅) | Um só utilizador, sem BD obrigatória no MVP: Auth/Postgres/Storage geridos seriam infraestrutura sem uso |
| `tauri` (📋) | A forma desktop está em aberto; se vier, é uma camada por cima do mesmo backend |
| Skills do `spring-boot` (`add-backend-feature`, `add-database-table`, `permissions-and-auth`, `add-file-upload`) | Stack não escolhida |
| Skills de backend da stack `node-fastify` | Nenhuma — stack 📋 sem código provado; nunca se inventam skills |
| `session-handoff` | Sem `sessions` |
| `sync-docs` | Sem `notion-mirror` |
| `verify-in-browser` + `notes/verificacao-browser-pendente.md` | Sem `browser-verification` (e o conteúdo dos terminais é canvas do xterm.js — mal verificável por DOM) |
| Agentes com modelo fixado (`.claude/agents/`) | Sem `agents` — ironia a notar: esta app pode vir a ser o sítio onde se lançam |
| Padrões `multi-tenancy-shared-schema`, `roles-and-permissions`, `file-storage`, `local-remote-boundary` | Sem `multi-tenant`, `roles`, `file-upload`, `has-desktop` |
| `docs/multi-tenancy.md`, `sessions/`, `Templates/Sessão.md` | Flags desligadas |

## Perguntas que ficaram em aberto

| Decisão | Opções à mesa | Quando |
|---|---|---|
| **Nome definitivo** | "Workflow App" é provisório | Quando houver um melhor |
| **Forma final da UI** | Web no browser · PWA · desktop (Tauri/Electron) por cima do mesmo backend | Antes do `/choose-design` |
| **Ecrãs e layout dos terminais** | Separadores · grelha · split; ecrãs além de Terminais/Biblioteca | `/choose-design` |
| **Identidade visual** | `/choose-design` (biblioteca, net, Claude Design) | Antes de qualquer ecrã |
| **Persistência** | Nenhuma BD (tudo em memória + o que o Claude Code já grava em `~/.claude`) · ficheiro JSON · SQLite | `/design-database` (Fundação) |
| **Fonte do indicador de quota** | Ver [[../product/domain-brief]] → perguntas em aberto — nenhuma fonte está confirmada | Spike antes da feature |
| **Como expor fora de casa** | VPN mesh (Tailscale) · túnel com autenticação à frente (Cloudflare Tunnel + Access) · reverse proxy com TLS | Antes de sair de `127.0.0.1` — ver [[0004-exposicao-e-modelo-de-ameaca]] |
| **Onde corre em "produção"** | Portátil hoje → desktop de casa (SO por confirmar) | Quando se mudar |
| **Vida dos PTYs sem browser** | Continuam a correr quando o browser fecha (proposta) · morrem | Na feature de terminais |
| **Reconexão e scrollback** | Buffer no servidor por terminal (quanto?) e reenvio ao voltar a ligar | Na feature de terminais |
| **Limite de terminais simultâneos** | `MAX_TERMINALS` (proposta: 8) — a quota é partilhada | Na feature de terminais |
| **2FA no login** | TOTP · nada | Antes de expor na web |
| **Responsivo / telemóvel** | Sem tratamento · responsivo | `/choose-design` |
| **Testes do frontend** | Sem Vitest (omissão da stack) · Vitest + Testing Library | No scaffold do frontend |
