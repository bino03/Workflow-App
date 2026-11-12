# Plano — 2026-11-07 manutencao-icones-e-tmp

**Estado**: concluído
**Âmbito escolhido**: Manutenção — dois dos três itens. Os 2 do MVP dependem do dono e ficam de fora.
**Orçamento da sessão**: sem limite

## Esclarecimentos já obtidos
- MCP "failed" da Conta Secundária → adiado: movido para `notes/ideas.md` com o contexto (só se vê com `/mcp` numa sessão real dessa conta).
- "Worker exited unexpectedly" do backend → fica no ToDo, sem investigar agora; só se corrige a parte do `.tmp` do `guidedHook`.
- Ícones do projeto vazio → parar o clique **e** o Enter/Espaço (`keydown`) no próprio `IconButton` de `TerminalSidebar.tsx`, como no `AccountPicker` (`accounts/AccountPicker.tsx:28-32`).
- Filtro do `.tmp` → `pendingFiles` em `backend/test/guidedHook.test.ts:39` só aceita `pending-*.json`.

## Ordem confirmada
1. [x] Ícones do cabeçalho de um projeto vazio ativam o projeto — concluída (16/16 no Chrome headless)
2. [x] Testes intermitentes: `pendingFiles` apanha o `.tmp` (o "Worker exited" fica no ToDo) — concluída

## Próximo passo
Nenhum: plano concluído (2026-11-07). Falta o commit, que se propõe no fecho.
