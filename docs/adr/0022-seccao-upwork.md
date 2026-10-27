---
tags: [adr]
status: aceite
data: 2026-10-26
---

# 0022 — Secção Upwork: candidaturas como sessões guiadas longas, sem contacto com a Upwork

**Data**: 2026-10-26 · **Estado**: `aceite` · **Decidido com**: o dono, no `/plan-feature` da spec
[[../features/upwork]]

Complementa o [[0020-sessoes-guiadas]] (um propósito novo, `upwork`), o [[0021-permissoes-das-sessoes-guiadas]]
(o modo Perguntar/Automático vale igual), o [[0012-argumentos-do-claude-e-status-line]] (o `--resume` passa a
retomar sessões guiadas) e o [[0009-estado-em-ficheiro-json]] (dados novos em ficheiros, sem base de dados). O
lado do vault é o ADR 0012 do Workflow ("`/upwork-proposal`: a skill de candidaturas").

## Contexto

O dono pediu (2026-10-26) uma secção da app "dedicada à Upwork": colar a descrição de um job e receber logo o
necessário para se candidatar — mensagem, o que é preciso, e o resto — e, na entrevista, que "só deve chamar o
`/create` se a candidatura for aceite; o processo de criar uma candidatura deve ser uma skill à parte, apenas
dedicada a isto". E que a interface fosse como a do Novo projeto, sem terminais à vista.

Três forças moldam a decisão:

- **A Upwork proíbe automação fora da API aprovada** (scraping, extensões que vigiam páginas, envio
  automático de propostas → aviso, restrição ou bloqueio da conta). Escrever com IA e o humano rever e enviar
  é aceite.
- **Uma candidatura vive semanas** (enviada → entrevista → oferta), e a ajuda nas mensagens do cliente precisa
  do contexto do que foi enviado. Mas `MAX_TERMINALS` é 8, e hoje uma sessão guiada acaba com o `result.json`
  (`done`) e o `/message` recusa sessões `done`/`stopped` (`GUIDED_003`).
- **A sessão guiada já resolve a UI** ([[0020-sessoes-guiadas]]): cartões de escolha, permissões, conversa
  lida do `.jsonl`, caixa de texto.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **Skill dedicada do Workflow numa sessão guiada `upwork`, longa, pausada e retomada pela app (escolhida)** | A lógica da candidatura vive no vault, como o `/create` e o `/import`; reutiliza a UI guiada já verificada; o contexto do job fica na mesma conversa | Um propósito guiado que não acaba muda o `GuidedService`; o `--resume` de uma conversa longa demora |
| Prompt fixo no backend da app | Sem tocar no Workflow | A lógica sai do vault e diverge; o dono pediu "uma skill à parte" |
| Terminal normal com a skill | Nada de novo na app | O dono pediu explicitamente "nada de terminais visíveis" |
| Uma sessão guiada nova por cada mensagem do cliente | Mantém o fim por `result.json` | Perde o contexto do job e do que foi enviado |
| Terminal sempre aberto por candidatura | Sem retomar | Esgota os 8 terminais com candidaturas paradas há dias |
| Ler o URL do job / API oficial da Upwork | Menos colar | ToS (bloqueio da conta); a API exige aprovação — fora |
| `/create` logo ao candidatar | Projeto pronto se ganhar | Uma candidatura não é um projeto até ser aceite; o dono recusou |

## Decisão

1. **A app nunca fala com a Upwork.** Nenhuma chamada, login, leitura do URL do job nem envio. Tudo entra por
   colar e sai por copiar. O URL do job guarda-se só como link (validado como `https://www.upwork.com/…`),
   para o dono abrir no browser dele; **não vai para o `job.md`** — a skill não precisa dele, e não o ter à
   mão é a forma mais simples de não o abrir. Defesa em profundidade: nas sessões `upwork` o hook guiado
   **recusa `WebFetch` para qualquer host `upwork.com`** (a allowlist do Workflow aprova `WebFetch` em geral).
