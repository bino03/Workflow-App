import { Button, Spin } from 'antd';
import { useState } from 'react';
import { ErrorHandler } from '@/errors/errorHandler';
import { useConfirm } from '@/hooks/useConfirm';
import { useKeybindings } from '@/hooks/useKeybindings';
import { formatBinding, sameBinding } from '@/keyboard/shortcuts';
import type { ShortcutGroup, ShortcutView } from '@/types/keybindings';
import { ShortcutCapture } from './ShortcutCapture';

const GROUPS: { group: ShortcutGroup; title: string }[] = [
  { group: 'terminals', title: 'Terminais' },
  { group: 'jump', title: 'Saltar para um terminal' },
  { group: 'projects', title: 'Projetos' },
  { group: 'navigation', title: 'Navegação' },
];

const isDefault = (action: ShortcutView) =>
  action.binding === null ? action.default === null : sameBinding(action.binding, action.default);

/** Secção "Atalhos" das Definições (ADR 0016): mudar, remover e repor as binds, guardadas no servidor. */
export function ShortcutsSection() {
  const { view, setBinding, resetBinding, resetAll } = useKeybindings();
  const confirm = useConfirm();
  const [capturingId, setCapturingId] = useState<string | null>(null);

  const run = async (change: () => Promise<void>) => {
    try {
      await change();
    } catch (e) {
      ErrorHandler.handle(e);
    }
  };

  const confirmResetAll = () =>
    confirm({
      title: 'Repor os atalhos predefinidos?',
      actionLabel: 'Repor',
      danger: false,
      message: 'As tuas alterações perdem-se. As ações que não tinham atalho ficam outra vez sem atalho.',
      onConfirm: () => run(resetAll),
    });

  const changed = view?.actions.some((action) => !isDefault(action)) ?? false;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold">Atalhos</span>
        <span className="flex-1" />
        {changed && (
          <Button size="small" onClick={confirmResetAll}>
            Repor predefinidos
          </Button>
        )}
      </div>
      <span className="text-[12.5px] text-text-3">
        Alt com uma letra, um número ou pontuação; AltGr só com o ponto. Uma combinação com atalho deixa de chegar
        ao terminal.
      </span>

      {view === null ? (
        <Spin size="small" />
      ) : (
        GROUPS.map(({ group, title }) => (
          <div key={group} className="flex flex-col gap-1.5">
            <span className="kicker mt-1">{title}</span>
            <ul className="flex flex-col gap-1.5 m-0 p-0 list-none" aria-label={`Atalhos — ${title}`}>
              {view.actions
                .filter((action) => action.group === group)
                .map((action) => (
                  <li
                    key={action.id}
                    data-shortcut-id={action.id}
                    className="flex flex-col gap-1.5 px-3 py-[7px] rounded-md border border-border"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex-1 min-w-0 text-[13px] text-text-1 truncate">{action.label}</span>
                      {action.binding ? (
                        <span className="kbd" data-shortcut-binding>
                          {formatBinding(action.binding)}
                        </span>
                      ) : (
                        <span className="text-[12px] text-text-3">sem atalho</span>
                      )}
                      <Button type="text" size="small" onClick={() => setCapturingId(action.id)}>
                        Alterar
                      </Button>
                      {action.binding && (
                        <Button type="text" size="small" onClick={() => void run(() => setBinding(action.id, null))}>
                          Remover
                        </Button>
                      )}
                      {!isDefault(action) && (
                        <Button type="text" size="small" onClick={() => void run(() => resetBinding(action.id))}>
                          Repor
                        </Button>
                      )}
                    </div>
                    {capturingId === action.id && (
                      <ShortcutCapture
                        action={action}
                        actions={view.actions}
                        warnings={view.warnings}
                        onSave={async (binding) => {
                          await setBinding(action.id, binding);
                          setCapturingId(null);
                        }}
                        onCancel={() => setCapturingId(null)}
                      />
                    )}
                  </li>
                ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
