---
tags: [adr]
status: aceite
data: 2026-10-27
---

# 0026 — Anexos a partir de outro dispositivo: o Explorador só na própria máquina, descarregar no resto

**Data**: 2026-10-27 · **Estado**: `aceite` · **Decidido com**: o dono — "futuramente esta aplicação vai estar a correr
noutra máquina e depois o front-end vai ser acedido através do meu portátil"

Altera o ponto 2 do [[0025-preparar-anexos-numa-pasta]] (quando se abre o Explorador) e o ponto 3 (o botão).

## Contexto

O [[0025-preparar-anexos-numa-pasta]] copia os prints para uma pasta **do servidor** e abre-a no Explorador **do
servidor**. Com o backend noutra máquina e a app aberta no portátil, a pasta e a janela ficam onde o dono não está — e
abrir janelas no ecrã de outra máquina é pior do que não abrir nada.

Saber "estou na própria máquina?" não se resolve pelo IP: atrás do `tailscale serve` ([[0018-pre-visualizacao-por-tailscale-serve]])
todos os pedidos chegam de `127.0.0.1`. O que distingue é o nome com que a página foi aberta.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **Fora da máquina, o botão passa a Descarregar todos; o Explorador só abre se o pedido vier de loopback e de uma página `localhost` (escolhida)** | Funciona em qualquer dispositivo, sem HTTPS nem APIs novas; a cópia no servidor continua (o registo) | Os ficheiros vão para os Downloads (o Chrome pede autorização para vários downloads na 1.ª vez) |
| Escrever numa pasta do portátil (File System Access API) | Uma pasta própria no portátil | Só Chrome/Edge e só em contexto seguro (HTTPS); não abre o Explorador — abre-se à mão na mesma |
| Zip descarregado | Um ficheiro | Descompactar antes de anexar |
| Decidir pelo IP do pedido | Simples | Errado atrás do `tailscale serve` (tudo é loopback) |

## Decisão

1. **Backend** (`common/localRequest.ts`): o Explorador abre só quando o pedido vem de loopback **e** o `Origin` é
   `localhost`, `127.0.0.1` ou `[::1]`. Sem `Origin` → não abre. A cópia para `applications/<id>/anexos/` faz-se
   sempre. Isto decide uma janela, **nunca** acesso.
2. **Frontend** (`AttachmentsCard`): pelo `location.hostname` — na própria máquina, **Preparar anexos** (como no
   0025); noutro dispositivo, **Descarregar todos**: prepara (o registo no servidor) e descarrega cada print
   disponível com o `uploadName`, um a um com 350 ms de intervalo. A faixa diz onde ficaram (Downloads deste
   computador) e não mostra caminhos do servidor.
3. **O portfólio tem de estar na máquina do backend** (`PORTFOLIO_PATH` no `.env` dela) — os prints servem-se de lá.

## Consequências

- Testado com um Chrome que abre a app como `wfa-remote.test` (`--host-resolver-rules`): o botão, os downloads com os
  nomes certos e a cópia no servidor (`scripts/verify/upwork-attachments.mjs`).
- Copiar legendas precisa de contexto seguro: pelo `tailscale serve` (HTTPS) funciona; por `http://<IP da rede>` o
  browser não dá a área de transferência (já era assim — `CopyButton`).

## Estado

`aceite` — 2026-10-27.
