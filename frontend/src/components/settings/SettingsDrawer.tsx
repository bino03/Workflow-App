import { Button, Drawer } from 'antd';
import { DRAWER_WIDTH } from '@/config/drawer';
import { type LayoutMode, useLayoutMode } from '@/hooks/useLayoutMode';
import { PasskeysSection } from './PasskeysSection';

type SettingsDrawerProps = { open: boolean; onClose: () => void };

const OPTIONS: { value: LayoutMode; title: string; detail: string }[] = [
  { value: 'focus', title: 'Foco dividido', detail: 'A lateral por projetos e um terminal em foco; Alt+\\ divide em dois.' },
  { value: 'grid', title: 'Grelha', detail: 'Todos os terminais em mosaico, 3 colunas; clicar num amplia-o.' },
];

/**
 * Drawer "Definições" (Small, 540): o modo de layout dos terminais — guardado neste browser
 * (localStorage) — e as passkeys, guardadas no servidor (ADR 0015).
 */
export function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const [mode, setMode] = useLayoutMode();

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size={DRAWER_WIDTH.small}
      extra={<span className="kbd">Esc</span>}
      title={
        <div className="flex flex-col gap-1">
          <h6 className="kicker m-0">Definições</h6>
          <h2 className="m-0 text-[20px] leading-[26px] font-semibold text-text-1">Preferências</h2>
        </div>
      }
      footer={
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-text-3">O layout fica guardado neste browser</span>
          <span className="flex-1" />
          <Button type="primary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-2.5">
        <span className="text-[13px] font-semibold">Layout dos terminais</span>
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

      <div className="border-t border-border my-6" />
      {/* Só monta com o drawer aberto: a lista carrega quando se abre, não com a app. */}
      {open && <PasskeysSection />}
    </Drawer>
  );
}
