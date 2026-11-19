---
tags: [adr]
status: aceite
data: 2026-11-19
---

# 0035 — Sync do deploy git: `ls-remote` primeiro, sem travão, e um push num terminal dispara-o

**Data**: 2026-11-19 · **Estado**: `aceite` · **Decidido com**: o dono, no `/refine-idea` e no `/implement-todo`
de 2026-11-19 — "achas que faz sentido estar a atualizar de 5 em 5 min? [...] atualizar o estado apenas quando
o mesmo é alterado?".

Altera o [[0034-deploy-automatico-a-partir-do-git]]: o ponto 4 (quando corre: travão de 5 min, `force`,
`skipped`) e o ponto 6 (as formas do `GIT_BIN`: passam a quatro). Acrescenta um marcador ao hook do
[[0031-estado-das-sessoes-por-hooks]], sem mudar o estado nem os agentes. Os pontos 1-3, 5, 7 e 8 do 0034 ficam.

## Contexto

O travão do 0034 existia porque cada sync fazia um `git fetch`, que escreve refs no repo do dono e custa uns
segundos. Por causa dele, um deploy feito há 2 minutos não aparecia ao reabrir `/projects`, e o dono tinha de
carregar em "Atualizar do git". O dono quer os dados certos quando os consulta, sem polling.

A mudança acontece no remote, por isso a app só sabe dela de duas formas: pergunta ao remote, ou alguém a avisa.
Um webhook não chega a `127.0.0.1` ([[0004-exposicao-e-modelo-de-ameaca]]). Há, porém, um caso que a app vê:
quando é o Claude, num terminal da app, a fazer o push ou o merge, e aí o hook do 0031 já recebe o comando.

O `git ls-remote origin refs/heads/<b>` devolve só o hash do topo, com um pedido leve, e não escreve nada no
repo. O 0034 rejeitou-o como forma **única** (não dá data nem assunto). Como **primeiro passo**, serve: quase
sempre o topo não mudou, e não é preciso mais nada.

## Opções consideradas

**Quando perguntar ao remote**

| Opção | Prós | Contras |
|---|---|---|
| **`ls-remote` em cada consulta, sem travão (escolhida)** | Sempre certo ao abrir/no foco; o `fetch` só corre quando houve deploy | Um pedido de rede por branch e por consulta |
| Travão de 5 min (o 0034) | Poupa rede | Dados velhos até 5 min; é o problema |
| Temporizador enquanto a página está aberta | Atualiza sozinho | Polling, recusado pelo dono |

**Como o hook avisa o backend**

| Opção | Prós | Contras |
|---|---|---|
| **Marcador em ficheiro + `fs.watch` no backend (escolhida)** | Imediato, não depende da UI, sem superfície de rede nova; o hook continua só a escrever ficheiros | Primeiro `fs.watch` do código: eventos duplicados, tem de se fechar no fim |
| Marcador lido no `GET /api/terminals` | Sem infraestrutura nova | Só com a página Terminais aberta; um efeito dentro de um GET |
| O hook chama uma rota interna com um token | Explícito | Superfície autenticada fora do cookie e do `Origin`; o token fica num ficheiro que o `claude` lê |
| Sem hook | O mais simples | Com `/projects` aberta, o deploy só aparece no próximo foco |

## Decisão

1. **Uma quarta forma do `GIT_BIN`**, antes das outras duas de rede:

   | Forma | Para quê | Tempo limite |
   |---|---|---|
   | `-c credential.interactive=false ls-remote --end-of-options origin refs/heads/<b>` | o hash do topo, sem escrever no repo | 15 s |

   O mesmo `execFile` sem shell, o mesmo ambiente não interativo e o mesmo `BRANCH_NAME` validado do 0034.
   Da saída conta só a linha cujo ref é **exatamente** `refs/heads/<b>` (o padrão do `ls-remote` casa pelo fim),
   com o hash validado (40 ou 64 hex). Sem essa linha → `no-branch`. Os erros mapeiam-se como no `fetch`
   (`no-remote`, `timeout`, `fetch-failed`), e o stderr continua sem sair do ficheiro.
