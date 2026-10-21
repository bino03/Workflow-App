import { Button } from 'antd';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { ErrorHandler } from '@/errors/errorHandler';
import { bindingFromEvent, formatBinding, MODIFIER_CODES, sameBinding } from '@/keyboard/shortcuts';
import type { KeyBinding, ShortcutView, ShortcutWarning } from '@/types/keybindings';

type ShortcutCaptureProps = {
  action: ShortcutView;
  actions: ShortcutView[];
  warnings: ShortcutWarning[];
  /** Grava; um erro sobe para aqui e aparece inline. */
  onSave: (binding: KeyBinding) => Promise<void>;
  onCancel: () => void;
};

/**
 * Captura da combinação de uma ação (spec atalhos-editaveis §4.4). Apanha a tecla seguinte com
 * `stopPropagation`, para nem os atalhos da app nem o Esc do Drawer a verem. Esc cancela. A colisão com
 * outra ação vê-se aqui, com o nome dela (o 409 do backend é a rede de segurança); o resto das regras de
 * teclas é do backend, que responde KEYBIND_001.
 */
export function ShortcutCapture({ action, actions, warnings, onSave, onCancel }: ShortcutCaptureProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ binding: KeyBinding; reason: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => ref.current?.focus(), []);

  const save = async (binding: KeyBinding) => {
    setSaving(true);
    try {
      await onSave(binding);
    } catch (e) {
      ErrorHandler.handle(e, { showNotification: false });
      setError(ErrorHandler.getMessage(e));
      setPending(null);
      ref.current?.focus();
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') return; // sai do campo, e o blur cancela
    event.preventDefault();
    event.stopPropagation();
    if (saving) return;
    if (event.key === 'Escape') return onCancel();
    if (MODIFIER_CODES.has(event.code)) return; // o Alt sozinho: espera pela tecla

    setPending(null);
    const binding = bindingFromEvent(event.nativeEvent);
    if (!binding) return setError('Usa Alt ou AltGr com outra tecla, sem Ctrl, Shift ou Meta.');
    const taken = actions.find((other) => other.id !== action.id && sameBinding(other.binding, binding));
    if (taken) return setError(`${formatBinding(binding)} já é usada por "${taken.label}". Muda ou remove essa primeiro.`);

    setError(null);
    const warning = warnings.find((candidate) => sameBinding(candidate, binding));
    if (warning) return setPending({ binding, reason: warning.reason });
    void save(binding);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={ref}
        tabIndex={0}
        data-shortcut-capture={action.id}
        aria-label={`Nova combinação para ${action.label}`}
        onKeyDown={handleKeyDown}
        // Com um aviso à espera, o foco vai para os botões — não pode cancelar.
        onBlur={() => !pending && !saving && onCancel()}
        className="px-3 py-[7px] rounded-md border border-accent-border bg-accent-subtle text-[12.5px] text-text-2 outline-none"
      >
        {pending ? <span className="kbd">{formatBinding(pending.binding)}</span> : 'Carrega na combinação… (Esc cancela)'}
      </div>
      {error && (
        <span className="text-[12px] text-error" role="alert">
          {error}
        </span>
      )}
      {pending && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] text-warning" role="alert">
            {pending.reason} Com o atalho, essa tecla deixa de chegar ao terminal.
          </span>
          <div className="flex gap-2">
            <Button size="small" type="primary" loading={saving} onClick={() => void save(pending.binding)}>
              Gravar mesmo assim
            </Button>
            <Button size="small" onClick={onCancel} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
