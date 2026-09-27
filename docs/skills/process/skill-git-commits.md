# Skill: Mensagens de commit

**When to use**: antes de cada commit.

**Time**: 1-2 min

> 🔔 O hook `.githooks/pre-commit` avisa (sem bloquear) quando o diff toca ficheiros que costumam exigir
> uma atualização de docs — ver [[vault-sync-hooks]]. Num clone novo: `git config core.hooksPath .githooks`.

---

## Formato

```
<tipo>: <assunto>

<corpo>

<rodapé>
```

## Tipo (em inglês — é sintaxe, não comunicação)

`feat` nova funcionalidade · `fix` correção · `refactor` sem mudança de comportamento · `docs`
documentação · `chore` build, dependências, configuração · `test` testes · `style` formatação.

## Assunto (em português)

- **Imperativo**: "acrescenta", "corrige", "remove" — não "acrescentado", "corrigiu".
- Minúscula no início, sem ponto final, até ~60 caracteres.
- Identificadores citados ficam em inglês: "corrige o scoping de `OrderRepository`".

```
feat: acrescenta endpoints de gestão de encomendas
fix: impede IDOR na edição de encomendas
docs: documenta o fluxo de upload de ficheiros
```

❌ `Fixed bug` · `Updated the code` · `wip` · `update`

## Corpo

- Opcional, recomendado para mudanças não triviais.
- **Porquê, não o quê** — o diff mostra o quê.
- Linhas até ~72 caracteres; linha em branco depois do assunto.

```
feat: acrescenta soft-delete às encomendas

Permite recuperar encomendas apagadas por engano em vez de as
remover da base de dados. Segue o padrão deleted_at usado no
resto do código.
```

## Rodapé

`Closes #42` · `BREAKING CHANGE: …` (palavras-chave do GitHub em inglês).

## Regras

✅ Um assunto por commit · escrever para quem não viu o código · código e docs que mudam juntos vão no
mesmo commit.

❌ Vários assuntos não relacionados num commit · mensagens vazias de sentido · segredos no diff.

**Nunca `git push` sem perguntar.** Nunca `--no-verify` para calar o hook.

## Related Skills

[[naming-conventions]] · [[skill-implement-todo]] (propõe o commit no fecho)
