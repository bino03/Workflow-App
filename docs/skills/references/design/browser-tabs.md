# Browser Tabs

> 🚧 Código verificado por tipo/lint/testes; **sem verificação visual no browser ainda** — ver
> [[../../../../notes/verificacao-browser-pendente|verificacao-browser-pendente]]. Baseado em
> `frontend/src/components/terminals/ProjectTabs.tsx`, escrito na spec
> [[../../../features/separadores-de-projetos|separadores de projetos]] (2026-09-28). Sem protótipo do
> Claude Design — desenhado só com tokens.

> Parte de [[../frontend-visual-consistency]].

## Quando usar

Uma faixa de separadores tipo browser por cima da área principal, quando o utilizador navega entre
vários contextos abertos ao mesmo tempo (um por projeto, um por documento) e "fechar" um separador não
deve destruir o que lá está — só escondê-lo.

## Estrutura

```tsx
<div role="tablist" aria-label="Projetos abertos"
     className="h-10 flex-none flex items-end gap-1 px-2 pt-1.5 bg-surface-1 border-b border-border overflow-x-auto">
  {items.map((item) => (
    <div role="tab" aria-selected={active} onClick={() => onSelect(item.path)}
         className={`group h-[34px] flex-none flex items-center gap-2 pl-3 pr-2 rounded-t-md border border-b-0 cursor-pointer max-w-[220px] ${
           active ? 'bg-bg border-border-strong text-text-1' : 'bg-surface-2 border-transparent text-text-2 hover:bg-surface-3'
         }`}>
      <span className="truncate text-[13px] font-medium">{item.name}</span>
      {/* indicador de estado opcional, ex.: contagem a correr, em text-3 mono */}
      <button aria-label={`Esconder separador de ${item.name}`}
              onClick={(e) => { e.stopPropagation(); onClose(item.path); }}
              className="flex-none w-4 h-4 flex items-center justify-center rounded-sm bg-transparent border-0 text-text-3 opacity-0 group-hover:opacity-100 hover:bg-surface-3 hover:text-text-1">
        <CloseOutlined style={{ fontSize: 10 }} />
      </button>
    </div>
  ))}
</div>
```

- **Separador ativo**: `bg-bg` + `border-border-strong` + `text-text-1` (destaca-se do resto, que fica em
  `bg-surface-2`/`text-text-2`).
- **× de fechar**: só visível a `hover` do separador (`opacity-0 group-hover:opacity-100`); `stopPropagation`
  para não selecionar o separador ao clicar nele. "Fechar" aqui é semântico — esconde, nunca mata o que o
  separador representa (o backend/processo por trás continua vivo).
- **Overflow**: `overflow-x-auto` na faixa — não faz wrap nem menu "mais", com poucos separadores esperados
  ao mesmo tempo.
- **Vazio**: a faixa não renderiza nada (`return null`) quando não há nenhum separador aberto.

## Drift encontrado — não copiar

_Nenhum ainda._

## Relacionado

[[tokens-and-colors]] · [[buttons-and-icons]] · [[../../../features/separadores-de-projetos]]
