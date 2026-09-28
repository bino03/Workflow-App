# ADR 0010 — O backend serve a SPA: uma só origem em produção

**Data**: 2026-09-28 · **Estado**: `aceite` · **Decidido com**: `/implement-todo` (fundação do frontend)

## Contexto

A arquitetura deixava em aberto como chega o frontend ao browser fora do dev ("em produção servido pelo
backend (❓ a confirmar)"). Em dev há duas origens — Vite na 7401 com proxy de `/api`, backend na 7400.
A intenção de uma **app desktop** futura ([[README]] → Forma final da UI) é uma janela que abre o URL
do backend: só é barata se o cookie `SameSite=Strict`, o `Origin` do WebSocket e o URL da API não
mudarem entre browser e janela. Ao mesmo tempo, a guarda de auth corria em **todos** os pedidos — até o
`index.html` e a própria página de login davam `401` sem sessão.

## Opções

| Opção | Prós | Contras |
|---|---|---|
| **O backend serve `frontend/dist` (escolhida)** | Uma origem: cookie, CORS e WebSocket sem configuração; um processo para arrancar; é o que a app desktop precisa | A guarda tem de distinguir a SPA da API; o backend passa a servir ficheiros |
| Servidor estático à parte (`vite preview`, nginx) | Separação limpa | Duas origens em produção → CORS com credenciais e `Origin` configurados à mão; mais um processo |
| Continuar só com o Vite em dev | Nada a fazer | Não é produção: sem build, HMR a correr sempre |

## Decisão

1. **Sempre que `FRONTEND_DIST/index.html` existe** (omissão `frontend/dist` do repo), o backend serve-o
   com `@fastify/static` (`wildcard: true` — um `npm run build` novo é servido sem reiniciar o backend).
   Sem build → só a API, com um aviso no arranque. Não depende de `NODE_ENV`.
2. **Tudo fora de `/api` é da SPA e público** — mas só para HTTP normal. **Um WebSocket exige sessão e
   `Origin` em qualquer caminho.** `/api` sem sessão continua a dar `401`, mesmo em rotas inexistentes.
3. **Fallback**: `GET`/`HEAD` fora de `/api` sem extensão no último segmento → `index.html`; um ficheiro
   em falta (`/assets/velho.js`) ou outro método → `404 COMMON_003`. `/assets/*` imutável (o Vite põe um
   hash no nome), `index.html` `no-cache`.
4. **Origem própria no WebSocket**: quando serve a SPA, o backend junta `http://localhost:<PORT>` e
   `http://127.0.0.1:<PORT>` às origens aceites no upgrade. **Nunca** se compara o `Origin` com o `Host`
   do pedido (forjável, e errado atrás de um proxy). O REST da mesma origem não depende de CORS.
5. **O frontend usa endereços relativos** (`VITE_API_URL` vazia por omissão) — em dev o proxy do Vite, em
   produção a mesma origem. A variável só serve para apontar a outro backend.

## Consequências

- Servir a app por outro nome (Tailscale, túnel, proxy com TLS) obriga a pôr essa origem no
  `CORS_ALLOWED_ORIGINS` — as origens automáticas são só `localhost`/`127.0.0.1` na `PORT`
  ([[0004-exposicao-e-modelo-de-ameaca]]; o checklist de `pre-deploy-security` continua a valer).
- Cabeçalhos de segurança do HTML (CSP, `X-Frame-Options`…) **não** entram aqui — ficam para o
  `pre-deploy-security`, antes de sair de `127.0.0.1`.
- A "instância estável" de [[../commands]] passa a ser `npm run build` no frontend + `npm run build && npm
  start` no backend, na 7400, sem Vite.
- Fecha o ❓ de [[../architecture]] e deixa a app desktop sem trabalho no backend.

## Relacionado

[[../security]] · [[../api]] → "Fora de `/api`" · [[../environment]] → `FRONTEND_DIST` ·
[[0003-auth-utilizador-unico]] · [[0004-exposicao-e-modelo-de-ameaca]]
