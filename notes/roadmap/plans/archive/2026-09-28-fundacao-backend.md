# Plano — 2026-09-28 fundacao-backend

**Estado**: concluído
**Âmbito escolhido**: Só um tema — Fundação › Backend (`node-fastify`), os 6 bullets
**Orçamento da sessão**: sem limite

## Esclarecimentos já obtidos
- ErrorCodes iniciais → `COMMON_001` validação 400, `COMMON_002` interno 500, `COMMON_003` rota inexistente 404, `AUTH_001` password errada 401, `AUTH_002` sem sessão 401, `AUTH_003` Origin recusado 403, `AUTH_004` demasiadas tentativas 429. 404 e JSON inválido passam pelo mesmo handler.
- TTL da sessão → inatividade 12 h + limite absoluto 7 dias, configuráveis por env; cookie com Max-Age.
- Rate limit do login → 5/min por IP, só na rota de login (`global: false`); 429 `AUTH_004`.
- Env do `claude` filho → denylist por prefixo: retirar `ANTHROPIC_*`, `CLAUDECODE`, `CLAUDE_CODE_*` e `CLAUDE_PID`. Atualizar a regra 8 e as Armadilhas em `docs/backend-conventions.md` para bater certo.
- zod → 4.x, atualizar os docs que dizem 3.x.
- Spike do PTY → direto no código real (`spawnClaude.ts`, `terminalManager.ts` mínimo, `protocol.ts`) + script manual que os exercita.
- `/status` → o script escreve `/status` pelo PTY e lê o output; o utilizador só confirma se ficar ambíguo.
- `/design-database` → no fim, depois do código.
- (decidido sem perguntar) Node 24 fixado em `engines` + `.nvmrc`; cookie `session` assinado com `@fastify/cookie` + `Map` em memória (ADR 0003).

## Ordem confirmada
1. [x] Scaffold `backend/` + confirmar node-pty no Windows — concluída
2. [x] Base comum (config, errors, health, bind, shutdown) — concluída
3. [x] Spike do PTY (código real) + protocolo WS em `docs/api.md` — concluída
4. [x] Auth de um utilizador — concluída
5. [x] `.env` + arranque com a skill `run` — concluída
6. [x] `/design-database` — concluída

## Próximo passo
Nenhum — plano concluído a 2026-09-28. A seguir no backlog: Fundação — Frontend, e "Modelo de dados" → `StateStore`.
