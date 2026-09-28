---
tags: [adr]
status: aceite
data: 2026-09-28
---

# 0013 — Linux com ambiente gráfico leve no desktop de casa

## Contexto

A app vai passar do portátil (Windows, onde foi desenvolvida) para o **desktop de casa**, sempre ligado e
usado a partir de outro dispositivo ([[0004-exposicao-e-modelo-de-ameaca]]). O SO desse desktop estava por
decidir ([[README]] → "Onde corre em produção").

A restrição principal é a **memória: 8 GB**. O desktop tem de aguentar, ao mesmo tempo:

| O quê | RAM aproximada |
|---|---|
| SO em repouso | Windows 11 ~3-4 GB · Linux + Xfce ~0,8-1 GB |
| Backend desta app (Node) | ~150 MB |
| Cada terminal com o `claude` | ~200-400 MB (3-4 terminais ≈ 1-1,5 GB) |
| Chrome para a verificação no browser ([[../operations]] → "Testar outras apps no browser") | ~1-2 GB |
| A app em teste | um Spring Boot ~0,5-1 GB de JVM, mais o Vite |

Em Windows, um Spring Boot aberto mais o Chrome já põe a máquina em swap; em Linux sobram ~2-3 GB.

Outras forças: a verificação no browser pela extensão Claude in Chrome precisa de uma **sessão gráfica
aberta**; o servidor tem de estar **sempre ligado**; o `node-pty` usa ConPTY no Windows e o PTY nativo em Linux.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **Linux com ambiente gráfico leve** — Xubuntu LTS ou Debian + Xfce, login automático (escolhida) | ~2-3 GB a mais de RAM livre; `node-pty` no caso nativo; Docker sem VM; não reinicia sozinho por atualizações | A app nunca correu em Linux; a extensão Claude in Chrome em Linux por confirmar; projetos só-Windows deixam de abrir lá |
| Manter Windows | Zero migração; é onde a app foi desenvolvida e testada | 3-4 GB só para o SO; reinícios de atualização num servidor "sempre ligado"; Docker Desktop traz uma VM |
| Windows + WSL2 | Ferramentas Linux sem sair do Windows | A VM do WSL2 come RAM **por cima** do Windows — o pior dos dois com 8 GB |
| Linux servidor, sem ambiente gráfico | Mínimo de RAM | Sem sessão gráfica não há Claude in Chrome — só Playwright headless |
| Dual boot | Mantém o Windows para outros usos | Um servidor sempre ligado não pode depender de em que SO arrancou |

## Decisão

**Linux com ambiente gráfico leve (Xubuntu LTS ou Debian + Xfce), com login automático.** A razão principal
é a RAM: com 8 GB, os 2-3 GB que o Windows gasta em repouso são a diferença entre testar uma app Spring
Boot no browser com folga e fazê-lo em swap. O ambiente gráfico (e não um servidor puro) fica para a
extensão Claude in Chrome ter uma sessão onde correr.

Premissa: o desktop fica **dedicado** a isto. Se passar a ter outros usos que precisem de Windows, rever.

## Consequências

- **A confirmar antes de instalar** (checklist em [[../operations]]):
  - a extensão Claude in Chrome funciona com o Chrome em Linux — se não, a decisão mantém-se e a
    verificação no browser passa a ser só Playwright headless;
  - a app em Linux: o `cwdPolicy` compara caminhos sem distinguir maiúsculas só em `win32` (em Linux
    distingue — é o correto, mas testar); a pasta das conversas em `~/.claude/projects/` codifica o cwd de
    outra forma (`/home/x/app` → `-home-x-app`); `PATH`/`HOME` do serviço ([[../backend-conventions]] → Armadilhas);
  - os projetos a abrir lá correm em Linux — um projeto Visual Studio/.NET Framework não corre.
- Os atalhos `Alt+…` ([[0008-identidade-visual]]) não mudam — são do browser do dispositivo, não do desktop.
- **Passar para 16 GB** é a melhoria com mais impacto, qualquer que seja o SO; não muda esta decisão, só a
  folga.

## Estado

`aceite`
