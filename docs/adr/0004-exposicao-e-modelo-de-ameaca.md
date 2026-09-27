---
tags: [adr]
status: aceite
data: 2026-09-27
---

# 0004 — Um terminal é um shell: `127.0.0.1` por omissão e proteções obrigatórias antes de expor

## Contexto

Cada terminal desta app corre o Claude Code, que **executa comandos na máquina** (com as permissões que
pede, ou sem pedir, conforme o modo). Quem consegue escrever num terminal consegue, na prática, fazer o
que quiser no computador: ler `.env`s, apagar ficheiros, instalar coisas. A app é, para efeitos de
segurança, um **acesso remoto à máquina** — do nível de um SSH.

O plano é deixá-la a correr no desktop de casa e usá-la "onde quiser", pela web.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| Abrir a porta ao mundo com login da app | Simples | Uma falha na app (ou uma password fraca) = a máquina de casa comprometida |
| **Só `127.0.0.1` por omissão; proteções da app sempre ligadas; exposição só por uma camada autenticada à frente (escolhida)** | Defesa em profundidade | Mais uma peça a configurar para usar fora de casa |

## Decisão

Obrigatório **sempre**, mesmo em `localhost`:
1. **Bind em `127.0.0.1`** por omissão (`HOST`). Qualquer outro valor é uma mudança deliberada.
2. **Login** em todas as rotas e no WebSocket ([[0003-auth-utilizador-unico]]).
3. **Verificação do `Origin`** no upgrade do WebSocket contra `CORS_ALLOWED_ORIGINS` — impede que uma
   página qualquer aberta no browser se ligue a um terminal (Cross-Site WebSocket Hijacking).
4. **O cliente não escolhe o que se executa**: só `CLAUDE_BIN`, com argumentos fixos; `--resume` só
   com um UUID validado; nunca um shell.
5. **Pastas limitadas** a `ALLOWED_ROOTS` (resolvidas com `realpath`).
6. **O conteúdo dos terminais nunca vai para logs.**

Antes de a app ser alcançável fora da máquina, além disso:
1. **TLS** (nunca HTTP na rede) e `COOKIE_SECURE=true`.
2. **Uma camada autenticada à frente da app** — *como* (VPN mesh tipo Tailscale, túnel com controlo de
   acesso tipo Cloudflare Tunnel + Access, ou reverse proxy com TLS e autenticação) **fica em aberto**;
   o que se decide aqui é que a app nunca é a única porta.
3. [[../../notes/roadmap/pre-deploy-security|pre-deploy-security]] fechada.

## Consequências

- Usar a app a partir de outro dispositivo exige, primeiro, a decisão de exposição (um ADR novo).
- O modelo de permissões do Claude Code (aprovar comandos, modo de permissões) é a última linha de defesa
  dentro de cada terminal — a app não o contorna nem o automatiza (nunca lança com
  `--dangerously-skip-permissions` por omissão).
- Testes de segurança obrigatórios quando existir o código: WebSocket sem cookie → recusado; com cookie
  mas `Origin` alheio → recusado; `cwd` fora das raízes (com `..` e symlink) → recusado.

## Estado

`aceite` — as proteções 1-6 entram na Fundação; a forma de expor é uma decisão em aberto.
