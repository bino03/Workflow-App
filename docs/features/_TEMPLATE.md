# Feature: <Nome>

| | |
|---|---|
| **Estado** | 🚧 Em curso · ✅ Concluída · ⏸️ Pausada · 📋 Planeada |
| **Criada** | AAAA-MM-DD |
| **Última sessão** | AAAA-MM-DD |
| **Passos** | 0 / N concluídos |

> Escrita para uma sessão que **não viu a conversa que a originou**. Se algo só faz sentido com contexto
> externo, falta escrevê-lo.

---

## 1. O que é e porquê

<2-4 frases. O problema, não a solução.>

**Como sei que está bem feito:** <o momento concreto de uso>

## 2. Âmbito

### Dentro
- …

### ⛔ Fora — não implementar nesta feature
- …

> Esta lista impede uma sessão futura de expandir o âmbito sozinha.

### Segunda fase (se houver)
- …

## 3. Decisões tomadas

| Decisão | Escolha | Porquê | Alternativa rejeitada |
|---|---|---|---|
| | | | |

**ADRs gerados:** <ADR-NNNN, ou "nenhum">

## 4. Desenho técnico

### 4.1 Dados
```sql
-- tabelas e colunas concretas
```

### 4.2 Endpoints
| Método | Rota | Acesso | Descrição |
|---|---|---|---|

### 4.3 Tipos / DTOs
### 4.4 Interface
- **Onde vive** · **Como se chega lá** · **Ficheiros** · **Estado vazio** · **Visibilidade por role**

### 4.5 Códigos de erro novos
| Código | HTTP | Mensagem no frontend |
|---|---|---|

## 5. Passos

Ordem obrigatória. Tiers: `opus` (desenho, não delegar) · `sonnet` (implementação) · `haiku` (mecânico).

- [ ] **1. <título>**
  - Ficheiro: `<caminho concreto>`
  - Skill: `skill-…`
  - Tier: `sonnet`
  - Aceite quando: <critério verificável>

## 6. Estado atual

> ⚠️ **Atualizar SEMPRE no fim de cada sessão.** É a secção que torna esta spec retomável.

**Feito:** …
**Em curso:** <passo, e o que exatamente falta>
**Próxima ação concreta:** <ficheiro:linha ou comando exato>
**Desvios ao plano:** …
**O que uma sessão nova precisa de saber:** …

## 7. Perguntas em aberto

| Pergunta | Bloqueia | Notas |
|---|---|---|

## Relacionado

[[skill-plan-feature]] · [[skill-implement-todo]] · [[../adr/README]]
