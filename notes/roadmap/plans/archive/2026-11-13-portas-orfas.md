# Plano — 2026-11-13 portas-orfas

**Estado**: concluído
**Âmbito escolhido**: só o 🔴 "O 'A correr' do Correr nunca chega com um `/run` real" (Terminais)
**Orçamento da sessão**: sem limite
**Modelo**: tarefas 1-5 `opus`

## Esclarecimentos já obtidos
- Critério "servidor deste projeto" → caminho do projeto (normalizado, sem distinguir maiúsculas, com fronteira) na `CommandLine`/`ExecutablePath` do PID que escuta **ou de um pai vivo**, e esse PID criado **depois** do Correr. Parte-se sempre das portas, nunca de uma pesquisa por linha de comando (regra do `/stop` Step 3). Sem hook `PostToolUse(Bash)`.
- Pré-visualização → descendentes do terminal primeiro (como hoje); só se não houver nenhum, portas com o caminho da pasta do terminal, criadas depois de o terminal abrir.
- Parar → no fim da rede dos 20 s, matar (`taskkill /PID <x> /T /F`, por PID, nunca por nome) os PIDs confirmados como do projeto; depois fechar o terminal.
- Limites → Windows pelo caminho na linha de comando; Linux pelo `/proc/<pid>/cwd`. Servidores sem caminho (`python -m http.server`, `docker`, `npx` da cache) ficam fora, escrito no ADR.
- Custo → ler `CommandLine`/`CreationDate` só das cadeias dos PIDs que escutam.

## Ordem confirmada
1. [x] `opus` ADR 0032 (altera 0030 ponto 2/3 e 0018 ponto 2) — feito (`docs/adr/0032-servidores-de-dev-orfaos.md`, índice e cabeçalhos do 0030/0018)
2. [x] `opus` `processTree` + `listeningPorts`: linha de comando, executável, hora de criação, guarda de PID reciclado, cwd no Linux, testes reais — feito (36 testes, incluindo um órfão real; provado no Vite 3764 vivo)
3. [x] `opus` Correr/Parar: `currentPorts` por caminho + `startedAt`; rede dos 20 s mata órfãos confirmados — feito (`appRunService.ts`: `currentDevPorts` com `owner`, `killPid` no fim da rede; 3 testes novos)
4. [x] `opus` Pré-visualização: descendentes, depois caminho + hora de abertura — feito (`previewService.ts` `portsOf`, `when: no-descendants`; suite 587/587, lint limpo, tsc só com o erro antigo do auth.test.ts)
5. [x] `opus` Verificação real: matar o Vite órfão 3764 (:5174), `scripts/verify/app-run-real.mjs`, o que der do passo 8 — feito (`app-run-real.mjs` 21/21; a 1.ª e a 2.ª corridas pararam no Parar: o Chrome do cenário fora adotado com 5 s de folga → 1 s)

## Próximo passo
Nenhum: concluído. Resta no ToDo passar o `/stop` do Workflow a `proven`.