2. **Topo igual ao `lastGitCommit` de todos os ambientes dessa branch → nada mais.** Diferente → o `fetch` +
   `log -1` do 0034, e conta o hash do `log` (pode ter entrado outro push entretanto).
3. **Sem travão.** Saem o intervalo de 5 min, o `force` do pedido e o `skipped` da resposta: o único cliente é o
   frontend da app. Fica só "um sync em curso por projeto": um segundo pedido espera pelo primeiro.
   O pedido passa a `{projectPath}` e a resposta a `{info, warnings}`.
4. **Quando corre**: ao abrir `/projects` (cada projeto com algum `deployBranch`), quando a página volta a ter
   foco ou fica visível (no mínimo 5 s entre duas vezes, como na página Terminais), ao abrir o drawer de um
   projeto, ao gravar uma branch nova e no botão **Atualizar do git**, que fica. Nunca por temporizador.
5. **O marcador do hook**: no `PostToolUse` com `tool_name: 'Bash'`, se `tool_input.command` tiver `git … push`
   ou `gh pr merge`, o hook escreve `DATA_DIR/session-state/<terminal>/push.json` = `{at}`, de forma atómica.
   **Nunca o comando**: a regra de privacidade do 0031 mantém-se. Não se analisa a branch: um push para outra
   branch só custa um `ls-remote` que diz "igual". Como no resto do 0031, só nos terminais normais
   (`WFA_TERMINAL_ID`).
6. **O watcher**: o backend cria `DATA_DIR/session-state/` no arranque e vigia-a com
   `fs.watch(..., {recursive: true})`. Reage só a um ficheiro chamado exatamente `push.json` numa pasta com
   nome de UUID. Espera 1 s por terminal (debounce) e ignora um `at` já tratado. Depois:
   - **terminal → pasta**: o `cwd` guardado do terminal (`state.json` da app), nunca o `cwd` do hook, que segue
     os `cd` do Claude e vem do processo filho;
   - **pasta → projeto**: o projeto do registo cuja pasta é igual à do terminal ou a contém (o mais fundo
     ganha), sem chamadas ao git;
   - **projeto → sync**: só se a ficha tiver algum `deployBranch`; o mesmo sync do ponto 2, em fundo. Os
     avisos não vão a lado nenhum (o drawer volta a vê-los na próxima consulta).

   Um erro do watcher regista-se no log e não derruba o backend. O watcher fecha-se no `onClose` da app.
7. **Sem retries.** Um `gh pr merge --auto`, uma merge queue ou um push em background mudam o topo depois do
   hook. Aceita-se: o próximo abrir ou foco de `/projects` apanha-o com o `ls-remote`.

## Consequências

- Abrir `/projects` faz um `ls-remote` por branch distinta de cada projeto com deploy automático. São uns
  pedidos leves por consulta, e o `fetch` (que escreve refs) só corre quando houve um deploy de facto.
- Uma página `/projects` aberta não se atualiza sozinha quando o watcher regista um deploy: mostra-o quando
  volta a ter foco. Não há push do backend para o frontend.
- O hook lê o `tool_input.command` dos Bash, mas só para um teste por regex; nada do comando é escrito.
- O backend tem o primeiro `fs.watch`. No Windows e no Linux com Node ≥ 20 o `recursive` funciona; os eventos
  duplicados do `rename` atómico absorvem-se pelo debounce e pelo `at` já tratado.
- [[../security]], [[../api]] e [[../environment]] passam a listar a quarta forma, o marcador e a rota sem
  `force`.

## Relacionado

[[0034-deploy-automatico-a-partir-do-git]] · [[0031-estado-das-sessoes-por-hooks]] ·
[[0004-exposicao-e-modelo-de-ameaca]] · [[../features/informacao-dos-projetos]] · [[../api]] · [[../security]]
