# Skill: Frontend Structure Brief

**When to use**: queres discutir um redesign numa **outra** conversa (ex.: um chat de design) e
precisas de um retrato fiel do que o frontend faz hoje — sem colar código nem dar acesso ao repo.

**Output**: um `.md` em `notes/design-briefs/`

**Time**: ~15-20 min

> 📐 Lê [[frontend-visual-consistency]] (para descrever os tokens reais, não aproximações) e
> [[project-vocabulary]] (Drawer ≠ Modal).

---

## Step 1: O assunto

- **Foi referido um ficheiro** → é o assunto. Se faz parte de um domínio maior, perguntar se o brief
  cobre só o ficheiro ou o domínio (create/edit/view/list).
- **Não foi dado nada** → perguntar (componente/página, domínio inteiro, ou área da UI). **Nunca inventar o assunto.**

## Step 2: Ler os ficheiros por inteiro

Nunca de memória ou pelo nome. Extrair, por esta ordem:

1. **Árvore de componentes** (um nível de aninhamento relevante)
2. **Props**
3. **Estado** (local / Context)
4. **Fluxo de dados** — que função de serviço, que endpoint, que campos-chave
5. **Rota**
6. **Comportamento condicional** — loading, erro, vazio, visibilidade por role
7. **Validação** — campos obrigatórios (um redesign não pode largá-los em silêncio)
8. **Estilo** — componentes AntD, classes, tokens reais (confirmados no sub-ficheiro de design)

**Descrever só o que está no código.** O que não é claro vai para "Open Questions".

## Step 3: Escrever

```markdown
# Frontend Structure Brief: <Assunto>

**App**: Workflow App (stack)
**Location**: `<caminhos>`
**Route**: `<url>`

## Component Tree
## Data & State
## Current Behavior
## Styling
## Constraints to Respect in Any Redesign
## Open Questions
```

Factual e compacto. Código só quando a forma exata importa (ex.: uma interface de props).

## Step 4: Guardar

`notes/design-briefs/AAAA-MM-DD-<assunto-kebab>.md` (git-ignored — é um artefacto de trabalho).
Depois do redesign implementado, o brief vai para `notes/design-briefs/archive/`.

## Final Checklist

- [ ] Assunto identificado (ou perguntado)
- [ ] Ficheiros lidos por inteiro
- [ ] As 8 dimensões cobertas; estilo confirmado contra `design/`
- [ ] Nada inventado — dúvidas em Open Questions
- [ ] Guardado em `notes/design-briefs/`; caminho dito ao utilizador

## Related Skills

[[frontend-visual-consistency]] · [[skill-frontend-design-system]] · [[skill-frontend-integration-guide]]
