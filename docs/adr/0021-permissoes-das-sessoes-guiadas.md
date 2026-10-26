---
tags: [adr]
status: aceite
data: 2026-10-26
---

# 0021 — Permissões das sessões guiadas: o destino aprovado pelo hook e um modo Automático da app

**Data**: 2026-10-26 · **Estado**: `aceite` · **Decidido com**: o dono, no passo 10 da spec
[[../features/novo-projeto-guiado]]

Complementa o [[0020-sessoes-guiadas]] (o `--permission-mode default` fixo e o hook `PermissionRequest`
continuam; muda só **quem** decide cada pedido).

## Contexto

Na primeira criação real pela UI (a Estante, 2026-10-26) o dono teve de responder a **53** cartões de
permissão. 45 eram ferramentas de ficheiros (`Read`/`Glob`/`Grep`/`Edit`/`Write`) **dentro do destino** que o
próprio `/create` estava a gerar: as permissões do `--settings` guiado fixam-se ao lançar o `claude`, antes de o
destino existir. Os outros 8 eram `node`, `git init` e `gh`. O dono pediu: "alternar entre auto mode on com
manual mode, como posso fazer no terminal, só que neste chat, através de um botão, ou um dropdown".

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **Destino: o `/create` declara-o num ficheiro, o hook aprova as ferramentas de ficheiros lá dentro** | Elimina a causa (45/53) sem perguntar nada; o Workflow já sabe o destino depois do "Gerar" | Contrato novo com o Workflow; o ficheiro é escrito pelo Claude — precisa de limites |
| Destino: `Edit(//<root>/**)` no `--settings` | Uma linha | Deixa a sessão editar **todos** os projetos das `ALLOWED_ROOTS` sem perguntar |
| Destino: deduzir da resposta ao E1 | Nada no Workflow | Depende do texto da pergunta — frágil |
| **Modo Automático da app: o hook aprova sem cartão** | Previsível, trocável a meio, sem tocar no TUI | Aprova tudo, sem o classificador do auto mode do Claude Code |
| Auto mode do Claude Code (Shift+Tab no PTY) | O classificador de segurança do Claude | Shift+Tab percorre modos às cegas — a app não sabe em que modo ficou; no `auto` o `PermissionRequest` não chega e o regresso a "Perguntar" depende do mesmo ciclo |

## Decisão

1. **O destino.** Depois do "Gerar", o `/create` em modo app escreve `<pasta do brief>/destination.json`
   (`{"version":1,"projectPath":"<destino>"}`). O hook aprova sem cartão `Read`, `Glob`, `Grep`, `Edit`,
   `Write`, `MultiEdit` e `NotebookEdit` cujo caminho esteja **dentro** desse destino, só se o destino:
   - é absoluto, fica **dentro** de uma `ALLOWED_ROOTS` e não **é** uma root;
   - não contém nem está dentro do Workflow nem do `DATA_DIR`;
   - **não existia antes da sessão**: não existe ainda, ou a pasta nasceu (`birthtime`) depois do início da
     sessão. Sem `birthtime` fiável, não conta.
   É isto que limita um `destination.json` que aponte para outro projeto: um projeto que já existia continua a
   pedir. Bash nunca é aprovado por esta regra.
2. **O modo.** Cada sessão tem um modo, **Perguntar** (omissão) ou **Automático**, trocável a qualquer altura na
   página (`PUT /api/guided/:id/mode`). Em Automático o hook aprova qualquer `PermissionRequest` sem cartão; ao
   passar para Automático, as permissões que já estão à espera são aprovadas. As perguntas (`AskUserQuestion`)
   **continuam sempre** a ser cartões — o modo só toca nas permissões.
3. **O controlo fica fora do alcance do Claude.** O modo e o início da sessão vivem em
   `DATA_DIR/guided-control/<id>.json`, escrito só pelo backend — fora de `DATA_DIR/guided/**`, onde o
   `--settings` deixa o Claude escrever sem perguntar. Senão, o próprio Claude podia ligar o Automático ou
   recuar o início da sessão.

## Consequências

- Uma criação típica passa de dezenas de cartões para os poucos que interessam (`git init`, comandos fora da
  allowlist do Workflow); em Automático, para zero.
- O Automático é "aceitar tudo" dentro de uma sessão cujo trabalho é escrever um projeto novo: é escolha do
  dono, explícita, por sessão, e volta-se atrás no mesmo seletor. Não muda o modelo de ameaça do
  [[0004-exposicao-e-modelo-de-ameaca]]: quem chega à página já tem sessão, e um terminal já é um shell.
- O contrato do `/create` em modo app ganha o `destination.json` (Workflow: `docs/skills/skill-create.md` →
  "Modo app"). Um `/create` que não o escreva só perde a aprovação automática no destino.
- As aprovações automáticas aparecem na conversa como as outras (o `.jsonl` regista a decisão do hook).

## Estado

`aceite` — 2026-10-26.
