# Boas práticas de código (transversal)

**When to use**: sempre — é a referência de qualidade que qualquer skill que escreve código lê
antes de começar. As regras específicas de cada stack vivem no `conventions.md` dessa stack;
aqui ficam as que não dependem da linguagem.

---

## Porque é que este ficheiro existe

Em vez de repetir as mesmas regras em cada skill, estão aqui. Cada skill foca-se no seu domínio
e linka para cá. Se uma regra geral muda, muda num sítio só.

## Princípios

- **Nomes descritivos**, sem abreviações obscuras — `asset` não `ast`, `getUserById` não `getUsr`.
- **Funções pequenas, uma responsabilidade cada.**
- **DRY sem abstração prematura** — três linhas repetidas são melhores do que a abstração errada.
  Extrai-se quando o padrão se repete a sério, não à segunda ocorrência.
- **Sem código morto nem comentado** — apaga-se; o git guarda o histórico.
- **Comentários só para o porquê não óbvio**, nunca para o quê (o nome já o diz). Um comentário
  que explica uma armadilha real ("o Lombok tem de correr antes do MapStruct") vale ouro; um
  que parafraseia a linha seguinte é ruído.
- **Validar na fronteira, não em todo o lado** — no controller/handler e no formulário; não
  repetido em cada camada interna.
- **Nunca commitar segredos** — `.env`, chaves, tokens. Ver [[security-baseline]].
- **Erros tipados e centralizados**, nunca strings soltas. Ver [[error-model]].
- **Mudar o código e a documentação no mesmo commit** quando a mudança altera um contrato,
  um schema ou uma convenção. Ver [[documentation-rules]].

## Antes de escrever código novo

1. **Procurar se já existe.** Um helper, um componente partilhado, um código de erro, um
   normalizador. A quarta cópia do mesmo tipo é o sintoma mais comum de não ter procurado.
2. **Ler a convenção da área** (a referência de design, o `conventions.md` da stack) em vez de
   inventar um valor novo.
3. **Seguir o padrão dominante e correto**, não o numericamente dominante. Se o código tem
   dois padrões, a documentação diz qual é o certo — o outro é drift.

## Drift

**Drift** é código que contraria uma convenção já decidida. Trata-se assim:

- Não se copia. Um exemplo errado no código não é autorização para repetir.
- Regista-se no documento da convenção, secção "Drift encontrado", com ficheiro:linha.
- Migra-se **oportunisticamente** — quando o ficheiro for tocado por outra razão — a menos
  que seja um bug.

## Checklist rápido antes de qualquer commit

- [ ] Nomes claros, sem abreviações
- [ ] Sem código morto ou comentado
- [ ] Erros tratados de forma centralizada
- [ ] Testado a sério — ver [[testing-and-verification]]
- [ ] Sem segredos no diff
- [ ] Documentação atualizada se o contrato/schema/convenção mudou
- [ ] Mensagem de commit segue a skill `git-commits`

## Relacionado

[[naming-conventions]] · [[error-model]] · [[security-baseline]] · [[testing-and-verification]] · [[documentation-rules]]

## Regras da stack

O essencial de cada `*-conventions.md` — o detalhe está lá.

### Backend — Node + Fastify + node-pty (🚧 [[backend-conventions]])

1. TypeScript strict; configuração validada com zod no arranque.
2. Por domínio (`src/<domain>/`); transversal em `src/common/`.
3. Todo o input (corpo, mensagem de controlo do WebSocket) passa por um schema zod.
4. `ErrorCode` + `AppError` + um error handler; o frontend espelha os códigos.
5. **Só se lança `CLAUDE_BIN` com argumentos fixos** — nunca um comando construído a partir do cliente,
   nunca um shell. Pastas só dentro de `ALLOWED_ROOTS`.
6. O processo filho nunca recebe `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN`/`CLAUDECODE`.
7. O conteúdo dos terminais nunca vai para logs.

### Frontend — React + Vite + Ant Design ([[frontend-conventions]])

1. Strict mode; `npx tsc -b` é o único type-check real.
2. Um serviço por domínio sobre a instância Axios única; sem `try/catch` nos serviços.
3. Formulários com Zod + React Hook Form.
4. Cores, larguras e ícones vêm de `design/` — ⛔ nenhum ecrã antes do `/choose-design`.
5. O terminal é xterm.js dentro de `TerminalView`; a instância e o WebSocket não vão para Context.
