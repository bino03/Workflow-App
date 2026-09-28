# Skill: Run

**When to use**: é preciso a app a correr — para testar uma alteração, verificar no browser, ou confirmar
que arranca. **Quem arranca é o Claude**, não o utilizador: esta skill diz exatamente como, para esta stack.

**Time**: ~1-2 min

> Os comandos abaixo são os de [[commands]] no momento em que esta skill foi gerada. **Se divergirem,
> `docs/commands.md` ganha** — correr o de lá e corrigir esta skill no mesmo passo.

---

## Step 0: Pré-requisitos

1. **Ficheiros de ambiente existem?** `backend/.env` e `frontend/.env`.
   Se falta algum, **não adivinhar valores** — ver [[environment]] e parar para o utilizador preencher.
2. **Serviços de que a app depende estão de pé?** nenhum serviço externo (sem BD no MVP, por agora). O binário `claude` tem de estar instalado e com sessão iniciada na conta da subscrição — `claude --version` responde, e `CLAUDE_BIN` no `backend/.env` aponta para ele.
   Se não estão, arrancá-los (se é local, ex.: `docker compose up -d`) ou parar e dizer qual falta.
3. **As portas estão livres?** `7400` (backend) e `7401` (frontend).
   ```bash
   netstat -ano | grep -E ":7400|:7401"
   ```
   Se já há algo a ouvir: é a app (nada a arrancar — saltar para o Step 3) ou outro processo (libertar)?
   Nunca arrancar uma segunda instância por cima.
   > ⚠️ **A porta do frontend importa**: o CORS só permite as origens configuradas. Se a porta estiver
   > ocupada e o dev server saltar para outra, as chamadas à API falham como se fosse auth.
4. **O arranque aplica migrações?** Se o backend aplica migrações sozinho ao arrancar (ex.: Flyway), e há
   migrações novas por aplicar, **confirmar com o utilizador antes** se a BD configurada não é local —
   um arranque é suficiente para mudar o schema da BD real.

## Step 1: Arrancar em background

```bash
# backend (Node + Fastify + node-pty) — porta 7400
cd backend && npm run dev          # se não há node_modules: npm install primeiro
```

```bash
# frontend (Vite) — porta 7401
cd frontend && npm run dev         # se não há node_modules: npm install primeiro
```

> ✅ Confirmados a 2026-09-28: o backend (`npm run dev` lê `backend/.env`) e o frontend (`npm run dev`
> → `VITE v7… ready in …`, proxy de `/api` e do upgrade do WebSocket para `127.0.0.1:7400`).
> Mudar `CORS_ALLOWED_ORIGINS` no `backend/.env` só vale depois de reiniciar o backend.

Cada processo em **background** (`run_in_background`), com o output num ficheiro que se possa ler — nunca a
bloquear a sessão.

## Step 2: Esperar pelos marcadores

Ler o log de cada processo até aparecer um marcador de sucesso **ou** de falha — com um `Monitor`/loop de
polling sobre o output, **nunca um `sleep` fixo às cegas**:

| Peça | Sucesso | Falha |
|---|---|---|
| backend | `Server listening at http://127.0.0.1:7400` | `EADDRINUSE` · `Error` · `Invalid environment` (config validada no arranque) · erro a carregar `node-pty` (`.node` / `NODE_MODULE_VERSION`) |
| frontend | `VITE … ready in` · `Local:` | `error` · `EADDRINUSE` |

## Step 3: Confirmar por fora

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:7400/api/health   # → 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:7401               # → 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:7401/api/health    # → 200 (proxy do Vite)
```

Só com todos a responder reportar que a app está a correr, com os URLs:

- Backend: http://127.0.0.1:7400/api/health
- Frontend: http://localhost:7401

## Se não arrancar

1. Ler as últimas ~50 linhas do log do processo que falhou — a primeira exceção/erro, não a última.
2. Procurar a causa em [[commands]] → "Armadilhas" e nas armadilhas das convenções da stack antes de
   experimentar ao acaso. Causas típicas: variável de ambiente em falta, serviço (BD) em baixo, porta
   ocupada, dependências por instalar, migração que falha.
3. Corrigir só o que é de ambiente (instalar dependências, libertar porta). **Se a causa é código ou
   configuração do projeto, parar e dizer** — não é trabalho desta skill.
4. Se custou tempo e não era da app → uma linha em `notes/learning.md`.

## Parar

Terminar as duas tarefas em background. **Ao parar o backend, todos os terminais (PTYs) abertos pela app morrem com ele** — se havia sessões do Claude Code a trabalhar, avisar o utilizador antes (retomam-se com `--resume`, mas o trabalho em curso é interrompido).

Parar só os processos que esta skill arrancou (pelos IDs das tarefas em background) — nunca matar
processos por nome às cegas.

## Final Checklist

- [ ] Ficheiros de ambiente confirmados (não criados a adivinhar)
- [ ] Serviços dependentes de pé; portas livres (ou a app já a correr)
- [ ] Migrações pendentes contra uma BD não-local confirmadas com o utilizador
- [ ] Processos em background, com log legível
- [ ] Log lido até um marcador — nunca um `sleep` cego
- [ ] Confirmação por fora (health check / pedido), não só o log
- [ ] URLs reportados
- [ ] Comandos iguais aos de `docs/commands.md` (ou esta skill corrigida)

## Related Skills

[[commands]] · [[environment]]
