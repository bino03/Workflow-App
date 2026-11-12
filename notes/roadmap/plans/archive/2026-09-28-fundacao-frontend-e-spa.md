# Plano — 2026-09-28 fundacao-frontend-e-spa

**Estado**: concluído
**Âmbito escolhido**: temas "Fundação — Backend" e "Fundação — Frontend" do ToDo
**Orçamento da sessão**: sem limite

## Esclarecimentos já obtidos
- `Origin` do WS com a SPA servida pelo backend → quando serve a SPA, o backend junta automaticamente `http://localhost:PORT` e `http://127.0.0.1:PORT` às origens aceites (nunca confiar no `Host`)
- Quando servir `frontend/dist` → sempre que `index.html` existir (aviso no log se não), caminho configurável `FRONTEND_DIST`
- `VITE_API_URL` → vazio por omissão (base `/api` relativa); em dev o proxy do Vite trata HTTP e WS; a variável só para apontar a outro backend (desktop/remoto). Atualizar `.env.example` e `environment.md`
- antd → **antd 6 + React 19** (atualizar a stack no vault)
- Header/barra de estado → omitir o que não existe: sem quota, avatar com ícone, barra só com estado da ligação + versão
- Rotas → `/terminals` e `/library` como páginas vazias, `/` → `/terminals`
- Decidido sem perguntar (defaults): guard isenta tudo fora de `/api` (`/api/nope` continua 401); não-GET fora de `/api` → 404 JSON; `index.html` `no-cache`, `/assets` `immutable`; CSP fica para `pre-deploy-security`; 401 → `/login` só em `AUTH_002`; `FieldError` mostra a mensagem do Zod em PT (sem i18n); `xtermTheme` em `src/terminal/` (corrigir code-map); Tailwind 4 com ordem de `@layer` para não colidir com antd; `127.0.0.1:7401` no `.env.example` do backend; proxy aponta a `127.0.0.1:7400`; Vite 7 (Smart App Control)

## Ordem confirmada
1. [x] Scaffold `frontend/` (+ `.env`) — concluída
2. [x] Tokens Violeta + Geist — concluída (browser pendente; `TokenPreview.tsx` passa a rota `/_tokens` só em dev na tarefa 4)
3. [x] Infraestrutura (`api.ts`, `errors/`, `notificationService`) — concluída (browser pendente)
4. [x] App shell (Auth, Confirm, PrivateRoute, AppLayout, login, páginas vazias) — concluída (login real pendente, só o dono)
5. [x] Componentes comuns (`ListActions`, `SectionCard`, `FieldError`) — concluída
6. [x] `.env` + arranque confirmado com `run` — concluída
7. [x] Backend serve a SPA (`@fastify/static`, guard só `/api`, própria origem no WS) — concluída (ADR 0010)

## Próximo passo
Nada — plano concluído. Por verificar pelo dono: login com a password real (notes/verificacao-browser-pendente.md).
