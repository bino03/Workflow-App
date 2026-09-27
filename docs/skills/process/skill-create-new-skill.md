# Skill: Criar uma skill nova

**When to use**: documentar um padrão repetível (já feito 2-3 vezes) como workflow ou convenção.

**Time**: ~30-45 min

> 📐 Skill vs. referência, ponteiros finos e routers: [[ai-workflow]].

---

## Step 1: É skill, referência, ou nada?

1. Vou usar isto outra vez? — não → **nada** (tarefa única).
2. É uma sequência de passos que acaba em algo feito? → **Skill**.
   É uma convenção que outro trabalho deve respeitar, sem nada para "correr"? → **Referência**.
3. Não é roadmap (→ `notes/roadmap/`), decisão (→ ADR) nem bug (→ `notes/bugs.md`)?

Categoria de uma skill: `backend`, `frontend`, `process` (ou outra que a stack do projeto use).

## Step 2: Metadados

```
Nome:          add-thing            (kebab-case; nome do padrão, não da feature)
Descrição:     em pt-PT — o que cobre E quando usar ("Usar quando…"), com palavras-gatilho
Tempo:         ~30 min
Categoria:     backend | frontend | process
Tags:          #backend #database …
Quando usar:   situações concretas
Lê primeiro:   code-best-practices, frontend-visual-consistency (se escreve UI), …
```

## Step 3: Forma de uma skill

```markdown
# Skill: <Nome>

**When to use**: <…>
**Time**: ~X

> 📐 Lê primeiro [[code-best-practices]] (se toca em código) e [[frontend-visual-consistency]] (se escreve UI).

---

## Step 1: <ação>
Porquê → como (exemplo de código) → o que se obtém.

## Final Checklist
- [ ] …
- [ ] Item de documentação a atualizar (qual doc)

## Related Skills
- [[…]]
```

- **Explicar o porquê** — o que parte quando não se segue. Uma regra sem porquê é ignorada.
- **Exemplos reais do projeto** quando existem; copiar de código que funciona, não inventar.
- **Não repetir** regras gerais — linkar [[code-best-practices]].
- **Um item de documentação no Final Checklist** (o doc que a mudança obriga a atualizar).

Uma referência dispensa "Time" e passos; tem regras, porquês, exemplos e "Drift encontrado".

## Step 4: Os quatro sítios

1. **O ficheiro**: `docs/skills/<categoria>/skill-<nome>.md` (referência: `docs/skills/references/<nome>.md`, sem `skill-`).
2. **`docs/skills/SKILLS-INDEX.md`** — entrada completa na secção certa:
   ```markdown
   ### [[skill-<nome>]]
   **<descrição>**
   - **File**: `docs/skills/<categoria>/skill-<nome>.md`
   - **Time**: ~X · **Tags**: `#…`
   - **Covers**: <passos>
   - **Use when**: <…>
   ```
3. **`docs/skills/SKILLS-QUICK-REFERENCE.md`** — ⚠️ **obrigatório**, uma linha na tabela da categoria.
   Sem isto, a skill existe mas não aparece.
4. **Ponteiro** (só skills): `.claude/skills/<nome>/SKILL.md` **na raiz do repo**, sem o prefixo `skill-`:
   ```markdown
   ---
   name: <nome>
   description: <em pt-PT: o que cobre E quando usar, com palavras-gatilho — é isto que decide a invocação e o que aparece no menu `/`>
   ---

   Before writing code, read `${CLAUDE_PROJECT_DIR}/docs/skills/references/code-best-practices.md`.
   Then read `${CLAUDE_PROJECT_DIR}/docs/skills/<categoria>/skill-<nome>.md` in full and follow it step by step.

   If asked to update this checklist, edit the vault file above, not this pointer.
   ```
   Fino: não duplicar passos no ponteiro. Um só, na raiz — o Claude Code procura subindo até à raiz do repo.

Referência nova: sem ponteiro; em vez disso, acrescentar "lê `[[<ref>]]` antes de…" às skills que a devem
ler (no ficheiro do vault **e** no ponteiro).

Atualizar "Last Updated" nos dois índices.

## Step 5: Commit

```bash
git add docs/skills/ .claude/skills/<nome>/
git commit -m "docs: acrescenta a skill <nome>"
```

## Final Checklist

- [ ] Repetível (não é tarefa única); skill vs. referência decidido
- [ ] Metadados completos; descrição com palavras-gatilho
- [ ] Passos com porquê e exemplos; Final Checklist com item de documentação
- [ ] Liga [[code-best-practices]] (se toca código) e [[frontend-visual-consistency]] (se escreve UI)
- [ ] Ficheiro na pasta certa
- [ ] SKILLS-INDEX **e** SKILLS-QUICK-REFERENCE atualizados, com data
- [ ] Ponteiro na raiz (só skills)
- [ ] Commit

## Related Skills

[[ai-workflow]] · [[skill-git-commits]]
