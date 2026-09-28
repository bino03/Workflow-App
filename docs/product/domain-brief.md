# Brief de domínio — contexto para o modelo de dados

> Escrito pelo `/create` a 2026-09-27, a partir da entrevista de criação. **É o ponto de partida do
> `/design-database`**, não o modelo: junta num sítio tudo o que já se sabe sobre os dados, para o desenho
> não recomeçar do zero nem perguntar outra vez o que já foi respondido. Não se reescreve — o modelo
> decidido vive em [[../database]].

## Entidades

Nas palavras do utilizador (verbatim quando possível), com o nome proposto para o código:

> A6 (verbatim): "aqui ainda não sei, decido mais tarde". O que se segue são **propostas do `/create`**
> tiradas do resto da entrevista, para o `/design-database` ter por onde começar.

### Terminal → `Terminal` *(proposta)*
Um processo `claude` a correr num PTY gerido pelo backend. Guarda: id, pasta de trabalho (`cwd`),
etiqueta, estado (a correr / terminado + código de saída), data de início, se é retoma (e de que sessão),
colunas/linhas, um buffer de scrollback. **Vive em memória do backend** — morre com ele.

### Sessão gravada → `ClaudeSession` *(proposta, não é da app)*
O que o Claude Code grava em `~/.claude/projects/<pasta-codificada>/<uuid>.jsonl`. A app **lê** (para
listar o que se pode retomar por pasta), nunca escreve. Guarda (lido): uuid, pasta, data, primeira
mensagem/resumo.

### Entrada da biblioteca → `LibraryEntry` *(proposta, só leitura)*
Uma stack (`library/stacks/<id>/STACK.md`), um design (`library/frontend/themes/<id>/THEME.md`) ou uma
skill (`library/skills/**/skill-*.md`, `library/stacks/<id>/skills/`). Guarda (lido do frontmatter): id,
nome, tipo, camada, maturidade/status, `applies-when`, proveniência, caminho do ficheiro.

### Uso da quota → `UsageSnapshot` *(proposta)*
Quanto da janela de 5h e do tecto semanal já foi usado, e quando renova. **Da conta, não do terminal.**
Fonte por decidir.

## Relações ditas na entrevista

O que o utilizador disse sobre como as coisas se ligam, e a leitura proposta (a confirmar no `/design-database`):

Nada foi dito na entrevista (A6 em aberto). Leituras propostas — **a confirmar**:
- `Terminal` N:0..1 `ClaudeSession` — um terminal pode ser a retoma de uma sessão gravada.
- `ClaudeSession` N:1 pasta — o Claude Code agrupa as sessões por pasta de trabalho.
- `UsageSnapshot` é global (da conta) — sem relação com terminais.
- `LibraryEntry` não se liga a nada da app (é leitura do disco do Workflow).

## Quem cria, vê e edita o quê

Um só utilizador, que cria, vê e edita tudo. Dados sensíveis:
- **O conteúdo dos terminais** (código, segredos que apareçam no ecrã, `.env` lidos pelo Claude Code) —
  não se persiste em disco sem decisão explícita; nunca vai para logs.
- **A pasta de trabalho** dá acesso ao disco — só dentro de `ALLOWED_ROOTS`.
- **As credenciais do login** (hash da password, segredo de sessão) — só em `.env`.

## Onde cada entidade aparece

Dos ecrãs do MVP — diz que campos se listam, filtram e editam (dá os índices e a obrigatoriedade):

Os ecrãs estão em standby (A7). Proposta:
- **Terminais** — lista de `Terminal` (etiqueta, pasta, estado); ao criar: escolher pasta + opcionalmente
  uma `ClaudeSession` dessa pasta para retomar; `UsageSnapshot` sempre à vista.
- **Biblioteca** — lista de `LibraryEntry` filtrável por tipo (stack/design/skill), camada e maturidade.

## MVP vs. depois

- MVP: `Terminal`, `ClaudeSession` (leitura), `LibraryEntry` (leitura), `UsageSnapshot`.
- Depois: `Project` (painel de projetos), o que o `/create` por formulário precisar.

## Pistas técnicas já decididas

- **Base de dados**: por decidir — possivelmente nenhuma (ver perguntas em aberto)
- **Integrações externas**:
  - **Claude Code CLI** (processo local, não API): `claude`, `claude --resume <uuid>`, `claude --continue`.
  - **Disco do Workflow** (`WORKFLOW_PATH`): leitura de `library/`.
  - **`~/.claude/`**: leitura das sessões gravadas; possivelmente fonte da quota.
  - Nenhuma API externa — de propósito ([[../adr/0002-motor-via-pty-sobre-subscricao]]).

## Perguntas de dados em aberto

O que a entrevista levantou e não resolveu — o `/design-database` pergunta isto primeiro:

1. **Há base de dados de todo?** O que tem de sobreviver a um reinício do backend: etiquetas dos
   terminais, a lista de terminais abertos (para os reabrir com `--resume`), pastas favoritas, layout? Se
   for pouco, um ficheiro JSON chega — ou nada.
2. **De onde vem a quota?** Nenhuma fonte está confirmada. Candidatas a investigar num spike: o que o
   `/usage` (ou `/status`) mostra dentro de uma sessão interativa; os dados que o Claude Code passa a um
   script de status line; estimar a partir das transcrições em `~/.claude/projects/` (como fazem
   ferramentas tipo `ccusage`). Cada uma tem custo e fiabilidade diferentes — e nenhuma pode usar a API.
3. **Scrollback**: guarda-se só em memória (perde-se ao reiniciar) ou em disco? Quanto por terminal? O
   conteúdo é sensível (ver acima).
4. **Sessões gravadas**: o formato de `~/.claude/projects/` não é uma API pública — ler só o mínimo
   (uuid, data, primeira mensagem) e aceitar que pode mudar entre versões do Claude Code.
5. **Biblioteca**: ler os manifestos (frontmatter de `STACK.md`/`THEME.md`/skills) ou as tabelas dos
   `README.md` de registo? (Proposta: manifestos — [[../adr/0005-biblioteca-lida-do-disco]].)

---

✅ **Modelo desenhado a 2026-09-28** — sem base de dados, um `state.json` — ver [[../database]] e
[[../adr/0009-estado-em-ficheiro-json]].
