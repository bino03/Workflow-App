# Modelo de erros

**When to use**: sempre que se cria um caso de erro, se trata uma resposta de erro, ou se mostra
uma mensagem ao utilizador.

---

## O percurso de um erro

```
backend                                          frontend
───────                                          ────────
regra violada
  → exceção tipada (NotFound, Forbidden, Business…)
  → handler global único  ──── HTTP ≥ 400 ────▶  catch no componente
    { errorCode, message, fieldErrors? }           → ErrorHandler.handle(e)
                                                     → mapa errorCode → mensagem PT
                                                     → notificação (canal único)
```

## Regras

1. **Todo o erro de negócio tem um código tipado**, definido num enum/ficheiro único, agrupado
   por módulo (`ORDER_xxx`, `USER_xxx`, `FILE_xxx`). Nunca strings soltas nem mensagens ad-hoc.
2. **Procurar antes de criar.** O enum cresce para centenas de códigos e é fácil já existir um
   genérico (`ACCESS_DENIED`, `FILE_TYPE_NOT_ALLOWED`) sem ser óbvio pelo nome. Um código novo
   entra no bloco do módulo certo — nunca um prefixo novo inventado, nunca um número reutilizado.
3. **O código nasce no backend.** O frontend só **espelha** — o mapa de mensagens é indexado pela
   string exata que a API envia (`'ORDER_001'`, com underscore). O frontend nunca inventa códigos.
4. **Os dois lados mudam no mesmo commit.** Código novo no enum do backend → entrada no mapa do
   frontend. O hook de pre-commit avisa quando o enum muda.
5. **Um handler global, um só.** Converte exceção → resposta HTTP num sítio. Um segundo handler
   é bug.
6. **A resposta de erro nunca expõe** stack traces, passwords, tokens, paths absolutos do servidor.
7. **O `message` do backend é contexto para logs, não texto de UI.** A UI mostra sempre a mensagem
   mapeada pelo código. Mostrar o `message` cru deu, num projeto real, a mesma falha em duas
   notificações — uma em português, outra em inglês técnico.

## Forma na rede

```json
{
  "errorCode": "ORDER_001",
  "message": "Order not found: 3f2a…",
  "fieldErrors": [ { "field": "name", "message": "must not be blank" } ]
}
```

`fieldErrors` só em erros de validação (400). O frontend mostra-os por campo (ou lista-os numa
notificação), não como toast genérico.

## Estados HTTP

| Situação | Status |
|---|---|
| Validação falhou | 400 |
| Sem sessão / token inválido | 401 |
| Autenticado mas sem permissão | 403 |
| Não existe — **ou existe mas pertence a outro tenant** | 404 (ver [[security-baseline]]) |
| Conflito (duplicado, estado inválido) | 409 |
| Erro inesperado | 500 |

## No frontend — quem notifica

- **Todo o `catch` de chamada à API chama o handler centralizado.** Não é opcional nem "só para
  casos complexos". `try/finally` sem `catch` à volta de uma chamada à API é bug: o spinner pára,
  parece sucesso, e o utilizador vê uma lista vazia sem mensagem.
- **O handler reclama o erro** (marca-o como tratado) mesmo quando decide não notificar.
- **O interceptor HTTP global é rede de segurança**: só notifica se ninguém reclamou o erro, e só
  erros de rede sem resposta notificam de imediato. Assim nunca há notificação a dobrar.
- **Um canal de notificações**, não dois (ex.: não misturar o `message` da biblioteca de UI com um
  `notificationService` próprio).

## Relacionado

[[api-design]] · [[code-best-practices]] · [[../frontend/ux-patterns]]
