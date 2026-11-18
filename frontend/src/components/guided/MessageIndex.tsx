import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FeedEntry } from '@/types/guided';
import { entryElement, ownerMessages } from './ownerMessages';
import { JUMPED_AWAY_EVENT, distanceFromBottom, findScrollArea, type ScrollArea } from './scrollArea';

/**
 * Uma mensagem passa a "à vista" quando o topo dela sobe acima desta linha (px abaixo do topo da área). É baixa de
 * propósito: o salto do índice põe a mensagem a 24 px (`scroll-mt-6`), e a mensagem seguinte do dono (uma resposta
 * logo a seguir) não pode chegar à linha antes dela.
 */
const ACTIVE_OFFSET = 72;
/** A faixa à direita que os traços ocupam (36 px) e um pouco de folga: o conteúdo que lá chega afasta-se (o `pr-10` do GuidedConversation). */
const RAIL_ZONE = 40;

type Placement = { top: number; right: number; panelMaxHeight: number };

/** A primeira linha de uma mensagem, que é o que cabe numa linha do painel. */
function firstLine(text: string): string {
  return text.trim().split('\n')[0] ?? '';
}

type MessageIndexProps = {
  entries: FeedEntry[];
  /** Avisa quando o conteúdo onde o índice está montado chega por baixo dos traços (a Upwork usa a largura toda). */
  onOverlap?: (overlap: boolean) => void;
};

/**
 * O índice das mensagens do dono, como o do DeepSeek: traços colados à direita da área de scroll, um por mensagem
 * (o da que está à vista mais comprido e a accent); ao passar o rato ou com foco abre um painel com o início de cada
 * uma, e o clique salta até ela. Com menos de duas mensagens não aparece.
 */
export function MessageIndex({ entries, onOverlap }: MessageIndexProps) {
  const anchor = useRef<HTMLSpanElement>(null);
  const messages = useMemo(() => ownerMessages(entries), [entries]);
  const visible = messages.length >= 2;
  const [area, setArea] = useState<ScrollArea | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    if (anchor.current) setArea(findScrollArea(anchor.current));
  }, []);

  useEffect(() => {
    if (!area || !visible) {
      onOverlap?.(false);
      return;
    }
    const update = () => {
      const view = area.viewport();
      const height = view.bottom - view.top;
      setPlacement({
        top: view.top + height / 2,
        right: document.documentElement.clientWidth - view.right,
        panelMaxHeight: Math.max(160, height * 0.7),
      });

      // A atual é a última cujo topo passou a linha; no topo é a primeira e, ao fundo, a última que se vê.
      const atTop = area.element.scrollTop <= 2;
      const atBottom = !atTop && distanceFromBottom(area) <= 2;
      const line = atBottom ? view.bottom : view.top + ACTIVE_OFFSET;
      let current = messages[0]!.id;
      if (!atTop) {
        for (const message of messages) {
          const element = entryElement(message.id);
          if (element && element.getBoundingClientRect().top <= line) current = message.id;
        }
      }
      setActiveId(current);

      const host = anchor.current?.parentElement;
      if (host && onOverlap) onOverlap(host.getBoundingClientRect().right > view.right - RAIL_ZONE);
    };
    update();
    area.target.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      area.target.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [area, visible, messages, onOverlap]);

  const jumpTo = (id: string) => {
    anchor.current?.dispatchEvent(new Event(JUMPED_AWAY_EVENT, { bubbles: true }));
    entryElement(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
  };

  return (
    <>
      <span ref={anchor} hidden />
      {visible && placement && (
        <nav
          className="msg-index"
          style={{ top: placement.top, right: placement.right }}
          aria-label="Índice das minhas mensagens"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
        >
          {/* Os traços vêm primeiro no DOM: com foco neles, o Tab entra no painel. */}
          <div className="msg-index-rail" tabIndex={0} role="group" aria-label={`${messages.length} mensagens tuas`} data-msg-index-rail>
            {messages.map((message) => (
              <span key={message.id} className={`msg-index-tick${message.id === activeId ? ' is-current' : ''}`} />
            ))}
          </div>
          {open && (
            <div className="msg-index-panel" style={{ maxHeight: placement.panelMaxHeight }} data-msg-index-panel>
              {messages.map((message) => (
                <button
                  key={message.id}
                  type="button"
                  className={message.id === activeId ? 'is-current' : undefined}
                  aria-current={message.id === activeId ? 'location' : undefined}
                  title={message.text}
                  data-target={message.id}
                  onClick={() => jumpTo(message.id)}
                >
                  {firstLine(message.text)}
                </button>
              ))}
            </div>
          )}
        </nav>
      )}
    </>
  );
}
