---
tags: [adr]
status: proposto
data: 2026-11-12
---

# 0029 — `node-pty` 1.2.0-beta.18 em vez da 1.1.0 (segfault do ConPTY)

**Data**: 2026-11-12 · **Estado**: `proposto` (até a suite e o uso real confirmarem — ver "Consequências") ·
**Decidido com**: o dono, no plano `2026-11-08-teste-worker-intermitente` (opção A de quatro).

## Contexto

Com `node-pty` **1.1.0** (a `latest`), em Node v24.16.0 / Windows, o ConPTY faz **segfault nativo** (exit 139
em 4 de 8 corridas da suite em `--pool=threads`, em pontos aleatórios dos ficheiros que abrem e fecham PTYs).
Nos testes aparece como "Worker exited unexpectedly" (508/512 em vez de 512/512) e como
`Cannot create process, error code: 87`. Não é carga nem um `taskkill` a atingir o worker (medido e
refutado). **O mesmo segfault pode acontecer no backend real e matar todos os terminais.**

## Opções

| Opção | Prós | Contras |
|---|---|---|
| **A. `1.2.0-beta.18`, `--save-exact` (escolhida)** | 0 segfaults em 8 corridas; única que protege o backend real; reversível numa linha | Dependência nativa em beta; `pty.pid` passa a ser 0 (ver abaixo) |
| B. Esperar pela 1.2 estável | Nenhum código | Sem data; a suite falha em ~metade das corridas; backend exposto |
| C. Aceitar e documentar | Nenhum trabalho | Suite pouco fiável; risco real por tratar |
| D. Repetir por ficheiro (retry) | Suite mais estável | Esconde o problema; não protege o backend real |

## Decisão

1. **`node-pty` fixo em `1.2.0-beta.18`** (`--save-exact`). Voltar à `1.1.0` é uma linha no `package.json`.
2. **Quando sair a 1.2 estável**, passa para ela (sem novo ADR, só a versão) depois de a suite passar.
3. **O código não confia em `pty.pid`**: na 1.2 é `0` logo a seguir ao `spawn` (o processo sobe de forma
   assíncrona) e volta a `0` depois da saída. `0` é perigoso — `process.kill(0, 0)` sinaliza o próprio grupo
   de processos (parece "vivo" para sempre) e os "descendentes" do pid 0 são tudo o que o sistema lançou.
   Por isso o `Terminal` guarda o **último pid real** (`TerminalInfo.pid`), `isAlive` recusa `pid <= 0` e
   `closeGracefully` não lista descendentes de um pid 0.
4. **O `pid` devolvido pelo `create` pode ser 0** (foi lido antes de o processo subir). Quem precisa do pid lê
   `get(id)` depois de o terminal ter produzido saída.

## Consequências

- ⚠️ Beta nativa: ler as notas de cada beta nova antes de subir; fixar sempre a versão exata.
- Os 2 testes do `terminalManager` (Ctrl+C duplo; kill após a graça) liam `info.pid` do `create` — agora
  leem-no do `get()` depois do `ready`. Não era um problema da beta no fecho, era o pid 0.
- Smart App Control ([[../backend-conventions]]): confirmar que os binários da beta passam (passaram a
  2026-11-12 no arranque do backend e nos testes).
- Por verificar no uso real: terminais a abrir/fechar durante dias sem segfault do backend.
- Complementa [[0001-stack-tecnologica]] (a versão do `node-pty`) e [[0004-exposicao-e-modelo-de-ameaca]]
  (o guard contra `pid` 0 evita sinalizar processos que não são nossos).
