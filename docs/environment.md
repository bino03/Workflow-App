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
| `APP_PASSWORD_HASH` | ✅ | `$argon2id$…` | Gerado por `npm run hash-password`. Tem de começar por `$argon2id$`. Nunca a password em claro |
| `SESSION_SECRET` | ✅ | 64+ caracteres aleatórios | Assina o cookie de sessão. Menos de 64 caracteres → não arranca |
| `SESSION_IDLE_HOURS` | — | `12` | A sessão expira ao fim de N horas sem pedidos |
| `SESSION_MAX_DAYS` | — | `7` | Limite absoluto da sessão, com ou sem atividade |
| `COOKIE_SECURE` | — | `false` em dev | Só `true`/`false`. `true` sempre que não for `localhost` |
| `CORS_ALLOWED_ORIGINS` | ✅ | `http://localhost:7401` | URLs separados por `,`. Também é a lista de `Origin` aceites no upgrade do WebSocket |
| `CLAUDE_BIN` | — | `claude` ou caminho completo | No Windows confirmar se é `claude.exe` (instalador nativo) ou `claude.cmd` (npm) — um `.cmd` não se lança diretamente num PTY |
| `ALLOWED_ROOTS` | ✅ | `C:\Users\jlalv\Desktop\utad\projetos;C:\Users\jlalv\Desktop\Workflow` | Pastas (separadas por `;`) onde se podem abrir terminais. Cada uma tem de ser absoluta e existir; guarda-se o `realpath` |
| `DEFAULT_CWD` | — | a primeira de `ALLOWED_ROOTS` | |
| `WORKFLOW_PATH` | ✅ | `C:\Users\jlalv\Desktop\Workflow\Workflow` | Raiz do Workflow — a biblioteca lê `library/` daqui. Absoluta e tem de existir |
| `CLAUDE_CONFIG_DIR` | — | `~/.claude` | Onde procurar as sessões gravadas |
| `MAX_TERMINALS` | — | `8` | A quota é da conta: mais terminais não dão mais quota |
| `SCROLLBACK_BYTES` | — | `1048576` | Buffer de output guardado por terminal para reenviar ao voltar a ligar |

**O que o processo `claude` recebe**: o ambiente do backend **sem** `ANTHROPIC_*`, `CLAUDE_CODE_*`,
`CLAUDECODE`, `CLAUDE_PID` e sem as variáveis desta tabela (exceto `CLAUDE_CONFIG_DIR`) — ver
[[backend-conventions]] → regra 8 e Armadilhas. Nenhuma variável desta
app é uma chave da Anthropic, e nunca deve ser.

## Frontend — `frontend/.env`

`.env` em `frontend/` (git-ignored); template em `.env.example`.

```
VITE_API_URL=http://localhost:7400
```

| Variável | Obrigatória | Nota |
|---|---|---|
| `VITE_API_URL` | ✅ | Base da instância Axios e do WebSocket (`ws://` derivado) |

**Não há segredos no frontend**, de propósito: a SPA fala só com o backend, e a sessão viaja num cookie
HttpOnly. Tudo o que começa por `VITE_` fica visível no bundle.

## Relacionado

[[commands]] · [[security]]
