---
tags: [adr]
status: aceite
data: 2026-11-18
---

# 0034 — Deploy automático a partir do git: o topo de `origin/<branch>` entra no histórico

**Data**: 2026-11-18 · **Estado**: `aceite` · **Decidido com**: o dono, no `/refine-idea` e no `/implement-todo`
de 2026-11-18 — "quero que o merge para produção preencha o último deploy sem o registar à mão".

Altera o [[0028-informacao-de-deploy-por-projeto]] (ponto 6: "histórico de deploys manual") e a linha "Ler a
data do deploy do git" do "Fora" da spec [[../features/informacao-dos-projetos]]. Abre o `GIT_BIN` do
[[0019-importar-pelas-skills-do-workflow]] (ponto 5) a um segundo sítio, as pastas dos projetos, com outras
formas fixas. Não muda o ponto 4 do 0028: a app continua a não fazer pedidos aos URLs guardados; quem fala com
o remote é o `git`.

## Contexto

O 0028 deixou os deploys só manuais: o dono regista cada um no drawer do projeto. Na prática, um deploy é um
merge para a branch de produção, e o hosting (Vercel, Render…) publica sozinho. Registar à mão é esquecido, e
o "último deploy" fica errado. O git sabe a data e o assunto do commit que está no topo da branch. O hosting
sabe se o build passou, mas lê-lo era uma API por fornecedor e tokens na app, o que o 0028 recusou.

O que o código já tinha: `ProjectEntry.path` é um `realpath` dentro das `ALLOWED_ROOTS`
(`projects/projectsService.ts`). O `WorkflowGit` (`imports/workflowGit.ts`) corre o `git` por `execFile` com
`GIT_TERMINAL_PROMPT=0`. O `StateStore.update` é síncrono. Algumas pastas do registo são subpastas do repo
(`…\Worksite\Worksite`), e outras nem são repo.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **`git fetch` + `git log -1` do topo de `origin/<branch>` (escolhida)** | Sem tokens nem APIs por hosting. Um merge no GitHub dá a hora do merge. Funciona com qualquer hosting que publique a partir de uma branch | Não vê builds falhados. Escreve refs remotas no repo do dono. Pode esbarrar em credenciais |
| `git ls-remote` (sem fetch) | Não toca no repo | Só dá o hash: sem data nem assunto, e a data passava a ser "quando a app viu" |
| API do hosting (Vercel, Render, GitHub Deployments) | A data real e o estado do build | Uma integração por fornecedor, tokens na app (o 0028, ponto 3) e pedidos para fora (o ponto 4) |
| Hook `post-merge`/CI a chamar a app | Imediato | A app em `127.0.0.1` não é alcançável do CI. Escrever hooks nos repos é superfície nova |
| Ficar manual (o 0028) | Nada a fazer | É o problema |

## Decisão

1. **Campo novo por ambiente: `deployBranch`** ("Branch de deploy"), um nome de branch ou `null`. `null` é o
   valor por omissão e quer dizer sem automático. O `version` ("Branch / versão") continua texto livre. O
   nome é validado no zod (backend, com o espelho no frontend) como nome de branch:
   `[A-Za-z0-9._/-]{1,100}`, que não começa por `-` nem `/`, sem `..`, `//`, `@{`, componentes começados por
   `.`, nem `.lock` ou `/` no fim. Inválido dá `COMMON_001`/400 no `PUT`.
2. **Um deploy do git é um deploy como os outros**, no mesmo histórico de 20. Os deploys ganham
   `source: 'manual' | 'git'` (omissão `manual`) e `commit` (o hash completo, ou `null`). Um deploy do git
   leva `version` = hash curto (7), `note` = assunto do commit (cortado a 280) e `at` = **committer date
   (`%cI`)** do topo, em UTC. O "Registar deploy" à mão continua, e o `POST` manual nunca escolhe `source`
   nem `commit`.
3. **Cada ambiente guarda `lastGitCommit`**, o último topo visto (só o backend o escreve). Só entra um deploy
   quando o topo de `origin/<branch>` é diferente de `lastGitCommit` **e** esse hash ainda não está no
   histórico. Por isso, apagar um deploy do git é definitivo, e um deploy que caiu fora dos 20 não volta.
   Mudar o `deployBranch` põe o `lastGitCommit` a `null`. A primeira sincronização regista o topo atual.
