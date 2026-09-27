# 📚 Documentação

Documentação central do Workflow App. **Fonte de verdade** sobre o que foi decidido e porquê.

## Estrutura

- **code-map.md** — onde vive cada funcionalidade (domínio → ficheiros) + "onde procurar, por sintoma"
- **commands.md** — correr, testar, build, e as armadilhas de cada comando
- **environment.md** — variáveis de ambiente e o que acontece sem elas
- **architecture.md** — as peças e como comunicam
- **database.md** — schema, relações, convenções, intervalo de migrações
- **api.md** — rotas, métodos, regras de acesso, erros
- **backend-conventions.md** — decisões do backend que não se deduzem do código, e armadilhas
- **operations.md** — o que é produção, backup/restore, migração má
- **frontend-conventions.md** — as regras do frontend e armadilhas
- **security.md** — autenticação, autorização, modelo de confiança, CORS, segredos
- **vault-sync-hooks.md** — o hook que avisa quando um commit precisa de atualizar docs
- **provenance.md** — de onde veio este projeto (Workflow) e o que foi escolhido
- **adr/** — decisões numeradas e datadas — nunca apagar, nunca editar para mudar de decisão
- **features/** — specs de features multi-sessão (`/plan-feature`)
- **product/** — visão, casos de uso, briefing de design, perfil do projeto
- **skills/** — skills invocáveis e referências (ver [[SKILLS-INDEX]])

## Regras

1. **Uma cópia de cada facto.** Se dois documentos precisam do mesmo facto, um tem-no e o outro linka.
2. **Os `CLAUDE.md` são ponteiros**, não documentação — o hook avisa quando crescem.
3. **Estado no topo** quando não é óbvio: ✅ decidido/implementado · 🚧 por implementar · ❓ em aberto.
4. **Atualiza-se no momento da implementação**, pelo Final Checklist de cada skill — o hook é a rede.
5. Ver [[documentation-rules]].

## Manter em sincronia

```bash
git config core.hooksPath .githooks
```

Ver [[vault-sync-hooks]].
