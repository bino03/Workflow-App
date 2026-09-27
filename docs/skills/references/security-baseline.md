# Segurança — regras base

**When to use**: sempre que se escreve código que toca em autenticação, autorização, input do
utilizador, ficheiros, segredos ou logs. As regras específicas de cada arquitetura (cookies,
tenants) estão nos padrões de [[../architecture/README]].

---

## Segredos

1. **Nenhum segredo entra no git.** `.gitignore` cobre `.env*` (menos `.env.example`), chaves,
   dumps. Antes de commitar: `git diff --staged` e ler.
2. **Segredo commitado por engano: rodar primeiro, limpar o histórico depois.** Pela ordem
   inversa não serve — assumir que já foi visto.
3. **O browser não guarda tokens em `localStorage`.** Cookies HttpOnly, ou o token nunca chega
   ao JavaScript ([[security|fluxo de autenticação]]).
4. **Segredos guardados pela app na sua própria BD** (ex.: password SMTP) vão cifrados em repouso
   (AES-GCM, IV aleatório por valor) e a API nunca os devolve — expõe só `hasPassword`.

## Autorização

1. **Toda a rota protegida tem verificação explícita** no próprio endpoint — nunca confiar só nas
   regras globais.
2. **Esconder um botão não é segurança.** Um gate de UI é reforço; a prova é a API devolver 403.
3. **Campos sensíveis filtram-se no DTO de resposta**, não no frontend — quem inspecionar a rede vê
   o que a API devolve (padrão `roles-and-permissions` do Workflow — não incluído, sem roles).
4. **Recurso de outro tenant/dono → 404, não 403.** Um 403 confirma que existe.
5. **Identificadores de tenant/dono nunca vêm do cliente** — derivam do token. Um id vindo do
   pedido é um IDOR à espera de acontecer.

## Input

1. **Validar à entrada**, com lista branca de caracteres em texto livre (não só comprimento).
    Rejeitar `< > \` { } $` em nomes e moradas. Email com o validador da biblioteca, nunca regex
    reinventada. Todo o texto tem `max`.
2. **Nunca SQL por concatenação** — parâmetros sempre.
3. **Uploads: validar MIME e tamanho antes de subir**, nunca só a extensão.
4. **Markdown de utilizador** renderiza-se sem HTML em bruto (nada de `dangerouslySetInnerHTML`).

## Superfície

1. **CORS com lista explícita de origens**, lida de configuração, nunca `*` com credenciais.
    Com `allowCredentials`, uma origem errada em produção dá a qualquer site a sessão do utilizador.
2. **Rate limiting** no login e na recuperação de password (por conta **e** por IP), e em
    exportações pesadas (por utilizador).
3. **Recuperação de password não revela se a conta existe** — resposta idêntica com ou sem conta.
4. **Bloquear/eliminar uma conta corta as sessões abertas** (ex.: `last_token_reset_at` comparado
    com o `iat` do token), não só as futuras.
5. **Comparação de tokens em tempo constante.**

## Logs

1. **Nunca registar** tokens, passwords, headers `Authorization`/`Cookie`, corpos com segredos.
    Um filtro de "debug" que loga o cookie em `INFO` escreve fragmentos do access token em produção.
2. **Nível de log por omissão seguro para produção** (`INFO`/`WARN`); subir por variável de
    ambiente para depurar, não editando o ficheiro de configuração.

## Antes de produção

Cada projeto gerado recebe `notes/roadmap/pre-deploy-security.md` com esta lista convertida em
checklist verificável, por níveis (crítico / importante / desejável).

## Relacionado

[[error-model]] · [[security|fluxo de autenticação]] · padrão `roles-and-permissions` do Workflow — não incluído, sem roles · padrão `multi-tenancy-shared-schema` do Workflow — não incluído
