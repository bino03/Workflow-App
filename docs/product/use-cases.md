# Casos de uso

> 🚧 Da entrevista de criação. Refinar à medida que as features são planeadas.

## Papéis

| Papel | O que pode fazer | O que vê |
|---|---|---|
| Dono (único utilizador) | Tudo: abrir/fechar/retomar terminais, escrever neles, navegar a biblioteca | Tudo |

Sem roles: não há um segundo papel. O login existe para **impedir** qualquer outra pessoa, não para
distinguir permissões.

## Ecrãs do MVP

> ❓ **Em standby** — "tudo do frontend também ainda vou desenhar mais tarde". Proposta de partida,
> a confirmar no `/choose-design`:

| Ecrã | Para quê | Estado |
|---|---|---|
| Terminais | Sessões abertas (separadores ou grelha), novo terminal (pasta, retomar), fechar, quota à vista | ❓ proposta |
| Biblioteca | Registo de stacks, designs e skills, com a maturidade de cada um | ❓ proposta |
| Login | Entrar (um só utilizador) | necessário |

**Se só se desenharem dois ecrãs, que sejam:** Terminais e Biblioteca (proposta — os ecrãs estão em standby)

## Casos de uso

- O dono **abre um terminal** numa pasta que escolhe, e fica com uma sessão do Claude Code nova.
- O dono **retoma uma sessão** anterior dessa pasta (`--resume`), para continuar onde a deixou.
- O dono **escreve** num terminal (mensagens, `/skills`, atalhos de teclado) e vê a resposta em tempo real.
- O dono **acompanha várias sessões** em paralelo e percebe qual está a trabalhar, qual espera por ele e qual terminou.
- O dono **fecha** um terminal; a sessão fica gravada pelo Claude Code e pode ser retomada.
- O dono **vê quanto da quota** da subscrição já gastou antes de abrir mais sessões — a quota é da conta, não do terminal.
- O dono **consulta a biblioteca** do Workflow (que stacks e designs existem, quão maduros são, que skills há) sem abrir o Obsidian.
- (Futuro) O dono **lança o `/create`** a partir de um formulário.

## Relacionado

[[overview]] · [[design-brief]] · [[../security]]
