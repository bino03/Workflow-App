# ADR 0009 — Estado persistido num ficheiro JSON, sem base de dados

**Data**: 2026-09-28 · **Estado**: `aceite` · **Decidido com**: `/design-database`

## Contexto

A entrevista de criação deixou os dados em aberto (A6: "decido mais tarde"). No `/design-database` o dono
disse o que tem de sobreviver a um reinício do backend: **os terminais abertos** (para os reabrir), **as
etiquetas** deles, **as pastas recentes/favoritas**, e — ao fechar um terminal — **um histórico com
quando e um resumo curto do que foi feito**. O resto fica onde já está: o scrollback em memória, o modo
de layout no browser, as conversas no `~/.claude/projects/` do Claude Code.

São três coleções pequenas (dezenas de registos, histórico até 200), um só utilizador, **um só processo a
escrever**, e nenhuma pesquisa.

## Opções

| Opção | Prós | Contras |
|---|---|---|
| **Ficheiro JSON (escolhida)** | Zero dependências; legível e editável à mão; validado com zod ao ler; escrita atómica (tmp + rename) | Reescreve o ficheiro inteiro a cada mudança; evoluir o schema é código à mão (`migrate`); sem queries |
| SQLite (`node:sqlite`) | Queries, índices, migrações; escreve só o que muda | Maquinaria a mais para 3 coleções; `ExperimentalWarning` no Node 24; não se lê à mão |
| Postgres / serviço | — | Um serviço para correr por nada |

## Decisão

1. **`DATA_DIR/state.json`** (omissão `~/.workflow-app/`, fora do repositório), com `version`, validado com
   zod no arranque. Inválido → o backend não arranca (nunca o substitui por um estado vazio).
2. **Uma fila de escrita** no backend (as escritas nunca se cruzam) e escrita atómica com **retry no
   `rename`** — no Windows o `rename` por cima de um ficheiro aberto por outro processo (antivírus,
   indexador) falha com `EPERM`/`EBUSY`. `write-file-atomic` é aceitável em vez de código próprio.
3. **Terminais com `claudeSessionId` desde o início**: o backend gera o uuid e lança `claude --session-id
   <uuid>`, para poder reabrir com `--resume <uuid>` depois de um reinício. Ao reiniciar, os terminais
   aparecem **parados**; reabrir é sempre um pedido do utilizador.
4. **O resumo do histórico vem do `.jsonl` da sessão, copiado no momento de fechar**: o `ai-title` que o
   Claude Code gera, ou a última mensagem do assistente cortada (`summarySource`). Copiado e não lido
   depois porque o Claude Code apaga as transcrições ao fim de 30 dias.
5. **Nunca se escreve um prompt no PTY para obter um resumo.** Foi proposto e recusado pelo dono: suja a
   conversa gravada, pode interferir com uma tarefa ou um pedido de permissão a meio, e torna o fecho
   lento e frágil. Um resumo feito pelo Claude fica para depois, como botão explícito **Resumir** com o
   terminal vivo. (`claude -p` e a API continuam fora — [[0002-motor-via-pty-sobre-subscricao]].)
6. Limites: histórico com os 200 mais recentes; 10 pastas recentes (as favoritas não contam).

## Consequências

- Sem migrações SQL: a primeira mudança de schema é uma função `migrate(1 → 2)` no leitor, com teste.
- O formato do `.jsonl` do Claude Code não é uma API pública — a extração do resumo tem de tolerar
  campos em falta (`summary: null`) e nunca falhar o fecho por causa disso.
- `DATA_DIR` é uma variável de ambiente nova ([[../environment]], quando for implementada).
- Se o histórico passar a ser ilimitado ou pesquisável, reabrir esta decisão com um ADR novo (SQLite via
  `node:sqlite`, sem binário nativo — relevante com o Smart App Control).
- Fecha as decisões em aberto "Persistência" e "Onde se guardam as preferências" de [[README]].

## Relacionado

[[../database]] · [[../product/domain-brief]] · [[0002-motor-via-pty-sobre-subscricao]]
