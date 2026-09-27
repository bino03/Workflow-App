# Skill: Frontend Integration Guide

**When to use**: acabaste uma feature de backend e é preciso documentar como ligá-la ao frontend.

**Output**: um `.md` guardado em `frontend/docs/integration/<feature>-integration.md`

**Time**: ~15 min

> 📐 Lê [[frontend-visual-consistency]] para os templates de código usarem os tokens e padrões reais.

---

## Step 1: A pergunta inicial

"É a feature que acabámos de fazer neste chat, ou uma que já existe?"
- **Deste chat** → extrair endpoints, DTOs, auth e códigos de erro da conversa; confirmar se preciso.
- **Existente** → pedir: nome, endpoints, DTOs (campos e tipos), códigos de erro, quem pode o quê.

## Step 2: As 5 perguntas (em bloco)

1. **Onde vive?** Secção do menu, página existente ou nova. Segmentos novos em inglês.
2. **Que UI?** Lista paginada, drawer de criar/editar, pesquisa/filtros, detalhe, ações em lote.
3. **Campos especiais?** Selects com opções, datas, uploads, validações próprias. **Visibilidade por role.**
4. **Workflow?** Depois de criar: fica ou volta à lista? Editar em drawer? Soft/hard delete? Confirmação?
5. **Integrações?** Liga a outras entidades? Depende de outra feature? Import/export?

## Step 3: Gerar o documento

```
1. Overview               — o que se acrescenta
2. API Contract           — endpoints, DTOs, auth, códigos de erro
3. Component Architecture — serviços, componentes, páginas
4. File Structure         — onde criar cada ficheiro
5. Implementation Steps   — checklist exata
6. Code Templates         — tipos, serviço, schema, componentes (com os tokens reais)
7. Integration Points     — rota em main.tsx, item no AppLayout
8. Error Handling         — códigos a acrescentar a errorMessages.ts
9. Testing Checklist      — o que verificar no browser (incl. permissões pela API)
```

## Step 4: Guardar e avisar

`frontend/docs/integration/<feature-kebab>-integration.md`. Dizer o caminho.

## ⚠️ O guia é descartável

É um **handoff, não documentação**. Quando o frontend da feature fecha, o que era verdade está no
código e em `docs/api.md`, e as decisões no work log. Quem fecha a feature (`implement-todo`, Fase 6)
faz `git rm` do guia no mesmo commit. Deixado lá, desatualiza-se — três guias ficaram duas semanas a
descrever DTOs que já tinham mudado. Se um guia ainda existe, ou a feature está aberta ou alguém se
esqueceu.

## Final Checklist

- [ ] Origem da feature confirmada (chat vs. existente)
- [ ] As 5 perguntas respondidas, incluindo visibilidade por role
- [ ] As 9 secções geradas, com templates que usam os tokens reais
- [ ] Guardado na pasta de integração; caminho dito ao utilizador

## Related Skills

`add-backend-feature` (não incluída — backend 📋 sem skills) · [[skill-frontend-design-system]] · [[frontend-visual-consistency]] · [[skill-implement-todo]]
