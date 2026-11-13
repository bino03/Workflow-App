---
tags: [adr]
status: aceite
data: 2026-11-13
---

# 0032 — Servidores de dev órfãos: o projeto reconhece-se pelo caminho e pela hora

**Data**: 2026-11-13 · **Estado**: `aceite` · **Decidido com**: o dono, no `/implement-todo` de 2026-11-13 (o 🔴
do passo 8 da spec [[../features/correr-a-app|correr e parar a app]]).

Altera o [[0030-correr-e-parar-a-app-de-um-projeto]] (pontos 2 e 3) e o
[[0018-pre-visualizacao-por-tailscale-serve]] (ponto 2). Não muda o [[0004-exposicao-e-modelo-de-ameaca]]: o
cliente continua a mandar só um caminho ou um `terminalId`, e tudo o resto lê-se do sistema operativo.

## Contexto

Os ADRs 0030 e 0018 definiam "a app deste terminal" como **as portas em escuta num processo descendente do PID do
PTY**. O spike do 0018 (2026-10-23) confirmou isso. Mas no passo 8 do Correr (2026-11-13, Claude Code 2.1.323) o
`/run` do PortFolio arrancou o Vite e a app nunca o viu:

```
vite (3764, ::1:5174) ← cmd ← npm ← bash ← bash ← (21720, já não existe) ← … claude (PTY)
```

O Claude Code lança as tarefas em segundo plano por uma shell que **sai logo**. A árvore fica órfã e o
`ParentProcessId` do primeiro `bash` aponta para um PID morto, por isso a descida a partir do PTY nunca a
alcança. Ao fim de 3 min, o Correr deu "Não arrancou". O Parar também não a apanha: o `taskkill /T` e a lista de
descendentes do `closeGracefully` seguem a mesma árvore, por isso o Vite ficou de pé depois de o terminal fechar.
A pré-visualização tem o mesmo ponto cego com qualquer `npm run dev` lançado em segundo plano.

O que se viu nesse Vite órfão:
- A **linha de comando** traz o caminho absoluto do projeto:
  `"node" "C:\…\PortFolio - Frontend\node_modules\.bin\\..\vite\bin\vite.js"`. O `vite.cmd` do `node_modules\.bin`
  expande o `%dp0%`.
- O **executável** é o `node.exe` global e não traz o caminho. O `cmd`, o `npm` e os `bash` também não.
- Todos foram **criados** no mesmo segundo, depois do Correr.
- O hook `PostToolUse(Bash)` recebe o `backgroundTaskId` da tarefa, mas **não o PID** (lido no `.jsonl` da
  execução).

## Opções

| Opção | Prós | Contras |
|---|---|---|
| **A. Caminho do projeto no processo que escuta ou num pai vivo, criado depois de T (escolhida)** | Funciona com o órfão real, porque o caminho está na linha de comando do próprio Vite. Parte das portas, por isso o custo é o das cadeias de quem escuta. A hora afasta servidores antigos e PIDs reciclados | Não apanha servidores sem o caminho na linha de comando (`python -m http.server`, `docker`, `npx` da cache). Não distingue dois terminais na mesma pasta |
| B. O mesmo sem a hora | Também vê um servidor que já estava de pé | Mostra "A correr" sem o `/run` ter arrancado nada, e o Parar mataria um servidor que não é seu |
| C. Hook `PostToolUse(Bash)` no terminal do `/run` | Sabe que houve uma tarefa em segundo plano | Não dá o PID, por isso só vale como sinal e não como identidade. Pede `WFA_TERMINAL_ID` no terminal escondido (o 0031 deixa-o de fora de propósito) |
| D. Contar qualquer cadeia criada depois de T, mesmo sem caminho | Apanha mais servidores | Falsos positivos: qualquer servidor que arranque na máquina nesse intervalo |

## Decisão

