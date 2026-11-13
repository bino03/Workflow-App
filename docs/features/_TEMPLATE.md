# Feature: <Nome>

| | |
|---|---|
| **Estado** | 🚧 Em curso · ✅ Concluída · ⏸️ Pausada · 📋 Planeada |
| **Criada** | AAAA-MM-DD |

> Escrita para uma sessão que **não viu a conversa que a originou**. Se algo só faz sentido com contexto
> externo, falta escrevê-lo.

> 📌 Desenhada via `/plan-feature` a AAAA-MM-DD. <Que entradas do ToDo/ideias substitui ou funde.>
> As fases estão no ToDo, um bullet cada; **o porquê de cada decisão vive aqui**. O progresso não: é do
> plano do `/implement-todo`.

---

## 1. O que é e porquê

<2-4 frases. O problema, não a solução.>

**Como sei que está bem feito:** <o momento concreto de uso, e por quem>

## 2. Âmbito

### Dentro
- …

### ⛔ Fora — não implementar nesta feature
- …

> Esta lista impede uma sessão futura de expandir o âmbito sozinha.

### Segunda fase (se houver)
- …

## 3. O ponto de partida e as decisões

**O que existe hoje** (com `file:line` e contagens — o que se reaproveita e o molde a seguir):
- …

| Decisão | Escolha | Porquê | Alternativa rejeitada |
|---|---|---|---|
| | | | |

**ADRs gerados:** <ADR-NNNN, ou "nenhum">

## 4. Desenho técnico

### 4.1 Dados
<tabelas e colunas concretas (SQL), ou — se o estado persistido não é uma BD — as coleções/ficheiros e a sua forma>

### 4.2 Endpoints
| Método | Rota | Acesso | Descrição |
|---|---|---|---|

### 4.3 Tipos / DTOs
### 4.4 Interface
- **Onde vive** · **Como se chega lá** · **Ficheiros** · **Estado vazio** · **Visibilidade por role**

### 4.5 Códigos de erro novos
| Código | HTTP | Mensagem no frontend |
|---|---|---|

## 5. As fases, na ordem das dependências

Cada fase **entra em uso sozinha**. Tiers: `opus` (ainda há uma decisão, ou mexe em permissões, schema
partilhado, segurança — na dúvida, `opus`) · `sonnet` (o desenho está fechado aqui).

**Sessões**: fases <1-2> em `opus` · <3-5> em `sonnet` — abrir cada sessão no modelo do bloco que vai fazer.

### Fase 1 — <o que passa a ser possível>
- **Ficheiros**: `<caminhos concretos>`
- **Skill**: `skill-…` (ou as convenções da camada + o ficheiro irmão a imitar)
- **Tier**: `sonnet`
- **Aceite quando**: <critério verificável>

## 6. Perguntas em aberto

| Pergunta | Bloqueia | Notas |
|---|---|---|

## Relacionado

[[skill-plan-feature]] · [[skill-implement-todo]] · [[../adr/README]]
