# CLAUDE.md — backend

> Ponteiro. A documentação está no vault, na raiz do repo.

- Convenções e armadilhas (🚧 stack criada na hora): [[../docs/backend-conventions]]
- Rotas e protocolo do WebSocket: [[../docs/api]] · Segurança: [[../docs/security]] · ADR 0004
- Comandos: [[../docs/commands]] · Variáveis: [[../docs/environment]]

**Como trabalhar aqui**
- Nunca lançar um processo a partir de texto do cliente; só `CLAUDE_BIN` com argumentos fixos.
- Não desenvolver o backend a partir de um terminal servido por este mesmo backend em `npm run dev`
  (cada gravação reinicia o servidor e mata esse terminal).
- Endpoint novo → `docs/api.md` no mesmo commit.
