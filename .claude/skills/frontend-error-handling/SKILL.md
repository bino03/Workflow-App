---
name: frontend-error-handling
description: Tratamento de erros centralizado no Workflow App — espelhar 1:1 os ErrorCodes do backend em errorMessages.ts, ErrorHandler.handle em cada catch, erros por campo, quem notifica entre o handler e o interceptor. Usar em qualquer componente que chama a API ou quando aparece um código de erro novo no backend.
---

Before writing code, read `${CLAUDE_PROJECT_DIR}/docs/skills/references/code-best-practices.md`, `${CLAUDE_PROJECT_DIR}/docs/skills/references/error-model.md`. Then read `${CLAUDE_PROJECT_DIR}/docs/skills/frontend/skill-frontend-error-handling.md` in full and follow it step by step.

If asked to update this checklist, edit the vault file above, not this pointer.
