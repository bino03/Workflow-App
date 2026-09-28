---
tags: [adr]
status: aceite
data: 2026-09-28
---

# ADR 0011 — Nome de utilizador no login (`APP_USERNAME`)

**Data**: 2026-09-28 · **Estado**: `aceite` · **Decidido com**: `/implement-todo` (pedido do dono a meio da
Biblioteca)

Substitui **só o contrato de login** de [[0003-auth-utilizador-unico]] (`{password}` → `{username, password}`).
O resto do 0003 continua a valer: um utilizador, hash argon2id no `.env`, sessão de servidor em cookie
`HttpOnly`, rate limit por IP.

## Contexto

O dono pediu nome de utilizador no ecrã de login, com o valor `bino03`. Continua a haver **um** utilizador,
e o nome não distingue permissões. Serve de segundo fator de conhecimento, e o formulário passa a ter a forma
que os gestores de passwords do browser reconhecem (`username` + `current-password`).

## Opções

| Opção | Prós | Contras |
|---|---|---|
| **`APP_USERNAME` no `backend/.env` (escolhida)** | Muda-se sem tocar no código; validado no arranque como o resto da configuração | Mais uma variável obrigatória: quem atualiza o código tem de a acrescentar ao `.env` |
| Nome fixo no código | Nada a configurar | Mudá-lo obriga a mexer no código; um valor de configuração no código |
| Guardar o nome no `state.json` | Mudável pela UI no futuro | Mistura credenciais com estado de terminais; não há UI para isso |

## Decisão

- `APP_USERNAME` obrigatório: 1–64 caracteres de `[A-Za-z0-9._-]`. Validado pelo zod no arranque e fora do
  ambiente do processo `claude`, como o hash.
- `POST /api/auth/login {username, password}`. **Nome ou password errados → o mesmo `401 AUTH_001`**, para
  não dizer qual dos dois falhou.
- A comparação do nome é **em tempo constante** (SHA-256 dos dois + `timingSafeEqual`) e o argon2 corre
  **sempre**, mesmo com o nome errado. Assim o tempo de resposta não revela se o nome existe.
- O nome é sensível a maiúsculas (comparação exata, sem normalizar).
- O rate limit de 5/min por IP cobre as duas credenciais juntas.

## Consequências

- **Atualizar o código sem acrescentar `APP_USERNAME` ao `backend/.env` deixa o backend sem arrancar**
  (`Invalid environment` com o nome da variável).
- A mensagem do `AUTH_001` no frontend passa a falar dos dois campos.
- O 2FA continua em aberto (ver [[README]] → decisões por tomar), antes de expor na web.
