# Skill: Stop

> 🚧 Convenção prospetiva — ainda sem código neste projeto que a valide.

**When to use**: parar a app que o [[skill-run]] arrancou — a pedido, para libertar as portas, ou porque a
app que gere os terminais escreveu `/stop` no terminal onde correu o `/run` (um botão **Parar**). **Quem para é o Claude**:
esta skill diz como, sem matar nada que não seja deste projeto.

**Time**: ~30 s

> A app que escreve o `/stop` espera que o turno do `/stop` acabe e, ao fim de 20 s, fecha o terminal de qualquer
> maneira. Por isso: **sem relatórios longos e sem perguntas na conversa que fez o `/run`** — lá, tudo o que
> está a correr foi esta conversa que o arrancou.

---

## Step 0: O que está a correr?

Portas do projeto: `:7400` (backend, que também serve a SPA) e `:7401` (Vite)

```bash
netstat -ano | grep -E ":7400|:7401" | grep LISTENING
```

Nada a escutar e nenhuma tarefa do `/run` nesta conversa → dizer "nada a correr" numa linha e acabar.

## Step 1: Na conversa que fez o `/run` — pelos IDs

Se esta conversa tem as tarefas em background que o `/run` lançou, **terminá-las pelo ID** (é a única coisa
que sabe exatamente o que arrancou). Depois, o que o `/run` arrancou à parte, sem perguntar — foi esta
conversa que o pôs de pé:

- Backend e frontend: terminar as duas tarefas em background pelos IDs. **Ao parar o backend, todos os
  terminais (PTYs) abertos pela app morrem com ele** — se havia sessões do Claude Code a trabalhar, dizê-lo numa
  linha (retomam-se com `--resume`, mas o trabalho em curso é interrompido).

Peças sem porta (uma CLI, um worker) só se param por aqui: noutra conversa não há como confirmar de quem
são, e não se matam.

## Step 2: Confirmar por fora — sempre

Voltar a correr o `netstat` do Step 0. **Terminar a tarefa não chega** quando ela lançou um `node` (npm,
`npx`, `tsx`, Next): no Windows mata a shell e deixa o servidor órfão a ouvir na porta — o arranque seguinte
dá `EADDRINUSE` ou, pior, serve código velho. Já aconteceu em dois projetos, várias vezes.

Portas livres → Step 5. Ainda alguma a escutar (órfão, ou esta conversa não fez o `/run`) → Step 3.

## Step 3: Pelas portas — confirmar o dono antes de matar

Por cada porta que ainda escuta:

1. **O PID que escuta** (o PID lançado muitas vezes não é esse):
   ```bash
   netstat -ano | grep ":<porta> .*LISTENING"     # → PID na última coluna
   ```
2. **De quem é.** Em Windows não se lê a pasta de trabalho de outro processo; lê-se a linha de comando e o
   executável **desse PID e dos pais**:
   ```powershell
   $p = <pid>; for ($i = 0; $i -lt 8 -and $p; $i++) {
     $x = Get-CimInstance Win32_Process -Filter "ProcessId=$p"; if (-not $x) { break }
     "$($x.ProcessId) $($x.Name) | $($x.ExecutablePath) | $($x.CommandLine)"; $p = $x.ParentProcessId
   }
   ```
   Linux: `readlink /proc/<pid>/cwd` · macOS: `lsof -a -p <pid> -d cwd -Fn`.
   **É do projeto** se o caminho absoluto da pasta do projeto aparece (sem distinguir maiúsculas em
   Windows, com `\` ou `/`) na linha de comando ou no executável do PID ou de um dos pais — ex.:
   `…\<projeto>\frontend\node_modules\vite\bin\vite.js` — ou se a pasta de trabalho fica dentro dele.
3. **Confirmado → matar a árvore pelo PID:**
   ```bash
   taskkill //PID <pid> //T //F                     # /T leva os filhos  (Linux/macOS: kill <pid>)
   ```
   **Não confirmado → não matar.** Mostrar o PID, o nome e a linha de comando, e perguntar. Uma porta
   ocupada por outra app é o caso que esta regra existe para proteger.

**Ler** a linha de comando de um PID já encontrado pela porta é seguro. **Encontrar** processos filtrando
por `CommandLine` não é: o texto procurado está também na linha de comando da shell que corre o filtro, e
ela vai junta. Nunca matar processos por nome às cegas.

## Step 4: Noutra conversa — serviços à parte

Se o projeto tem `docker-compose.yml`/`compose.yaml`:

```bash
docker compose ps --status running
```

Serviços de pé → mostrá-los e **perguntar** antes de `docker compose down`: esta conversa não sabe se foi o
`/run` que os arrancou ou se outra coisa os está a usar (uma base de dados partilhada, por exemplo).

## Step 5: Confirmar e reportar

O `netstat` do Step 0 sem nada a escutar. Reportar numa ou duas linhas: o que se parou, as portas livres, e o
que ficou de pé de propósito (com o porquê). Ficou alguma porta por confirmar → dizê-lo, com o PID.

## Final Checklist

- [ ] Na conversa do `/run`: tarefas paradas pelos IDs e o que foi arrancado à parte, sem perguntas
- [ ] Portas confirmadas por fora (`netstat`), nunca só pela tarefa terminada
- [ ] Nenhum processo morto sem o dono confirmado (linha de comando/executável do PID ou dos pais, ou a pasta)
- [ ] Nada procurado por `CommandLine` nem por nome; `docker compose down` noutra conversa só depois de perguntar
- [ ] Relatório curto; o que ficou de pé, dito
- [ ] Comandos de paragem iguais aos de `docs/commands.md` (ou esta skill e a `run` corrigidas)

## Related Skills

[[skill-run]] — quem arranca · [[commands]]
