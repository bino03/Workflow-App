import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { SETTINGS_SECTIONS } from '@/components/settings/settingsSections';

// Folga a partir do topo do contentor: a secção que já passou esta linha é a "atual".
const ACTIVE_OFFSET = 96;
const FIRST_ID = SETTINGS_SECTIONS[0]?.id ?? '';
const LAST_ID = SETTINGS_SECTIONS.at(-1)?.id ?? '';

/** Definições (rota /settings): todas as secções seguidas, com um índice fixo à esquerda que acompanha o scroll. */
export function SettingsPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState(FIRST_ID);

  useEffect(() => {
    // O scroll é do <main> do AppLayout, não da janela.
    const container = rootRef.current?.closest('main');
    if (!container) return;
    // O <main> é o mesmo em todas as rotas e guarda o scroll da página anterior.
    container.scrollTop = 0;

    const update = () => {
      const top = container.getBoundingClientRect().top;
      const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 2;
      if (atBottom && container.scrollTop > 0) {
        setActiveId(LAST_ID);
        return;
      }
      let current = FIRST_ID;
      for (const section of SETTINGS_SECTIONS) {
        const element = document.getElementById(`settings-${section.id}`);
        if (element && element.getBoundingClientRect().top - top <= ACTIVE_OFFSET) current = section.id;
      }
      setActiveId(current);
    };

    update();
    container.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      container.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const jumpTo = (id: string) => {
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
  };

  return (
    <div ref={rootRef} className="flex flex-col">
      <PageHeader kicker="Definições" title="Preferências" />

      <div className="px-[var(--wfa-page-gutter)] pt-4 pb-16 flex gap-10 items-start">
        <nav
          aria-label="Índice das definições"
          data-settings-index
          className="sticky top-[calc(var(--wfa-header-height)+16px)] flex-none w-[200px]"
        >
          <ul className="flex flex-col gap-0.5 m-0 p-0 list-none">
            {SETTINGS_SECTIONS.map((section) => {
              const active = section.id === activeId;
              return (
                <li key={section.id}>
                  <button
                    type="button"
                    data-settings-link={section.id}
                    aria-current={active ? 'location' : undefined}
                    onClick={() => jumpTo(section.id)}
                    className={`w-full h-[var(--wfa-row-height)] text-left px-3 bg-transparent border-0 border-l-2 border-solid cursor-pointer text-[13px] ${
                      active
                        ? 'border-accent text-text-1 font-medium'
                        : 'border-transparent text-text-2 hover:text-text-1'
                    }`}
                  >
                    {section.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex-1 min-w-0 max-w-[720px] flex flex-col gap-8">
          {SETTINGS_SECTIONS.map(({ id, title, component: Section }) => (
            <section key={id} id={`settings-${id}`} data-settings-section={id} className="flex flex-col gap-3">
              <h2 className="m-0 pb-2 text-[14px] leading-[20px] font-semibold text-text-1 border-b border-border">{title}</h2>
              <Section />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
