# Plano — 2026-10-20 verificações pendentes

**Estado**: concluído
**Âmbito escolhido**: os 3 itens do ToDo (specs já com código feito), só a verificação manual no browser. Sem código novo.
**Orçamento da sessão**: n/a (só planear)

## Esclarecimentos já obtidos
- Menu → "Ver estado atual" (2026-10-20) → resumo sem alterações.
- Ordem proposta → "Confirmar" (2026-10-20).

## Ordem confirmada
0. [x] Pré-requisito: arrancar o frontend — desbloquear o Rollup nativo (`@rollup/rollup-win32-x64-msvc`) no Application Control do Windows. Não é item do ToDo; bloqueia os passos 1 e 2. — concluído (2026-10-21: a app já estava a correr, frontend 7401 e proxy /api a responder 200; o bloqueio não se repetiu)
1. [x] Separadores de projetos, passo 8 — checklist de `notes/verificacao-browser-pendente.md` → "spec `separadores-de-projetos`, passo 8" (dois projetos, troca de separadores sem misturar estado, esconder/reabrir, recarregar). Depois marcar o passo 8 `[x]` e o Estado da spec "✅ Concluída". — concluído (2026-10-21, CDP + instância de teste)
2. [x] Estilos de grelha, passo 5 — checklist de `notes/verificacao-browser-pendente.md` → "spec `estilos-de-grelha`, passo 5" (os 4 arranjos, lugares, persistência entre Biblioteca e F5). Depois marcar o passo 5 `[x]` e o Estado da spec "✅ Concluída". — concluído (2026-10-21, CDP + instância de teste; 57/57 com o passo 1)
3. [x] Upload de skills, passo 6 — um upload contra a biblioteca **real** do Workflow, stack `tauri` ou `rust-axum` (nunca `proven`), com `notes/skill-teste-upload.md`; limpar o que for escrito no fim. Passo a passo em `notes/verificacao-browser-pendente.md`. Precisa do dono. — concluído (2026-10-23, pela sessão com aprovação do dono — plano 2026-10-23-scripts-verify-e-upload-real)

## Próximo passo
Nada — plano concluído.

## Notas
- Os passos 1 e 2 precisam da password real e da extensão do Chrome (ou do fallback de Chrome headless já usado no upload). Ambos exigem a presença do dono.
- Cada verificação registada em `notes/whatIveDone.md` no fim, com o resultado; se não for possível fazer, fica como "não verificado no browser" em vez de dispensada.
