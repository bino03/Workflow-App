# 🔐 Variáveis de ambiente

Nenhum destes ficheiros está no git. Num clone novo, criá-los a partir dos `.env.example`.

## Backend — `backend/.env`

> ✅ Validada com zod em `backend/src/config.ts`; o backend **não arranca** (`Invalid environment:` +
> a lista de variáveis e porquê, nunca os valores) se faltar uma obrigatória ou uma regra falhar.
> Carregada de `backend/.env` com `process.loadEnvFile` quando o ficheiro existe; o ambiente do processo
> vale por cima.

| Variável | Obrigatória | Exemplo | Nota |
|---|---|---|---|
| `HOST` | — | `127.0.0.1` | **Omissão `127.0.0.1`.** Mudar para `0.0.0.0` só com [[adr/0004-exposicao-e-modelo-de-ameaca]] cumprido |
| `PORT` | — | `7400` | Fora das portas dos outros projetos (8080/5173/3000) |
| `LOG_LEVEL` | — | `info` | `fatal`/`error`/`warn`/`info`/`debug`/`trace` |
| `APP_USERNAME` | ✅ | `bino03` | O nome de utilizador do login ([[adr/0011-nome-de-utilizador-no-login]]). 1–64 de `[A-Za-z0-9._-]`, sensível a maiúsculas. Nunca chega ao processo `claude` |
| `APP_PASSWORD_HASH` | ✅ | `$argon2id$…` | Gerado por `npm run hash-password`. Tem de começar por `$argon2id$`. Nunca a password em claro |
| `SESSION_SECRET` | ✅ | 64+ caracteres aleatórios | Assina o cookie de sessão. Menos de 64 caracteres → não arranca |
| `SESSION_IDLE_HOURS` | — | `12` | A sessão expira ao fim de N horas sem pedidos |
| `SESSION_MAX_DAYS` | — | `7` | Limite absoluto da sessão, com ou sem atividade |
| `COOKIE_SECURE` | — | `false` em dev | Só `true`/`false`. `true` sempre que não for `localhost` |
| `CORS_ALLOWED_ORIGINS` | ✅ | `http://localhost:7401,http://127.0.0.1:7401` | URLs separados por `,`. Também é a lista de `Origin` aceites no upgrade do WebSocket. As duas formas do dev server porque `localhost` e `127.0.0.1` são origens diferentes para o browser |
| `CLAUDE_BIN` | — | `claude` ou caminho completo | No Windows confirmar se é `claude.exe` (instalador nativo) ou `claude.cmd` (npm) — um `.cmd` não se lança diretamente num PTY |
| `ALLOWED_ROOTS` | ✅ | `C:\Users\jlalv\Desktop\utad\projetos;C:\Users\jlalv\Desktop\Workflow` | Pastas (separadas por `;`) onde se podem abrir terminais. Cada uma tem de ser absoluta e existir; guarda-se o `realpath` |
| `DEFAULT_CWD` | — | a primeira de `ALLOWED_ROOTS` | |
| `WORKFLOW_PATH` | ✅ | `C:\Users\jlalv\Desktop\Workflow\Workflow` | Raiz do Workflow — a biblioteca lê `library/` daqui. Absoluta e tem de existir |
| `CLAUDE_CONFIG_DIR` | — | `~/.claude` | Onde procurar as sessões gravadas |
| `MAX_TERMINALS` | — | `8` | A quota é da conta: mais terminais não dão mais quota |
| `SCROLLBACK_BYTES` | — | `1048576` | Buffer de output guardado por terminal para reenviar ao voltar a ligar |
| `DATA_DIR` | — | `C:\Users\jlalv\.workflow-app` | Onde vive o `state.json` ([[database]], [[adr/0009-estado-em-ficheiro-json]]). **Omissão `~/.workflow-app`** — fora do repo, para nunca ser commitado. Absoluto; criada no arranque se não existir. `state.json` inválido → o backend não arranca (e nunca o sobrescreve) |
| `FRONTEND_DIST` | — | `C:\…\frontend\dist` | Build do frontend que o backend serve. **Omissão: `frontend/dist` do repo.** Absoluto. Sem `index.html` lá dentro → só a API (aviso no arranque). Quando serve, a própria origem (`localhost`/`127.0.0.1` na `PORT`) passa a ser aceite no WebSocket ([[security]] → CORS) |

**O que o processo `claude` recebe**: o ambiente do backend **sem** `ANTHROPIC_*`, `CLAUDE_CODE_*`,
`CLAUDECODE`, `CLAUDE_PID` e sem as variáveis desta tabela (exceto `CLAUDE_CONFIG_DIR`) — ver
[[backend-conventions]] → regra 8 e Armadilhas. Nenhuma variável desta
app é uma chave da Anthropic, e nunca deve ser.

## Frontend — `frontend/.env`

`.env` em `frontend/` (git-ignored); template em `.env.example`.

```
VITE_API_URL=
```

| Variável | Obrigatória | Nota |
|---|---|---|
| `VITE_API_URL` | — | Base da instância Axios e do WebSocket (`ws(s)://` derivado). **Vazia por omissão** → relativa à origem da página: em dev o proxy do Vite leva `/api` (HTTP e WebSocket) até `127.0.0.1:7400`; em produção a SPA é servida pelo próprio backend. Só se preenche para apontar a outro backend (app desktop, backend remoto) — e então a origem da página tem de estar no `CORS_ALLOWED_ORIGINS` |

**Não há segredos no frontend**, de propósito: a SPA fala só com o backend, e a sessão viaja num cookie
HttpOnly. Tudo o que começa por `VITE_` fica visível no bundle.

## Relacionado

[[commands]] · [[security]]
