# Skill: Choose Design

**When to use**: o design ainda não foi escolhido (o `tokens-and-colors.md` tem o marcador
`design:pending`), antes de construir qualquer ecrã — ou quando a identidade visual tem de mudar.

**Time**: ~15 min (via biblioteca) · ~30-60 min (via net) · ~20 min + o tempo no Claude Design (via Claude Design)

> 📐 Lê primeiro [[frontend-visual-consistency]] e [[design/tokens-and-colors]] — as secções fixas de
> tokens são o destino de qualquer via.

---

## Step 0: Contexto (sempre)

Ler, para não perguntar o que já está escrito:
- `docs/product/overview.md`, `use-cases.md` (ecrãs-chave), `design-brief.md`, `project-profile.md`
- [[project-vocabulary]] (o domínio, em PT)
- A stack de frontend (`docs/frontend-conventions.md`) — biblioteca de componentes, Tailwind, i18n
- A decisão de responsivo em [[design/app-shell-and-auth]]

Se o design **já** estava escolhido: confirmar que é para mudar, e avisar que os ecrãs existentes vão
ser revistos (listar quantos ficheiros de UI existem).

## Step 1: A via

`AskUserQuestion`:
- **Um design da biblioteca do Workflow** — reutilizar uma identidade já provada
- **Importar da net** — um design system público, a documentação de uma marca, ou uma skill/guia externo
- **Desenhar no Claude Design** — gero um prompt com o contexto desta app; trazes de volta o resultado

---

## Via A — Biblioteca do Workflow

1. Ler `C:\Users\jlalv\Desktop\Workflow\Workflow/library/frontend/themes/README.md` (registo) e o `THEME.md` de cada design. Se o
   caminho não existe nesta máquina, dizer e oferecer as vias B ou C.
2. Filtrar pelos mesmos critérios do `/create` (stack de frontend, `mode`/`density`, `not-suits` face ao
   produto) e mostrar os que servem — nome, carácter, "serve para", contraste — com
   `AskUserQuestion`. Nenhum serve → dizer porquê e oferecer B ou C.
3. Copiar as secções de `themes/<id>/tokens.md` → **Step 4 (importar)**.

## Via B — Importar da net

1. Perguntar a fonte (texto): URL de um design system (ex.: um tema público de uma biblioteca de
   componentes, um guia de marca), uma skill/documentação externa, ou "procura tu" com 2-3 palavras sobre
   o carácter pretendido.
2. "Procura tu" → pesquisar e propor **no máximo 3** candidatos, cada um com: fonte, licença, carácter,
   se tem tokens explícitos (ou só screenshots), e compatibilidade com a stack. Escolha por `AskUserQuestion`.
3. **Ler a fonte** (WebFetch) — nunca decidir pelo título. Verificar a **licença**: fontes e ícones
   pagos, ou um design de marca de terceiros, não se copiam — dizer e parar essa opção.
4. Extrair para as secções fixas de tokens (cores + escalas, semânticas, tipografia, espaçamento/raios,
   sombras, movimento, padrões). O que a fonte não define → derivar (escalas a partir da cor base) e
   **marcar como derivado**.
5. → **Step 4 (importar)**.

## Via C — Claude Design

### C.1 Perguntas de gosto (em bloco — o resto do contexto já está escrito)

1. **Tema**: claro · escuro · os dois
2. **Tom** (2-3 palavras): ex. "sério e denso", "acolhedor e simples", "técnico e preciso"
3. **Referências** que gostes (apps, sites) — e o que **não** queres
4. **Cor**: alguma cor obrigatória (marca) ou a evitar?
5. **Quantas propostas** queres ver: 1 direta · 2-3 para escolher (omissão: 2-3)

### C.2 Gerar o prompt

Escrever `notes/design-briefs/AAAA-MM-DD-claude-design-prompt.md` com esta estrutura (em PT, auto-contido
— quem o lê **não tem acesso ao repo**):

```markdown
# Prompt para Claude Design — Workflow App

## Contexto do projeto
<o que é, o problema que resolve, em que fase está — do overview>

## Quem usa, onde e como
<utilizadores, papéis, contexto físico de uso (dispositivo, pressa, luz, mãos ocupadas), frequência —
 do design-brief. Implicações: alvos de toque, contraste, densidade>

## O domínio
<as entidades e o vocabulário da UI, em PT (a UI é em pt-PT) — do project-vocabulary>

## Ecrãs
<lista dos ecrãs do MVP e, destacados, os 2-3 que quero desenhados primeiro — com o que cada um mostra e
 que ações tem>

## Padrões de interação que a app já segue (não reinventar)
- Criar/editar/ver uma entidade abre um painel lateral (Drawer) com cabeçalho e rodapé fixos; Modal só
  para utilitários curtos
- Listas: kicker + título + ação principal; tabela com coluna de ações com texto (Ver/Editar/Eliminar);
  rodapé com contagem e paginação
- Ações destrutivas pedem confirmação num diálogo
- <outros padrões de docs/skills/references/ux-patterns.md que importem para estes ecrãs>

## O que o design deve transmitir
<tom da C.1; o que evitar; se há negócio-piloto: "a interface não pode parecer a app do primeiro cliente">

## Preferências
<tema, cores obrigatórias/a evitar, referências; se pedi 2-3 propostas: "sugere 2-3 paletas completas e
 2-3 combinações tipográficas para eu escolher">

## Restrições técnicas
- Stack: <da frontend-conventions — ex.: React + Vite + TypeScript + Ant Design 5 + Tailwind 4>
- Tokens como CSS custom properties (`--wfa-*`) — o tema da biblioteca de componentes vai
  espelhá-los; nada de valores soltos
- <responsivo ou não (decisão do projeto)>, acessibilidade WCAG AA mínimo, `prefers-reduced-motion`
- Idioma da UI: pt-PT

## Resultado esperado
1. Paleta completa: fundo, superfície, texto primário/secundário, divisor, acento + hover, escalas
   100-900 de neutro e acento, cores semânticas (sucesso/aviso/erro/info) — em hex, com os rácios de
   contraste dos pares de texto
2. Tipografia: famílias (Google Fonts, com link), escala de tamanhos e pesos por nível
3. Espaçamento, raios, sombras/elevação, movimento (durações e easing)
4. Os ecrãs pedidos, em alta fidelidade
5. Um handoff com os tokens em tabela e os protótipos (HTML/CSS) como referência — não como código final
```

