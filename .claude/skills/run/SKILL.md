---
name: run
description: Correr o Workflow App localmente — o próprio LLM arranca backend (Node + Fastify + node-pty) + frontend (Vite) em background depois de verificar os pré-requisitos (ficheiros .env, serviços como a base de dados, portas livres, migrações pendentes), espera pelos marcadores nos logs (nunca um sleep às cegas), confirma com health checks, reporta os URLs, e sabe como parar e como diagnosticar um arranque falhado. Usar sempre que a app tem de estar a correr para testar uma alteração, verificar no browser, ou confirmar que arranca.
---

Then read `${CLAUDE_PROJECT_DIR}/docs/skills/process/skill-run.md` in full and follow it step by step.

If asked to update this checklist, edit the vault file above, not this pointer.