4. **Quando corre**: `POST /api/project-infos/git-sync` com `{projectPath, force?}`.
   - Ao abrir `/projects`, o frontend chama-o em fundo para cada projeto com algum `deployBranch`. O backend
     corre o git no máximo 1× a cada 5 min por projeto, com um `Map` em memória que se perde ao reiniciar, o
     que se aceita. Dentro do intervalo responde `skipped: true` sem correr o git.
   - O botão **Atualizar do git** no drawer manda `force: true` e ignora o intervalo.
   - Só há um sync em curso por projeto: um segundo pedido espera pelo primeiro.
   - A resposta é `{info, warnings, skipped}`, e cada aviso é `{environmentId, reason}`.
5. **O repo**: o `cwd` é o `ProjectEntry.path`, validado outra vez com `resolveAllowedPath` no momento.
   - O `git rev-parse --show-toplevel` sobe sozinho até à raiz. A raiz (com `realpath`) **tem de estar
     dentro das `ALLOWED_ROOTS`**; se não estiver, dá o aviso `outside-roots`.
   - Só o remote `origin`.
6. **As formas do `GIT_BIN`** são só três, todas por `execFile` sem shell, com argumentos fixos. O nome da
   branch só entra depois de validado, e sempre dentro de um refname completo, atrás de `--end-of-options`:

   | Forma | Para quê | Tempo limite |
   |---|---|---|
   | `rev-parse --show-toplevel` | encontrar a raiz e confirmar que é repo | 5 s |
   | `-c gc.auto=0 -c credential.interactive=false fetch --no-tags --no-write-fetch-head --end-of-options origin +refs/heads/<b>:refs/remotes/origin/<b>` | trazer o topo de uma branch | 15 s |
   | `log -1 --format=%H%x00%cI%x00%s --end-of-options refs/remotes/origin/<b>` | hash, data e assunto | 5 s |

   - Há um fetch **por branch distinta** do projeto, e não um para todas: uma branch que não existe no remote
     faz falhar o fetch inteiro, e assim só falha o ambiente dela.
   - O ambiente do processo leva `GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never` e `GIT_OPTIONAL_LOCKS=0`.
     Leva também `GIT_SSH_COMMAND=ssh -o BatchMode=yes`, mas só se o ambiente não trouxer já `GIT_SSH_COMMAND`
     nem `GIT_SSH`.
   - Nada de `push`, `pull`, `merge`, `checkout` nem `reset`: a working tree e o index nunca se tocam.
7. **Falhas são avisos, nunca erros.** Estes casos dão um aviso no ambiente e não fazem falhar o pedido:
   - sem git (`ENOENT`) → `no-git`;
   - pasta que não é repo → `no-repo`;
   - raiz fora das `ALLOWED_ROOTS` → `outside-roots`;
   - sem `origin` → `no-remote`;
   - branch inexistente no remote → `no-branch`;
   - autenticação, rede ou lock de outra operação git → `fetch-failed`;
   - tempo esgotado → `timeout`.

   A UI mostra-os discretamente no drawer e nunca como notificação ao abrir `/projects`. O único erro da rota
   é `PROJECT_001` (projeto fora do registo). O stderr do git não vai para a API, para não vazar URLs com
   credenciais.
8. **O git corre fora do `StateStore.update`**, que é síncrono. Dentro da receita volta-se a confirmar que o
   ambiente existe, que o `deployBranch` é o mesmo e que o hash não entrou entretanto, e depois ordena-se e
   corta-se nos 20, como no registo manual.

## Consequências

- O "último deploy" do projeto passa a ser a hora do último merge para a branch de produção. Um build que
  falhou no hosting aparece na mesma como deploy. Aceita-se, e para isso o dono apaga-o.
- Um push direto (fast-forward) leva a data do commit original, que pode ser anterior ao push.
- O fetch escreve `refs/remotes/origin/<b>` no repo do dono, tal como um `git fetch` feito por ele. Não grava o
  `FETCH_HEAD` nem tags, e não corre `gc`. Um `git pull` num terminal ao mesmo tempo pode dar
  `fetch-failed` por lock, e resolve-se no sync seguinte.
- O `git` corre com a configuração do repo do dono (helpers de credenciais, `core.sshCommand`, o hook
  `reference-transaction`, se existir). É a mesma confiança de abrir um terminal nessa pasta, que a app já faz.
  Um repo privado sem credenciais guardadas dá `fetch-failed` em vez de abrir uma janela.
- [[../security]] e [[../environment]] passam a listar as três formas e o ficheiro novo.

## Relacionado

[[0028-informacao-de-deploy-por-projeto]] · [[0019-importar-pelas-skills-do-workflow]] ·
[[0004-exposicao-e-modelo-de-ameaca]] · [[../features/informacao-dos-projetos]] · [[../database]] · [[../api]]