Mostrar o caminho do ficheiro e o prompt ao utilizador: "cola isto no Claude Design; quando tiveres o
resultado, volta a correr `/choose-design` → Claude Design → **importar resultado**, e dá-me a pasta ou os
ficheiros".

Registar no plano/ToDo que a escolha está **à espera do Claude Design** (o marcador `design:pending`
fica até ao Step 4).

### C.3 Importar o resultado (quando o utilizador volta)

O Claude Design devolve normalmente um **handoff**: um `README.md` com tabelas de tokens (cores, tipografia,
espaçamento, movimento) + protótipos `.html`/`.css`/`.jsx`. Então:
1. Guardar o handoff em `docs/design/handoff-AAAA-MM-DD/` (versionado — é a referência visual).
2. Extrair os tokens do README (e do `.css`, onde as custom properties são a verdade) para as secções fixas.
3. Se vieram **várias propostas**, perguntar qual (as outras ficam registadas no ADR como alternativas).
4. Os protótipos são **referência, não código**: o que se implementa segue as skills do projeto.
5. → **Step 4 (importar)**.

---

## Step 4: Importar para o projeto (todas as vias)

1. **Contraste**: calcular os rácios WCAG dos pares de texto (texto/fundo, secundário/fundo,
   texto/superfície, acento como texto). Um par abaixo de 4.5:1 para texto normal → dizer, e propor o tom
   da escala que passa (ex.: `accent-700` para links).
2. **`docs/skills/references/design/tokens-and-colors.md`**: valores reais nas secções; **apagar o
   marcador `<!-- design:pending -->`** e o aviso ⛔; topo passa a "Design: <nome> (via <biblioteca | net:
   url | Claude Design, handoff de AAAA-MM-DD>)".
3. **Código** (se o frontend já tem scaffold): `index.css` com os tokens, `theme.ts`/`@theme` a espelhá-los,
   import das fontes. Se ainda não há scaffold, a tarefa de tokens da Fundação passa a usar estes valores.
4. **Outras referências de design**: rever `cards`, `tables-and-lists`, `buttons-and-icons` — raios, sombras,
   pele da tabela e classes utilitárias passam a ter os valores do design.
5. **ADR** `docs/adr/NNNN-identidade-visual.md`: contexto (design-brief), opções consideradas (as propostas
   / candidatos / designs da biblioteca vistos), decisão, consequências.
6. `docs/product/design-brief.md` §7 → o design escolhido, com link para o ADR.
7. `CLAUDE.md` e `00-INDEX.md`: remover o aviso ⛔ de design pendente.
8. `notes/ToDo.md`: remover a tarefa "⛔ Escolher o design"; `notes/whatIveDone.md`: entrada nova.
9. Se já havia ecrãs feitos sobre os tokens provisórios → item em `notes/ToDo.md` para os rever.

## Step 5: Devolver ao Workflow (opcional)

Se o design veio da net ou do Claude Design e pode servir outros projetos: perguntar se o utilizador quer
acrescentá-lo à biblioteca. Se sim, dizer-lhe para correr **no Workflow** `/add-new-design` apontado a este
projeto (a skill lê o `tokens-and-colors.md`, o handoff e o ADR daqui). Não escrever no Workflow a partir
deste projeto.

## Final Checklist

- [ ] Contexto lido antes de perguntar
- [ ] Via escolhida; na via B, fonte lida e licença verificada; na via C, prompt gerado e guardado
- [ ] Tokens nas secções fixas; valores derivados assinalados
- [ ] Contraste WCAG AA verificado (e corrigido/avisado)
- [ ] `tokens-and-colors.md` com valores reais e **sem** `design:pending`
- [ ] Código (se existe) com `index.css` + `theme.ts`/`@theme` + fontes
- [ ] Referências de design revistas
- [ ] ADR de identidade visual; design-brief §7; avisos removidos de `CLAUDE.md`/`00-INDEX.md`
- [ ] ToDo e whatIveDone atualizados; ecrãs antigos marcados para revisão
- [ ] Oferecido `/add-new-design` no Workflow, se fizer sentido

## Related Skills

[[skill-frontend-design-system]] · [[skill-frontend-structure-brief]] (para briefs de redesign de um ecrã concreto) · [[frontend-visual-consistency]]
