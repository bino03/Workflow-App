---
tags: [adr]
status: aceite
data: 2026-09-27
---

# 0008 — Identidade visual: Violeta + Geist, dois layouts de terminais, só desktop

## Contexto

O [[../product/design-brief|design-brief]] pedia uma moldura à volta de terminais do Claude Code: a
TUI de cada terminal é desenhada pelo próprio Claude Code (cores ANSI), a app desenha **à volta**. Um
só utilizador, sessões longas com 2–6 terminais em paralelo, e a necessidade de perceber de relance
qual está a trabalhar, qual espera por ele e qual terminou.

O design foi feito no **Claude Design** (via C do `/choose-design`) a partir do prompt
[[../../notes/design-briefs/2026-09-27-claude-design-prompt]]. As respostas de gosto do dono foram:
- só tema escuro;
- tom "algo simples e fácil de interpretar, mas mais puxado para algo dark, tipo super computador do
  Batman";
- cores livres;
- 2–3 propostas para escolher;
- layout e referências deixados ao Claude Design;
- sem tratamento responsivo.

O handoff está em [[../design/handoff-2026-09-27/README|docs/design/handoff-2026-09-27]]. A fonte é o
projeto do Claude Design `abd7bfde-c219-45df-ad39-c4d72aada246`.

## Opções consideradas

**Paletas** (as três com o mesmo esqueleto de superfícies por luminosidade e as 16 ANSI ≥ 4.5:1):

| Paleta | Carácter | Estados |
|---|---|---|
| Gelo (1a) | Aço frio, acento gelo `#7CD6F2`. A mais sóbria; recomendada pelo Claude Design | verde / âmbar / cinza / vermelho |
| **Violeta (1b)** ✅ | Preto azulado, acento violeta elétrico `#A88FFF`. Foco e ações muito evidentes | verde / âmbar / cinza / vermelho |
| Sinal (1c) | Preto quente, acento amarelo-sinal `#F9D544`. A mais dramática | ciano / magenta / cinza / vermelho |

**Tipografia**:

| Combinação | Carácter |
|---|---|
| Plex (1d) | IBM Plex Sans + Plex Mono. Técnica e neutra |
| **Geist (1e)** ✅ | Geist + Geist Mono. Contemporânea e compacta; zero cortado |
| Consola (1f) | Chakra Petch (títulos em maiúsculas) + Barlow + JetBrains Mono. A mais "consola"; recomendada pelo Claude Design |

**Layout dos terminais**: foco (1g), foco dividido (1h), grelha (1i). A sugestão do Claude Design era
o foco como modo principal e a grelha como vista "visão geral" (Alt+G).

## Decisão

1. **Paleta Violeta, só escura.** O dono escolheu-a pelo acento. O violeta fica longe das cores de
   estado (verde, âmbar, vermelho), por isso foco e estado nunca se confundem.
2. **Tipografia Geist** (Geist + Geist Mono), escolha do dono. Títulos sem maiúsculas.
3. **Dois modos de layout dos terminais, escolhidos pelo utilizador nas Definições**:
   - **Foco dividido**, por omissão: lateral com lista e quota, um terminal em foco, e `Alt+\` para
     dividir em dois.
   - **Grelha**: todos em cartões 3×2.

   Não há uma vista "visão geral" separada: a grelha é um modo em si.
4. **Estados com cor e forma**:
   - arco para "a trabalhar";
   - losango cheio para "à tua espera";
   - quadrado vazio para "terminado";
   - ✕ para erro.

   As cores de estado são reservadas aos estados.
5. **Atalhos da app em `Alt+…`**. `Ctrl+…` fica para o Claude Code e o browser, e `Ctrl+Alt+…` é AltGr
   num teclado PT.
6. **Sem tratamento responsivo**: só desktop e portátil, a partir de 1280 px. Isto fecha o ponto
   "Responsivo ❓ em aberto" do [[0007-omissoes-do-frontend]].
7. O terminal usa como fundo o `--wfa-color-bg`, de modo que se funde com a página.

Os valores ficam em [[../skills/references/design/tokens-and-colors]]. Os protótipos são referência,
não código.

## Consequências

- Contraste verificado: todos os pares de texto ≥ 4.5:1 (mínimo 5.5, estados stop/err sobre o próprio
  fundo tingido). **A escala do acento é invertida face a um tema claro**: 600–900 são escuros e não
  servem como texto (o `accent-700` sobre o fundo dá 1.6:1). O kicker usa `--wfa-color-accent`.
- O tema do Ant Design passa a `darkAlgorithm`, com `colorTextLightSolid` escuro (texto escuro sobre o
  violeta). Pode afetar outros componentes que usem esse token; vê-se no scaffold.
- **O modo de layout é uma preferência que tem de persistir.** Onde se guarda (browser ou backend)
  decide-se no `/design-database`. Até lá, a app arranca sempre em foco dividido.
- Aparece um drawer de **Definições** no menu de utilizador. Fica fora do MVP original e entra como
  tarefa própria.
- Uso em telemóvel/tablet fica explicitamente fora. Reabrir exige um ADR novo.
- A tipografia recomendada pelo Claude Design (JetBrains Mono) foi preterida. Se a Geist Mono se
  mostrar pouco legível a 13 px no xterm.js real, trocar só a mono é uma mudança de token, não de
  identidade.

## Estado

`aceite`
