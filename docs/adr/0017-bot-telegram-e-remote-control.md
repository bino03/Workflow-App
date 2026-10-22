---
tags: [adr]
status: aceite
data: 2026-10-22
---

# 0017 — Bot de Telegram que abre terminais com Remote Control

**Data**: 2026-10-22 · **Estado**: `aceite` (o comportamento do `--remote-control` no PTY fica por confirmar no
spike, passo 1 da spec) · **Decidido com**: `/refine-idea` + `/plan-feature` (spec [[../features/bot-telegram]])

Complementa o [[0012-argumentos-do-claude-e-status-line]] (acrescenta um argumento à lista fechada) e o
[[0004-exposicao-e-modelo-de-ameaca]] (acrescenta uma porta de entrada que não é a app). Não substitui nenhum.

## Contexto

O dono quer **retomar trabalho só com o telemóvel**, sem acesso à app (que ainda só escuta em `127.0.0.1`,
porque a forma de expor fora de casa continua em aberto). O Claude Code tem o **Remote Control**: um
`claude` interativo arrancado com `--remote-control "<nome>"` (ou `--rc`) fica disponível no app Claude
(iOS/Android) e em claude.ai/code, e corre na máquina local. Requisitos e propriedades, segundo a documentação
(code.claude.com/docs/en/remote-control, lida a 2026-10-22):

- só com a subscrição (Pro/Max/Team/Enterprise), **API keys não suportadas** → compatível com o [[0002-motor-via-pty-sobre-subscricao]];
- só **ligações de saída** (HTTPS para a API da Anthropic), nenhuma porta a entrar;
- uma sessão remota por processo interativo; se o processo sair, a sessão fica offline;
- controlar a sessão exige o login do claude.ai (e, opcionalmente, *Trusted Devices*).

Falta uma forma de **mandar o desktop abrir** essa sessão a partir do telemóvel.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **Bot de Telegram em long polling, dentro do backend, que abre terminais com `--remote-control` (escolhida)** | Só ligações de saída — não depende da decisão de exposição; o bot só *abre*, controlar exige o login claude.ai; os terminais são os mesmos da app | Uma porta de entrada nova autenticada só pelo ID de Telegram; nomes de projetos e títulos de conversas passam pelos servidores do Telegram |
| Expor a app (Tailscale/túnel) e usá-la no telemóvel | Uma só interface | Depende de uma decisão ainda em aberto; a UI é só desktop ([[0008-identidade-visual]]) |
| `claude remote-control` (modo servidor) sempre a correr por projeto | Sem bot: as sessões criam-se no app Claude | Recusa `--settings` (perdia-se a status line da quota, [[0012-argumentos-do-claude-e-status-line]]); um processo por projeto sempre vivo; não retoma uma conversa qualquer gravada |
| Webhook do Telegram | Sem polling | Exige um URL público a entrar — contraria o [[0004-exposicao-e-modelo-de-ameaca]] |
| Ligar o RC num terminal já aberto, escrevendo `/remote-control` no PTY | Não reinicia o processo | Escrever no PTY por conta própria já foi recusado (ver o "Resumir" em [[0009-estado-em-ficheiro-json]]); `/remote-control` é um alternar, não um ligar |

## Decisão

1. **Argumento novo** na lista fechada do `claudeArgs.ts`: `--remote-control [<nome>]`. O nome é gerado
   **pelo backend** ("<projeto> · <título da conversa>"; omitido numa conversa nova, para o Claude Code dar o
   nome automático que acompanha o primeiro prompt), passa uma allowlist de caracteres, nunca começa por `-`,
   e vai como um elemento do `argv` (sem shell, como os outros).
2. **Módulo `telegram/` no backend**, opcional: só arranca com `TELEGRAM_BOT_TOKEN` definido. Long polling
   (`getUpdates`) com `fetch`, sem dependências novas. Nunca webhook.
3. **Autenticação do bot**: só responde a mensagens de **conversa privada** cujo `from.id` é
   `TELEGRAM_ALLOWED_USER_ID`; tudo o resto é ignorado em silêncio. Os dados dos botões (`callback_data`) são
   chaves curtas para um mapa em memória com validade; cada ação revalida tudo no momento (projeto no registo,
   `ALLOWED_ROOTS`, UUID, estado do terminal).
4. **O bot é um cliente do `TerminalsService`**, como o frontend: os terminais que abre ficam no `state.json` e
   aparecem na app como os outros, com `remoteControl: true` (etiqueta **RC**). `MAX_TERMINALS`,
   `ALLOWED_ROOTS` e "uma sessão num só terminal" valem igual.
5. **O conteúdo dos terminais nunca vai para o Telegram** (como nunca vai para logs, 0004 regra 6): só nomes de
   projetos, títulos/pré-visualizações de conversas, estados e a quota.
6. **O token não chega ao `claude`**: `TELEGRAM_*` entra na denylist do ambiente do filho, e nunca aparece em logs
   (o URL da API do Telegram contém o token — os erros são reescritos sem ele).

## Consequências

- Quem controlar a conta de Telegram do dono pode **abrir e parar** terminais (gastar quota, interromper
  trabalho), mas não **ver nem escrever** neles — isso exige o login claude.ai. É um risco aceite para uso pessoal;
  ativar *Require trusted devices* no claude.ai fecha a segunda porta.
- Uma pasta onde o Claude Code nunca foi aceite como de confiança mostraria o prompt de *trust* sem ninguém para
  responder: o bot recusa essas pastas (a confirmar no spike onde o Claude Code guarda a confiança).
- Dois backends com o mesmo token disputam o `getUpdates` (o Telegram devolve 409): instâncias de teste
  **nunca** recebem o token real.
- Um terminal com RC que é reaberto (na app ou pelo bot) volta com RC — o estado guarda-o.
- Se o CLI mudar o nome do argumento, falha num sítio só (`claudeArgs.ts`), como em 0012.

## Estado

`aceite` — falta o spike (spec [[../features/bot-telegram]] passo 1) confirmar: `--remote-control` combinado com
`--resume`/`--session-id` e `--settings` num PTY, sem prompts extra; e onde o Claude Code guarda a confiança das pastas.