2. **Propósito guiado `upwork`** com o prompt `/upwork-proposal --app <DATA_DIR/guided/<uuid>/job.md>`
   (validado por regex e igual ao caminho construído, como o `create`). O backend escreve no arranque `job.md`
   (anúncio verbatim, perguntas de triagem numeradas, o `appId`) e uma **cópia** do `profile.md` — fixa o que a
   proposta usou.
3. **Uma sessão `upwork` não acaba por resultado.** O `result.json` é ignorado neste propósito; o pacote é um
   conjunto de ficheiros (`analysis.md`, `cover-letter.md`, `screening.md`, `plan.md`, `client-questions.md`)
   descritos por um manifesto `package.json` (`version: 1`), que a skill reescreve a cada revisão. O backend lê
   o manifesto com zod e recusa nomes de ficheiro fora da pasta.
4. **Pausar e retomar sozinho.** Ao marcar `Enviada` e em **Pausar**, o backend fecha o terminal e mantém a
   pasta e a sessão (`stopped` é normal neste propósito, não erro). Ao escrever na conversa de uma sessão
   parada, o backend retoma-a com `--resume` (terminal `hidden`, os mesmos `--settings`/`--add-dir`) e escreve
   o texto só depois de ela chegar ao `waiting-text`. Várias candidaturas podem existir ao mesmo tempo; o
   limite é o dos terminais a correr.
5. **Dados em `DATA_DIR/upwork/`**, fora dos dois repositórios (dados pessoais): `profile.md` (≤ 20 000) e
   `applications/<id>/application.json` (zod, `atomicWrite`, escrito só pelo backend). Ao **arquivar**, o
   pacote copia-se para `applications/<id>/package/` e a pasta da sessão guiada apaga-se.
6. **O estado da candidatura é manual e livre** (`draft`, `sent`, `interview`, `offer`, `won`, `lost`,
   `withdrawn`), com histórico de datas — a app não vê o que acontece na Upwork.
7. **Criar projeto só com `won`**, numa criação à parte no ecrã Novo projeto: o backend compõe o brief
   (anúncio + carta enviada + plano técnico + acordo colado) e chama o `CreationService` por dentro, com limite
   de 60 000 (o de 8000 é do corpo HTTP de `/api/creations`). O `/create` nunca corre dentro da sessão da
   candidatura.
8. **A interface é a do Novo projeto**: nenhum `TerminalView` na página `/upwork`; os terminais `upwork` são
   `hidden` (fora da grelha e dos separadores); **Ver terminal** só como escape.

## Consequências

- Candidatar-se passa a ser colar, rever e copiar, com registo do que se enviou a quem e em que estado está.
- **O `GuidedService` deixa de assumir que uma sessão acaba**: o fim por `result.json` e a recusa de
  `stopped` passam a depender do propósito. Os testes do `create` têm de continuar a passar sem mudanças.
- **Retomar uma sessão guiada é novo**: o `waiting-text` depois de um `--resume` longo pode demorar; se passar
  o limite, `GUIDED_004` e a UI tenta de novo (o valor mede-se no passo 5 da spec).
- **Contrato novo com o Workflow** (`job.md`, `profile.md`, `package.json`) — mudar-lhe a forma é subir a
  `version` e avisar os dois lados, como o `result.json` do `/create`.
- O hook guiado ganha uma regra por propósito (recusar `WebFetch` à Upwork); não muda nada nas sessões
  `create`.
- **Fica de fora** (spec §2): preço e milestones, o contrato em curso, estatísticas, avisos fora do ecrã,
  transições automáticas, layout de telemóvel.

## Estado

`aceite` — 2026-10-26. O ponto 7 (o que vai no brief, e o acordo obrigatório) foi alterado por
[[0023-brief-com-a-candidatura-inteira]] a 2026-10-27.
