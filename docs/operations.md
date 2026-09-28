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

## Ver uma app em desenvolvimento a partir de outro dispositivo

> 🚧 Decidido em conversa (2026-09-28), ainda por montar. **Depende da forma de exposição** (ADR por
> escrever, [[adr/README]] → "Como expor fora de casa"); os comandos abaixo assumem Tailscale, a opção que
> tem estado à frente.

Para testar à mão uma app em que o Claude está a trabalhar no desktop **não se faz push/pull**: a app corre
no desktop e o dispositivo abre um URL que chega lá.

**Privado, não público.** O caminho é a rede privada (tailnet) — só os dispositivos do dono a veem:

```
# no desktop, com a app em dev (ex.: Vite na 5173)
tailscale serve --bg --https=8443 http://localhost:5173
# no dispositivo: https://<desktop>.<tailnet>.ts.net:8443
# desligar: tailscale serve --https=8443 off
```

HTTPS a sério, sem portas abertas no router, e o `serve` faz proxy para `localhost` — a app **não** precisa de
escutar em `0.0.0.0`. Uma porta HTTPS por app ao mesmo tempo (8443, 8444, …).

**Público só para mostrar a outra pessoa**, temporário e com autenticação à frente (`tailscale funnel` ou
Cloudflare Tunnel + Access), desligado no fim. Uma app em dev (servidor do Vite, endpoints de debug, BD de
desenvolvimento — às vezes com dados reais —, por vezes sem login) não é para a internet; mesmo princípio de
[[adr/0004-exposicao-e-modelo-de-ameaca]].

**⚠️ Armadilha: o `localhost` da API.** Se o frontend da app em teste chama a API em
`http://localhost:8080`, no browser do dispositivo `localhost` é **o dispositivo** — a página abre, mas sem
dados. Correção: **uma só origem** — o frontend chama `/api` (caminho relativo) e o proxy do servidor de dev
(`server.proxy` no Vite) reencaminha para `localhost:8080` dentro do desktop. Assim expõe-se uma porta só e
não há CORS. Outros sítios onde o URL novo tem de entrar:
- *redirect URLs* do login (Supabase Auth ou equivalente);
- `CORS_ALLOWED_ORIGINS`/equivalente, se a app não usar o proxy;
- `server.allowedHosts` do Vite (recusa hosts que não conhece — acrescentar `.ts.net`).

**Posto de parte**: pôr esta app (a Workflow App) a fazer de proxy da app em teste (`/preview/<projeto>`).
Possível, mas o WebSocket de hot reload do Vite, os caminhos base e os cookies da app em teste complicam
muito — o `tailscale serve` resolve com uma linha. A app pode, no máximo, **mostrar** o link
([[../notes/ideas]] → Pré-visualizar).

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
