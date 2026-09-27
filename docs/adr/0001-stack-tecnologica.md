---
tags: [adr]
status: aceite
data: 2026-09-27
---

# 0001 — Stack tecnológica

## Contexto

Hoje o trabalho com o Claude Code faz-se em várias janelas de terminal soltas, cada uma com uma sessão
do `claude`, e com o Obsidian aberto ao lado para consultar a biblioteca do Workflow. Com várias sessões
em paralelo perde-se a noção de qual está a fazer o quê, e não há um sítio que mostre quanto da quota
da subscrição já foi gasto. O Workflow App junta isso numa só interface: abrir e fechar sessões do
Claude Code, vê-las e escrever nelas em tempo real, retomá-las, escolher a pasta de cada uma, ver a
quota usada e navegar a biblioteca do Workflow — tudo o que hoje se faz no terminal, mas mais fácil de
acompanhar. O motor é o próprio Claude Code interativo, a correr num pseudo-terminal (PTY) gerido pelo
backend, com a subscrição Pro/Max já paga — nunca a API nem a Agent SDK ([[adr/0002-motor-via-pty-sobre-subscricao]]).

Restrições e forças que pesaram (da entrevista de criação):

- **O motor é o Claude Code interativo num PTY** ([[0002-motor-via-pty-sobre-subscricao]]): o backend tem
  de criar e gerir pseudo-terminais no **Windows** (ConPTY) hoje, e talvez noutro SO no desktop de casa, e
  servir cada um por **WebSocket** a um emulador de terminal no browser.
- **Uso pessoal, um utilizador**, mas com **login** porque vai ser exposta na web.
- **Sem base de dados obrigatória**: as sessões são gravadas pelo próprio Claude Code (`~/.claude/projects/`);
  a biblioteca é lida do disco do Workflow.
- A biblioteca do Workflow não tem nenhuma stack de backend orientada a processos/terminais; a
  composição conhecida (`spring-boot` + `react-vite-antd` + `supabase`) não serve, como o próprio utilizador
  antecipou.
- O frontend é um back-office leve (listas, formulários, o registo da biblioteca) + terminais —
  `react-vite-antd` (✅) cobre a parte de back-office; o terminal é xterm.js, que é agnóstico.

## Opções consideradas

| Opção (backend) | Prós | Contras |
|---|---|---|
| **Node + TypeScript + Fastify + node-pty (escolhida)** | `node-pty` é o PTY do terminal do VS Code — o caminho mais batido, com ConPTY no Windows; xterm.js é do mesmo ecossistema e dos mesmos autores; TypeScript dos dois lados; WebSocket nativo no Fastify | Não existe na biblioteca (📋 criado na hora, sem skills); `node-pty` é um módulo nativo (build no Windows pode pedir VS Build Tools) |
| Spring Boot + pty4j (✅ na biblioteca) | Stack provada, convenções e skills prontas | `pty4j` (JetBrains) é bem menos usado fora do IntelliJ; as skills da stack são de CRUD+BD, que aqui quase não existe; JVM pesada para um gestor de processos |
| Rust + Axum + portable-pty (🟡) | Binário único, leve — bom para o desktop de casa | Stack parcial, sem skills; custo de aprender Rust para uma app pessoal |
| Ferramenta pronta (ttyd / wetty) + UI à parte | Terminal web imediato | Um processo por terminal, sem API para listar/retomar/escolher pasta — a app ficaria a colar ferramentas |

Frontend: `react-vite-antd` (✅) + **xterm.js** (`@xterm/xterm`, `@xterm/addon-fit`). Plataforma: nenhuma.

## Decisão

**Backend `node-fastify`** — Node (LTS) + TypeScript strict + Fastify + `@fastify/websocket` + `node-pty`,
módulo 📋 criado na hora pelo `/create` (as convenções vivem em [[../backend-conventions]], todas 🚧).
**Frontend `react-vite-antd`** (✅) com **xterm.js** para os terminais. **Sem plataforma** (sem Supabase):
login próprio de um utilizador ([[0003-auth-utilizador-unico]]) e persistência por decidir
(`/design-database`).

A razão principal: o problema central é *gerir pseudo-terminais e ligá-los a um terminal no browser*, e o
ecossistema onde isso é caminho batido (VS Code, Theia, wetty) é `node-pty` + `xterm.js`. Uma stack
provada da biblioteca não compensa usar uma biblioteca de PTY marginal.

Portas `7400` (backend) e `7401` (frontend) — **de propósito fora das portas dos outros projetos**
(`8080`, `5173`, `3000`), porque os projetos vão ser desenvolvidos *dentro* de terminais desta app e os
dev servers deles não podem colidir com ela.

## Consequências

- Fica mais fácil: seguir exemplos e issues do VS Code/xterm.js; um só idioma (TypeScript) nos dois lados;
  tipos das mensagens do WebSocket partilháveis.
- Fica mais difícil: a stack de backend **não tem skills nem armadilhas provadas** — as convenções são
  🚧 e as primeiras tarefas incluem um *spike* do PTY no Windows. Quando o código existir, correr
  `/harvest-project` no Workflow para a transformar num módulo a sério (`/add-stack`).
- `node-pty` é nativo: instalar pode exigir as Visual Studio Build Tools no Windows; fixar a versão.
- Testes: Vitest no backend (gestor de terminais, auth); frontend sem testes automáticos na Fundação
  (omissão da stack), com `tsc -b` + lint + verificação manual — escrito em [[../commands]].
- Se o backend alguma vez tiver de ser Spring/Rust, o contrato (REST + protocolo do WebSocket em
  [[../api]]) é o que se preserva.

## Estado

`aceite` — decidido na criação do projeto, a 2026-09-27.
