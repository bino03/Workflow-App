import { type LayoutMode, useLayoutMode } from '@/hooks/useLayoutMode';

const OPTIONS: { value: LayoutMode; title: string; detail: string }[] = [
  { value: 'focus', title: 'Foco dividido', detail: 'A lateral por projetos e um terminal em foco; Alt+\\ divide em dois.' },
  { value: 'grid', title: 'Grelha', detail: 'Todos os terminais em mosaico, 3 colunas; clicar num amplia-o.' },
];

/** Secção "Layout dos terminais" das Definições: o modo vive no localStorage, por isso é deste browser. */
export function LayoutSection() {
  const [mode, setMode] = useLayoutMode();

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[12.5px] text-text-3">O layout fica guardado neste browser.</span>
      <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Layout dos terminais">
        {OPTIONS.map((option) => {
          const selected = option.value === mode;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              data-layout={option.value}
              onClick={() => setMode(option.value)}
              className={`w-full text-left flex items-center gap-3 px-3 py-[9px] rounded-md border cursor-pointer bg-transparent ${
                selected ? 'border-accent-border bg-accent-subtle' : 'border-border hover:bg-surface-2'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex-none flex items-center justify-center border-[1.5px] ${selected ? 'border-accent' : 'border-border-strong'}`}
                aria-hidden
              >
                <span className={`w-2 h-2 rounded-full ${selected ? 'bg-accent' : ''}`} />
              </span>
              <span className="flex flex-col gap-px">
                <span className="text-[13.5px] font-medium text-text-1">{option.title}</span>
                <span className="text-[12.5px] text-text-3">{option.detail}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
