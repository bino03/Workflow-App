# Vault Sync — hook de pre-commit

**O que é**: um git hook `pre-commit` que avisa (sem bloquear) quando um commit toca ficheiros que
costumam exigir uma atualização correspondente no vault. Não é uma skill — é infraestrutura do repo.

## Porque existe

Documentação viva desatualiza-se se depender só de disciplina. O hook avisa no momento exato em que a
mudança acontece — sem bloquear o commit.

## Onde vive

`.githooks/pre-commit` — **versionado** (ao contrário de `.git/hooks/`), para sobreviver a um clone. O git
só o usa com `core.hooksPath` configurado, e essa configuração **não é versionada**:

```bash
git config core.hooksPath .githooks
```

Se os avisos pararem de aparecer numa máquina nova, é a primeira coisa a verificar.

## O que deteta

| Se o commit tocar… | Avisa para atualizar |
|---|---|
| `backend/src/**/*routes*.ts` | `docs/api.md` |
| `backend/src/terminals/protocol.ts` | `docs/api.md` → Protocolo + espelho no frontend |
| `backend/src/config.ts` | `docs/environment.md` + `backend/.env.example` |
| `spawnClaude.ts`, `cwdPolicy.ts`, `authGuard.ts` | `docs/security.md` + ADR 0004 |
| `backend/src/common/errors.ts` | `frontend/src/errors/errorMessages.ts` |
| `backend/package.json` com bump de node-pty/fastify/typescript | `docs/backend-conventions.md` |
| `theme.ts`, `index.css`, `colors.css` | `references/design/tokens-and-colors.md` |
| `services/`, `errors/`, `api.ts` | `references/design/services-and-error-handling.md` |
| `main.tsx`, `PrivateRoute.tsx`, `layouts/`, `context/` | `references/design/app-shell-and-auth.md` |
| `components/**/*Form.tsx`, `*Drawer.tsx`, `*Modal.tsx` | `forms-and-validation.md` + `drawers-and-modals.md` |
| Página/serviço/módulo novo | `docs/code-map.md` |
| `frontend/package.json` com bump de react/typescript/vite/antd/tailwind/xterm | Referências de stack no vault |
| Qualquer ficheiro de UI enquanto `tokens-and-colors.md` tem o marcador `design:pending` | Correr `/choose-design` antes de continuar a UI |
| Qualquer `CLAUDE.md` a ganhar **mais de 10 linhas** ou um bloco de código | `docs/` — os `CLAUDE.md` são ponteiros |
| Uma skill nova sem `SKILLS-QUICK-REFERENCE.md` no mesmo commit | Os índices de skills e o ponteiro |

## Comportamento

- **Nunca bloqueia** — termina sempre com `exit 0`.
- Só olha para ficheiros **staged**.
- Testar sem commitar: `git hook run pre-commit` (git ≥ 2.36) ou `sh .githooks/pre-commit`.

## Estender

Um padrão de drift recorrente novo → mais um bloco `grep` no script, a seguir o modelo dos existentes, e
uma linha na tabela acima.

## Relacionado

[[skill-git-commits]] · [[skill-implement-todo]] (documentação proativa, não reativa)
