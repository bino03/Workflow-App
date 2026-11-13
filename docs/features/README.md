# 🧩 Specs de features

Specs de features que levam mais do que uma sessão. **Versionadas** — uma spec que orienta semanas de
trabalho é documentação de projeto, não nota pessoal.

```
/plan-feature   →  entrevista  →  docs/features/<slug>.md  +  um bullet por fase no ToDo
/implement-todo →  os bullets das fases, como quaisquer outros (o progresso fica no plano)
```

## Quando merece spec

| Dimensão | O que fazer |
|---|---|
| Uma sessão, um ou dois ficheiros | Item no ToDo, sem spec |
| Várias sessões, atravessa camadas | Spec |

## O que faz uma spec sobreviver à perda de contexto

1. **Escrita para quem nunca viu a conversa.**
2. **Sem estado dentro da spec** — o progresso é do plano do `/implement-todo` (checkpoints antes e depois
   de cada tarefa); uma segunda cópia do progresso diverge da primeira.
3. **Fases que entram em uso sozinhas, com ficheiros concretos e critério de aceitação.**
4. **A lista do que fica de fora.**

## Ficheiros

- `_TEMPLATE.md` — copiar, não editar
