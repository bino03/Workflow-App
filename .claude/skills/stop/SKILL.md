---
name: stop
description: Parar o Workflow App que o /run arrancou — na conversa que fez o /run, termina as tarefas em background pelos IDs e o que foi arrancado à parte (docker compose down); noutra conversa, encontra os processos que escutam nas portas do projeto, confirma pela linha de comando (e pelos pais) que pertencem à pasta do projeto, e só então os mata — nunca por nome às cegas; no fim confirma por fora que as portas fecharam. Usar quando é preciso parar, desligar ou matar a app, libertar as portas, ou quando a Workflow App escreve /stop no terminal do /run.
---

Then read `${CLAUDE_PROJECT_DIR}/docs/skills/process/skill-stop.md` in full and follow it step by step.

If asked to update this checklist, edit the vault file above, not this pointer.