1. **Um processo é "deste projeto"** quando escuta numa porta e é da pasta `P` desde o instante `T`. Isso quer
   dizer que ele ou um dos seus pais, subindo até 8 níveis, **traz `P`**, e que todos os processos dessa subida
   foram **criados em `T` ou depois**:
   - **Windows**: `P` é um argumento da `CommandLine`, ou está dentro de um argumento, ou é o `ExecutablePath`.
     Para isso, a linha de comando divide-se em argumentos (as aspas respeitam-se) e cada argumento é
     normalizado: `/` passa a `\`, `\\` e `..` resolvem-se e as maiúsculas ignoram-se. Depois exige-se uma
     fronteira de caminho: o argumento é `P`, ou começa por `P\`, ou tem `=P` (`--root=P`). Assim
     `…\PortFolio - Frontend-x` não conta para `…\PortFolio - Frontend`.
   - **Linux**: a pasta de trabalho do processo (`/proc/<pid>/cwd`) é `P` ou está dentro de `P`. A linha de
     comando conta como no Windows.

   A subida pára num pai criado **depois** do filho. Isso é um PID reciclado, não um pai. A subida também pára
   num pai criado antes de `T`, como o explorador ou um editor aberto antes, e é isso que impede que uma janela do
   VS Code com a pasta na linha de comando "adote" um servidor qualquer. Parte-se **sempre das portas** e nunca
   de uma pesquisa por linha de comando. É a mesma regra do `/stop` (Step 3): o processo que pesquisa traz o
   texto que procura.
2. **Correr** (altera o 0030, ponto 2): "a correr" = portas em escuta abaixo do PTY **ou** de processos do
   projeto, com `P` = a pasta do projeto e `T` = a hora do Correr. A folga é de **1 s**, só para os relógios: o `T`
   marca-se depois de o terminal abrir, por isso tudo o que o `/run` lança é posterior. Com 5 s, o Chrome do próprio
   cenário de verificação foi adotado, porque o pai `node` tinha o caminho do projeto nos argumentos e arrancou 3 s
   antes. O Parar matou-o. O resto do
   ponto 2 não muda.
3. **Parar** (altera o 0030, ponto 3): se, quando a rede dos 20 s acaba, ainda houver portas do projeto, a app
   **mata pelo PID cada processo que escuta e que confirmou como do projeto** (`taskkill /PID <x> /T /F`;
   `SIGKILL` no Linux). Nunca mata por nome. Depois fecha o terminal, como antes. Os pais que ficarem órfãos (o
   `cmd`, o `npm` e o `bash`) saem sozinhos quando o filho morre.
4. **Pré-visualização** (altera o 0018, ponto 2): primeiro, as portas abaixo do PTY, como hoje. **Só se não
   houver nenhuma**, contam as portas dos processos do projeto, com `P` = a pasta do terminal e `T` = a hora a que
   o terminal abriu. Com dois terminais na mesma pasta, um servidor órfão pode aparecer nos dois. É aceite: o
   cliente continua a só poder escolher uma das portas que o backend lhe ofereceu.
5. **Uma leitura por sondagem**: no Windows, uma só PowerShell com um comando fixo lê as portas, os processos
   (PID, pai, nome, hora de criação) e a linha de comando e o executável **só das cadeias de quem escuta**. Na
   regra 4 o comando fixo continua sem nada do cliente. As linhas de comando lidas nunca vão para o log nem para
   a API: a API devolve só a porta, o PID e o nome do processo, como antes.
6. **Fica de fora**: servidores sem o caminho na linha de comando (no Windows) ou sem a pasta como `cwd` (no
   Linux). Fica também de fora o caso de dois terminais da mesma pasta na pré-visualização. Os projetos do
   Workflow arrancam por `npm`/Vite, que passam no critério.

## Consequências

- O Correr vê o Vite que o `/run` lança em segundo plano, e o Parar já não deixa um Vite órfão de pé.
- O `closeGracefully` de um terminal normal **não muda**: fechar um terminal continua a não matar servidores fora
  da sua árvore. Só o Parar mata órfãos, porque só aí se sabe que o servidor é da execução.
- Se um servidor do mesmo projeto for arrancado à mão **depois** do Correr, conta como da execução, e o Parar
  mata-o. O mesmo vale para qualquer processo com o caminho do projeto nos argumentos, lançado depois do Correr (ou até
  1 s antes), e para os filhos dele. É o preço de não ter o PID da tarefa, e fica escrito.
- Com a sondagem de 2 s do frontend, cada GET custa uma PowerShell em vez de duas.
- Relaciona-se com [[0004-exposicao-e-modelo-de-ameaca]], [[0029-node-pty-beta-1-2]] (o `pty.pid` pode ser 0)
  e [[0031-estado-das-sessoes-por-hooks]] (o hook continua sem tocar no terminal do `/run`).
