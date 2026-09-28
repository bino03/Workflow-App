# 🛠️ Operações

> ❓ Em aberto até haver produção. O que decidir primeiro: **onde o backend vai correr** — destrava CORS,
> segredos, domínio e backups.

## O que é "produção"

Hoje: o portátil do dono, só em `127.0.0.1`. Plano: o **desktop de casa**, sempre ligado, com acesso
de outros dispositivos ([[adr/0004-exposicao-e-modelo-de-ameaca]]). Não há staging — "produção" é a
máquina onde o dono trabalha, e os terminais correm nela a sério.

## Deploy — o que muda quando deixar de correr localmente

- [ ] Forma de exposição decidida (ADR novo): VPN mesh · túnel com controlo de acesso · proxy com TLS
- [x] SO do desktop de casa decidido: **Linux com ambiente gráfico leve** (Xubuntu LTS ou Debian + Xfce,
      login automático) — [[adr/0013-linux-no-desktop-de-casa]]. Razão principal: 8 GB de RAM
- [ ] Antes de instalar: confirmar que a extensão Claude in Chrome funciona com o Chrome em Linux (se não,
      a verificação no browser fica só Playwright — a decisão mantém-se)
- [ ] A app testada em Linux: `node-pty` compilado; `cwdPolicy` (caminhos com maiúsculas distintas); leitura
      das sessões em `~/.claude/projects/` (cwd codificado `/home/x/app` → `-home-x-app`)
- [ ] `claude` com login feito **pelo mesmo utilizador** que corre o backend
- [ ] Os projetos a abrir lá correm em Linux (um Visual Studio/.NET Framework não corre)
- [ ] (Opcional, o maior ganho) RAM para 16 GB
- [ ] O backend arranca sozinho (serviço/tarefa agendada) com o `PATH`/`HOME` certos ([[backend-conventions]] → Armadilhas)
- [ ] Clone do Workflow na máquina + `WORKFLOW_PATH`
- [ ] Domínio/origem do frontend → `CORS_ALLOWED_ORIGINS`
- [ ] Segredos de produção fora do git e fora da máquina de desenvolvimento
- [ ] `COOKIE_SECURE=true`; TLS
- [ ] 2FA decidido
- [ ] Checklist de [[../notes/roadmap/pre-deploy-security|pre-deploy-security]] fechada

## Testar outras apps no browser a partir da app

> 🚧 Decidido em conversa (2026-09-28), ainda por montar. Cenário: a app corre no desktop de casa; o dono
> está noutro dispositivo, só com o browser.

**O browser e os testes correm no desktop de casa, ao lado do código. O dispositivo do dono é só o ecrã.**

O Claude controla o browser da máquina onde ele próprio corre: a extensão Claude in Chrome fala com o
Claude Code local. Os terminais desta app correm o `claude` no desktop de casa — por isso o Chrome que ele
controla é o de lá, e a app em teste, a API dela e o browser falam todos por `localhost` (sem CORS, sem
portas expostas, sem cookies cross-site).

| Para quê | Como, no desktop de casa |
|---|---|
| Verificação exploratória ("vê se isto ficou bem") | Chrome com a extensão Claude in Chrome; o resultado chega como capturas/GIFs. Ao vivo, só por remote desktop |
| Regressões e fluxos críticos | Playwright headless — não precisa de sessão gráfica, reprodutível, corre num terminal como os outros testes |

**Posto de parte**:
- Controlar o Chrome do dispositivo remoto a partir do `claude` do desktop — precisaria de uma ponte entre
  os dois: mais uma superfície exposta ([[adr/0004-exposicao-e-modelo-de-ameaca]]), frágil, e a app em
  teste teria de ficar acessível de fora (CORS, `Origin`, `SameSite`). *Por verificar*: a extensão parece
  suportar vários browsers ligados; não se sabe se isso funciona entre máquinas.
- Correr os testes no dispositivo remoto — só faz sentido se for lá que se desenvolve; com a API no
  desktop, obrigava a expô-la.

**Pré-requisitos no desktop** (juntam-se ao deploy acima):
- [ ] Chrome com a extensão Claude in Chrome, com login feito pelo **mesmo utilizador** que corre o backend
- [ ] Sessão de utilizador aberta com ambiente gráfico — se o backend passar a correr como serviço sem
      desktop, a extensão deixa de estar disponível (o Playwright headless continua)
- [ ] Playwright e os browsers dele instalados nos projetos que o usem

## Cópia de segurança

| O quê | Como | Quando |
|---|---|---|
| Configuração (`backend/.env`) | fora do git, num cofre de passwords | ao mudar |
| Dados da app | ❓ depende do `/design-database` (talvez não haja) | — |

As conversas são do Claude Code (`~/.claude/`), não desta app — o backup delas é o da máquina.

## Repor

_(Passos testados, não teóricos — um restore que nunca foi feito não é um backup.)_

## Uma migração que correu mal

1. **Não editar a migração aplicada.**
2. Parar o backend (para não reaplicar nada).
3. Avaliar: corrigir com uma migração nova (preferível) ou repor o backup.
4. Registar o que aconteceu em `notes/learning.md` e, se mudou o procedimento, aqui.

## Relacionado

[[environment]] · [[security]] · [[commands]]
