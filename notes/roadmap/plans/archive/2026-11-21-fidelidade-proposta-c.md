# Plano — 2026-11-21 fidelidade-proposta-c

**Estado**: concluído (2026-11-21)
**Âmbito escolhido**: o que ficou por copiar da proposta C do canvas (ADR 0036), encontrado pelo dono a 2026-11-21
**Orçamento da sessão**: sem limite
**Modelo**: tudo `sonnet`, exceto a tarefa 4 (branches: rota nova no backend, reinicia a 7400)

> Referência: o canvas https://claude.ai/artifact/R3oG66QvDxj6TRqQu6wkNk, ficheiro `project/C-Workspaces.dc.html`
> (lê-se com o Artifact tool, `action: read`, `path`). É referência, não código.

## Esclarecimentos já obtidos (do dono)
- Entram as quatro coisas: (a) quota + Novo terminal + lista densa, (b) sessões gravadas, (c) branches, (d) barra
  de estado + "Abrir outra pasta…" no seletor.
- **Quota na barra de título**, à direita e antes do utilizador, compacta e em mono: `5h 42% ↻14:30 · sem 81% ↻seg`,
  com tooltip. Sai do fundo da lateral.
- O fundo da lateral passa a ter o botão **"+ Novo terminal"** (primário, largura toda).
- **Sessões gravadas**: as 5 mais recentes da pasta do projeto, com título e data relativa. Clicar = Retomar
  (`--resume`). "Ver todas…" abre o modal Retomar que já existe.
- **Branches**: só para ver, sem `↑n`. Lidos do `.git` sem correr o git, com o branch atual marcado. O clique não faz
  nada (mudar de branch com terminais abertos é perigoso).
- Lista de terminais densa, numa linha de 26 px (estado · nome · meta), em grupos recolhíveis (▸) TERMINAIS /
  BRANCHES / SESSÕES GRAVADAS, como no protótipo. Decidido por mim, a confirmar no browser: a tag da conta só aparece
  com mais de uma conta, e o estado em texto passa ao tooltip.

## Ordem confirmada
1. [x] `sonnet` Quota na barra de título + "Novo terminal" no fundo + lista de terminais densa em grupo recolhível
2. [x] `sonnet` Grupo SESSÕES GRAVADAS (frontend, `GET /api/sessions`)
3. [x] `sonnet` Barra de estado ("Teclado em <terminal>", dicas de atalhos a partir do catálogo) + "Abrir outra pasta…" no seletor
4. [x] `opus` Grupo BRANCHES: o backend lê `refs/heads` + `packed-refs` (como o `gitBranch.ts`, dentro das `ALLOWED_ROOTS`) e há uma rota nova. **Reinicia a 7400: combinar o momento com o dono**

## Próximo passo
Nada. As 4 tarefas estão feitas. Testes: backend 638/638; `sidebar-proposta-c` 33/33 (novo, 4× seguidas numa instância nova, depois de corrigir a corrida do "Novo terminal aqui"); `smoke` 6/6, `project-switcher` 31/31, `project-tasks` 41/41, `terminal-menu` 42/42, `accounts-terminals` 41/41, `accounts` 53/53, `usage-warning` 40/40, `pane-header` 19/19, `app-run-ui` 26/26, `settings` 21/21.
