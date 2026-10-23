---
tags: [adr]
status: aceite
data: 2026-10-23
---

# 0018 — Pré-visualização de apps em dev por `tailscale serve`

**Data**: 2026-10-23 · **Estado**: `aceite` (o comportamento do CLI do Tailscale — permissões, persistência do
`serve --bg`, certificados — fica por confirmar no spike, passo 1 da spec) · **Decidido com**: `/refine-idea` +
`/plan-feature` (spec [[../features/pre-visualizacao]])

Complementa o [[0004-exposicao-e-modelo-de-ameaca]] (abre a regra 4, "só o `CLAUDE_BIN`", a um segundo binário
com argumentos fixos) e o [[0017-bot-telegram-e-remote-control]] (o bot passa a enviar um link por iniciativa
própria). Não substitui nenhum. **Não** decide "Como expor fora de casa" ([[README]]): a Workflow App continua
em `127.0.0.1`.

## Contexto

O dono desenvolve um projeto num terminal da app (o `claude` corre `npm run dev`, um Vite, etc.) e quer **ver
a UI desse projeto no PC onde está**, noutra rede, sem push/pull — e só ele. `docs/operations.md` → "Ver uma
app em desenvolvimento a partir de outro dispositivo" já tinha escolhido a forma em 2026-09-28
(`tailscale serve` → `https://<desktop>.<tailnet>.ts.net:<porta>`, privado, a app não faz de proxy), mas à mão.
Falta a app fazê-lo a pedido e entregar o link (na app e pelo bot de Telegram).

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **`tailscale serve` (tailnet) lançado pelo backend a pedido (escolhida)** | Só os dispositivos da conta Tailscale do dono chegam ao link; HTTPS com certificado real; nenhuma porta aberta no router; o dev server continua em `localhost`; uma linha por app | Tailscale instalado em cada dispositivo do dono; um binário novo lançado pelo backend; o `serve --bg` persiste no daemon e tem de ser limpo |
| Cloudflare Tunnel + Access (email OTP) | Abre em qualquer computador, sem instalar nada | Precisa de um domínio na Cloudflare; o link é público até ao login do Access; mais peças (cloudflared, política) — o dono só usa PCs seus |
| `tailscale funnel` | Sem instalar no dispositivo | **Público na internet** — uma app em dev (Vite, endpoints de debug, BD de dev) não é para a internet (0004) |
| A Workflow App como proxy (`/preview/<projeto>`) | Um só URL | HMR do Vite por WebSocket, caminhos base e cookies da app em teste; e obrigava a expor a própria Workflow App — posto de parte em `operations.md` |

## Decisão

1. **Binário novo, fechado**: `TAILSCALE_BIN` (vazia = sem pré-visualização, como o `TELEGRAM_BOT_TOKEN`).
   Lançado com `execFile`, nunca shell, e **só** estas formas de argumentos, montadas pelo backend:
   `serve --bg --https=<P> http://127.0.0.1:<D>`, `serve --https=<P> off`, `serve status --json`,
   `status --json`. Nunca `funnel`, nunca `serve reset`, nunca `up`/`set`/`login`.
2. **O cliente só manda o `terminalId`** (e, havendo várias, uma das portas que o backend lhe ofereceu). `<D>`
   é descoberta pelo backend: uma porta TCP em escuta num processo **descendente** do PID do terminal, lida
   do sistema operativo (nunca do ecrã do PTY — 0004 regra 6); a própria `PORT` do backend e `9229`
   (inspector) excluídas. `<P>` sai de uma gama configurada (`PREVIEW_HTTPS_PORTS`), atribuída pelo backend.
3. **Só o que o backend ligou é desligado**: um registo em memória `terminalId → {D, P, url}`. No arranque e
   no fecho do backend, desliga as portas **da gama** que o `serve status --json` mostre — nunca um `serve`
   noutra porta (o dono pode ter os seus).
4. **Ciclo de vida**: desliga quando o terminal sai, fecha ou é reaberto, quando a porta `<D>` deixa de
   escutar (verificação periódica), ou à mão. Não sobrevive a um reinício do backend (é estado em memória,
   como o PTY — [[0009-estado-em-ficheiro-json]]).
5. **O bot pode enviar por iniciativa própria** o link (e o aviso de que desligou) para o
   `TELEGRAM_ALLOWED_USER_ID`. Um URL não é conteúdo do terminal: a regra 5 do 0017 mantém-se.
6. **Windows e Linux**: a descoberta de descendentes e portas tem uma implementação por plataforma.

## Consequências

- Quem chega à tailnet do dono chega às apps em dev pré-visualizadas — é o perímetro aceite (o mesmo que o
  dono já usaria à mão). Partilhar um dispositivo da tailnet com outra pessoa alarga-o.
- No Linux o utilizador do backend tem de ser *operator* do `tailscaled` uma vez
  (`sudo tailscale set --operator=$USER`); o backend nunca usa `sudo`. HTTPS e MagicDNS ligados na consola
  da tailnet. Vai para a checklist de `docs/operations.md`.
- A app em teste tem de usar **uma só origem** (`/api` relativo + proxy do Vite) e aceitar o host `.ts.net`
  (`server.allowedHosts`); a app não o corrige — só o lembra no aviso do link.
- **Quando se decidir expor a própria Workflow App** pelo mesmo `<host>.ts.net`, o cookie de sessão seria do
  mesmo *site* que as apps em dev (os cookies ignoram a porta). Esse ADR futuro tem de o tratar (outro host,
  ou `__Host-` + origem exata). Este ADR não o resolve porque não expõe a app.
- `TAILSCALE_*`/`PREVIEW_*` entram na denylist do ambiente do `claude` e em `docs/security.md` (o que o
  backend pode lançar).
