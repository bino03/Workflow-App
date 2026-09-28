---
tags: [adr]
status: aceite
data: 2026-09-27
---

# 0003 — Login próprio de um só utilizador, sessão em cookie HttpOnly

> ⚠️ **Contrato de login substituído por [[0011-nome-de-utilizador-no-login]]** (`{username, password}`). O resto continua em vigor.

## Contexto

Na entrevista: "não precisa de roles visto que vou ser o unico a usar, mas claro que vai precisar de
login tendo em conta que no futuro vou dar deploy na web". Há **um** utilizador, e o login serve para
impedir toda a gente, não para distinguir permissões. Não há base de dados obrigatória.

O padrão de auth do Workflow (`auth-jwt-httponly-cookies`) assume um provedor de identidade externo
(Supabase Auth) a emitir JWTs. Aqui isso seria um projeto Supabase inteiro para uma password.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| Supabase Auth via backend (padrão do Workflow) | Provado nos outros projetos; recuperação de password, 2FA | Uma plataforma externa para um utilizador; a app deixa de funcionar offline/em casa sem internet |
| **Password única (hash no `.env`) + sessão de servidor em cookie HttpOnly (escolhida)** | Nada externo; simples de auditar; o token nunca toca no JavaScript | Sem recuperação de password (muda-se o hash no `.env`); sessões perdem-se ao reiniciar |
| Sem login, só `127.0.0.1` | Zero trabalho | Deixa de servir no dia em que for exposta — que é o plano |
| Autenticação só na camada de rede (VPN/túnel com login) | Forte | Um erro de configuração de rede deixa a app aberta; defesa em profundidade pede as duas |

## Decisão

- `APP_PASSWORD_HASH` (argon2id) no `backend/.env`, gerado por `npm run hash-password`.
- `POST /api/auth/login {password}` → comparação em tempo constante, **rate limit** por IP → cookie de
  sessão com id opaco assinado (`SESSION_SECRET`), `HttpOnly`, `SameSite=Strict`, `Secure` fora de
  `localhost`. Sessões em memória do backend.
- Uma guarda única valida a sessão nas rotas REST **e no upgrade do WebSocket** (onde também verifica o
  `Origin`).
- Mantém-se a ideia central do padrão do Workflow: o frontend não guarda credenciais nem tokens.

## Consequências

- Reiniciar o backend obriga a entrar outra vez (e mata os terminais de qualquer forma).
- Esquecer a password = gerar outro hash. Aceitável para um utilizador.
- **2FA (TOTP)** fica como decisão em aberto, a tomar **antes** de expor na web.
- Se algum dia houver mais utilizadores, esta decisão cai (e a do motor também — [[0002-motor-via-pty-sobre-subscricao]]).

## Estado

`aceite` — decidido por omissão pelo `/create` ("podes fazer tudo"); rever se não servir.
