---
tags: [adr]
status: aceite
data: 2026-11-01
---

# 0027 — Várias contas do Claude: uma pasta de configuração por conta, com o resto partilhado

**Data**: 2026-11-01 · **Estado**: `aceite` (2026-11-01, spike do passo 1; era `proposto` até o spike da spec
[[../features/contas-do-claude]] confirmar os pressupostos) · **Decidido com**: o dono — "quando quero mudar de conta,
dou logout, login, abro o link no browser certo e colo o código… não há maneira de automatizar isto?"

Complementa o [[0002-motor-via-pty-sobre-subscricao]] (continua a ser sempre a subscrição) e o
[[0012-argumentos-do-claude-e-status-line]] (a quota passa a ser por conta).

## Contexto

O dono tem mais do que uma subscrição do Claude. Hoje, para trocar, faz `/logout` e `/login` num terminal, abre o link
no browser onde está a conta certa e cola o código. Repete isto **sempre** que troca, e todos os terminais ficam na
mesma conta.

O Claude Code guarda o login na pasta de configuração (`CLAUDE_CONFIG_DIR`, por omissão `~/.claude`):
`.credentials.json` (tokens OAuth) e `.claude.json` (`oauthAccount`, confiança das pastas, flags). A app só conhece uma
pasta, a do `.env`.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **Uma pasta de configuração por conta, criada pela app, com `projects/`, skills, plugins… ligados à pasta principal (escolhida)** | Login feito uma vez por conta; contas diferentes **em simultâneo**, por terminal; uma só lista de conversas e a mesma memória por projeto; o `claude` não sabe que é especial | Junctions/symlinks a criar e a apagar com cuidado; ficheiros soltos (`settings.json`, `CLAUDE.md`) não se ligam no Windows sem privilégios → copiados |
| Trocar o `.credentials.json` no sítio (guardar uma cópia por conta) | Nada de pastas novas | Uma conta de cada vez para a máquina toda; os terminais a correr renovam o token e escrevem-no por cima — as contas apagam-se uma à outra |
| `claude setup-token` por conta + `CLAUDE_CODE_OAUTH_TOKEN` no ambiente do filho | Sem pastas | A app passava a guardar segredos de longa duração; abre a denylist de `CLAUDE_*` ([[0004-exposicao-e-modelo-de-ameaca]]); o token não traz `oauthAccount` (email, quota por conta) e pode não servir para Remote Control |
| Pastas por conta totalmente separadas | Isolamento total | Skills e settings duplicados; continuar uma conversa noutra conta obriga a copiar `.jsonl`; memória por projeto dividida |

## Decisão

1. **Conta principal = a pasta de hoje** (`CLAUDE_CONFIG_DIR` do `.env` ou `~/.claude`), id `primary`. Nunca é
   movida nem removida. As contas extra vivem em `DATA_DIR/accounts/<uuid>/`. **O caminho deriva do id e nunca vem de
   um pedido HTTP.**
2. **Partilhado com a principal** (ligações de pasta: `junction` no Windows, symlink no Linux): `projects/`
   (conversas e memória), `skills/`, `plugins/`, `agents/`, `commands/`, `dev-mods/`. Ficheiros soltos (`settings.json`,
   `CLAUDE.md`, `keybindings.json`) e a chave `mcpServers` do `.claude.json` (os servidores MCP do utilizador) são
   **copiados** da principal antes de cada arranque de um terminal dessa conta: a principal é a fonte, e uma alteração
   feita dentro de uma conta extra perde-se.
   **Separado**: `.credentials.json`, o resto do `.claude.json` (conta, confiança das pastas), `history.jsonl`,
   `daemon/` e `sessions/` (cada conta tem o seu supervisor) e o resto.
3. **O único efeito no filho** é `CLAUDE_CONFIG_DIR=<pasta da conta>` no ambiente. O binário, os argumentos fixos e a
   denylist não mudam.
4. **Conta ativa** (no `state.json`) = a omissão de tudo o que se cria (terminais, sessões guiadas, importações, bot).
   Um terminal guarda o `accountId` com que foi aberto e reabre nessa conta, a não ser que se peça outra
   (**"Continuar noutra conta"**: com `projects/` partilhado, basta reabrir com a outra pasta e `--resume`).
5. **Quota por conta**: o `statusline.cjs` sabe a conta pelo `CLAUDE_CONFIG_DIR` que herda e escreve
   `usage.json` (principal, o ficheiro de hoje) ou `usage-<uuid>.json`.
6. **Login pela app, uma vez**: "Adicionar conta" cria a pasta e as ligações e abre um terminal dessa conta para o
   `/login` (o browser + código fazem-se uma única vez). "Remover conta" apaga a pasta **sem seguir as ligações**.

## Consequências

- Continuar uma conversa grande noutra conta reenvia o contexto inteiro: a cache de prompts é por conta e de curta
  duração, e não se exporta. A app mostra o tamanho antes (do `usage` da última resposta no `.jsonl`).
- A confiança das pastas é por conta: na primeira vez, numa conta nova, o `claude` volta a perguntar (e o Remote
  Control recusa uma pasta ainda não confiada nessa conta — `TERMINAL_007`).
- Apagar uma conta tem de desfazer as ligações antes de apagar a pasta. Um `rm -r` que siga uma junction apaga as
  conversas e as skills **da conta principal**. Isto fica coberto por um teste.
- Duas contas na mesma conversa ao mesmo tempo não acontece: uma sessão só pode estar aberta num terminal
  (`TERMINAL_003`).

## Estado

`proposto`. Os pressupostos (as junctions seguidas pelo `claude`, `--resume` entre contas, a status line com o env
herdado, `/login` como primeira mensagem, `fs.rm` sem seguir as junctions) confirmam-se no passo 1 da spec.
