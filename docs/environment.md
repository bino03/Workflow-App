# 🔐 Variáveis de ambiente

Nenhum destes ficheiros está no git. Num clone novo, criá-los a partir dos `.env.example`.

## Backend — `backend/.env`

> 🚧 Proposta da stack `node-fastify` — validada com zod em `src/config.ts`; o backend **não arranca**
> se faltar uma obrigatória.

| Variável | Obrigatória | Exemplo | Nota |
|---|---|---|---|
| `HOST` | — | `127.0.0.1` | **Omissão `127.0.0.1`.** Mudar para `0.0.0.0` só com [[adr/0004-exposicao-e-modelo-de-ameaca]] cumprido |
| `PORT` | — | `7400` | Fora das portas dos outros projetos (8080/5173/3000) |
| `APP_PASSWORD_HASH` | ✅ | `$argon2id$…` | Gerado por `npm run hash-password`. Nunca a password em claro |
| `SESSION_SECRET` | ✅ | 64+ caracteres aleatórios | Assina o cookie de sessão |
| `COOKIE_SECURE` | — | `false` em dev | `true` sempre que não for `localhost` |
| `CORS_ALLOWED_ORIGINS` | ✅ | `http://localhost:7401` | Também é a lista de `Origin` aceites no upgrade do WebSocket |
| `CLAUDE_BIN` | — | `claude` ou caminho completo | No Windows confirmar se é `claude.exe` (instalador nativo) ou `claude.cmd` (npm) — um `.cmd` não se lança diretamente num PTY |
| `ALLOWED_ROOTS` | ✅ | `C:\Users\jlalv\Desktop\utad\projetos;C:\Users\jlalv\Desktop\Workflow` | Pastas (separadas por `;`) onde se podem abrir terminais |
| `DEFAULT_CWD` | — | a primeira de `ALLOWED_ROOTS` | |
| `WORKFLOW_PATH` | ✅ | `C:\Users\jlalv\Desktop\Workflow\Workflow` | Raiz do Workflow — a biblioteca lê `library/` daqui |
| `CLAUDE_CONFIG_DIR` | — | `~/.claude` | Onde procurar as sessões gravadas |
| `MAX_TERMINALS` | — | `8` | A quota é da conta: mais terminais não dão mais quota |
| `SCROLLBACK_BYTES` | — | `1048576` | Buffer de output guardado por terminal para reenviar ao voltar a ligar |

**O que o processo `claude` recebe**: o ambiente do backend **sem** `ANTHROPIC_API_KEY`,
`ANTHROPIC_AUTH_TOKEN` e `CLAUDECODE` — ver [[backend-conventions]] → Armadilhas. Nenhuma variável desta
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
