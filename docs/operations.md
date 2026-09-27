# 🛠️ Operações

> ❓ Em aberto até haver produção. O que decidir primeiro: **onde o backend vai correr** — destrava CORS,
> segredos, domínio e backups.

## O que é "produção"

Hoje: o portátil do dono, só em `127.0.0.1`. Plano: o **desktop de casa**, sempre ligado, com acesso
de outros dispositivos ([[adr/0004-exposicao-e-modelo-de-ameaca]]). Não há staging — "produção" é a
máquina onde o dono trabalha, e os terminais correm nela a sério.

## Deploy — o que muda quando deixar de correr localmente

- [ ] Forma de exposição decidida (ADR novo): VPN mesh · túnel com controlo de acesso · proxy com TLS
- [ ] SO do desktop de casa confirmado; `node-pty` instalado e testado lá; `claude` com login feito **pelo
      mesmo utilizador** que corre o backend
- [ ] O backend arranca sozinho (serviço/tarefa agendada) com o `PATH`/`HOME` certos ([[backend-conventions]] → Armadilhas)
- [ ] Clone do Workflow na máquina + `WORKFLOW_PATH`
- [ ] Domínio/origem do frontend → `CORS_ALLOWED_ORIGINS`
- [ ] Segredos de produção fora do git e fora da máquina de desenvolvimento
- [ ] `COOKIE_SECURE=true`; TLS
- [ ] 2FA decidido
- [ ] Checklist de [[../notes/roadmap/pre-deploy-security|pre-deploy-security]] fechada

## Cópia de segurança

| O quê | Como | Quando |
|---|---|---|
| Configuração (`backend/.env`) | fora do git, num cofre de passwords | ao mudar |
| Dados da app | ❓ depende do `/design-database` (talvez não haja) | — |

As conversas são do Claude Code (`~/.claude/`), não desta app — o backup delas é o da máquina.

## Repor

_(Passos testados, não teóricos — um restore que nunca foi feito não é um backup.)_

## Uma migração que correu mal

1. **Não editar a migração aplicada.**
2. Parar o backend (para não reaplicar nada).
3. Avaliar: corrigir com uma migração nova (preferível) ou repor o backup.
4. Registar o que aconteceu em `notes/learning.md` e, se mudou o procedimento, aqui.

## Relacionado

[[environment]] · [[security]] · [[commands]]
