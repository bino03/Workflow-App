# 🔒 Pré-deploy — segurança e robustez

Checklist verificável antes de produção, por níveis. Cada item com **como testar**. Origem: as regras de
[[security-baseline]].

## CRÍTICO

- [ ] **Segredos de produção fora do git** e da máquina de desenvolvimento — histórico do git confirmado sem `.env`
- [ ] **CORS** com as origens reais de produção (nunca `*` com credenciais) — testar com `curl -i -H "Origin: https://outro.site"`
- [ ] **Rate limiting** no login e na recuperação de password (por conta e por IP) — N tentativas → 429
  (2026-09-28: login já com 5/min por IP → `429 AUTH_004`; não há recuperação de password. Rever os
  números — e se atrás de um proxy/túnel o IP visto é o do proxy (`trustProxy`) — antes de expor)
- [ ] **Recuperação de password não revela contas** — mesma resposta com e sem conta
- [ ] **Cookies**: `Secure`, `HttpOnly`, `SameSite`; logout apaga com os mesmos atributos
- [ ] **Passkeys**: `WEBAUTHN_RP_ID` = o domínio final (nunca mudar depois) e `WEBAUTHN_ORIGINS` = a origem HTTPS; registar de novo as passkeys feitas em `localhost` ([[../../docs/adr/0015-passkeys-webauthn|ADR 0015]])
- [ ] **Bloquear/eliminar conta corta sessões abertas** — sessão aberta → bloquear → próximo pedido 401

## IMPORTANTE

- [ ] **Sem N+1** nas listas e árvores grandes (contar queries no log)
- [ ] **Índices** para as queries das listas principais
- [ ] **CSP** e headers de segurança no frontend
- [ ] **Logs sem segredos** (nenhum filtro de debug a logar `Cookie`/`Authorization`); nível `INFO`/`WARN`
- [ ] **Rate limiting** em exportações pesadas (por utilizador)

## DESEJÁVEL

- [ ] Backups automáticos da BD e do storage, com um restore testado
- [ ] Monitorização/alertas mínimos (health check externo)
- [ ] Teste de carga das operações pesadas num ambiente que não é produção
