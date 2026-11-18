import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { JUMPED_AWAY_EVENT, distanceFromBottom, findScrollArea, type ScrollArea, scrollToEnd } from './scrollArea';

/** Até esta distância do fim conta como "estava no fim". */
const NEAR_BOTTOM = 120;

/**
 * A conversa desce sozinha quando muda (`changeKey`) **só se o dono estava no fim**. Se subiu a reler, fica onde
 * está e `away` mostra o botão ↓. Um envio do próprio dono (`ownerCount` sobe) leva sempre ao fim.
 *
 * "Estava no fim" não se mede no momento da mudança (o conteúdo novo já empurrou o fim para baixo, e um scroll suave
 * pode ir a meio): fica preso (`pinned`) até o dono subir, e volta a prender quando ele desce até perto do fim.
 */
export function useStickToBottom(rootRef: RefObject<HTMLElement | null>, changeKey: string, ownerCount: number) {
  const [area, setArea] = useState<ScrollArea | null>(null);
  const [away, setAway] = useState(false);
  const pinned = useRef(true);
  const lastTop = useRef(0);
  const seenOwnerCount = useRef(ownerCount);

  useLayoutEffect(() => {
    if (rootRef.current) setArea(findScrollArea(rootRef.current));
  }, [rootRef]);

  useEffect(() => {
    if (!area) return;
    lastTop.current = area.element.scrollTop;
    const onScroll = () => {
      const top = area.element.scrollTop;
      const near = distanceFromBottom(area) <= NEAR_BOTTOM;
      if (near) pinned.current = true;
      else if (top < lastTop.current) pinned.current = false;
      lastTop.current = top;
      setAway(!near && !pinned.current);
    };
    const onJumpedAway = () => {
      pinned.current = false;
      setAway(true);
    };
    const root = rootRef.current;
    // O conteúdo cresce depois de a entrada chegar (Markdown, fontes, o painel do fundo): presa ao fim, acompanha.
    const resized = new ResizeObserver(() => {
      if (pinned.current && distanceFromBottom(area) > 1) scrollToEnd(area);
    });
    if (root) resized.observe(root);
    area.target.addEventListener('scroll', onScroll, { passive: true });
    root?.addEventListener(JUMPED_AWAY_EVENT, onJumpedAway);
    return () => {
      resized.disconnect();
      area.target.removeEventListener('scroll', onScroll);
      root?.removeEventListener(JUMPED_AWAY_EVENT, onJumpedAway);
    };
  }, [area, rootRef]);

  useEffect(() => {
    if (!area) return;
    const ownerSent = ownerCount > seenOwnerCount.current;
    seenOwnerCount.current = ownerCount;
    if (pinned.current || ownerSent) {
      pinned.current = true;
      setAway(false);
      scrollToEnd(area);
    } else {
      setAway(distanceFromBottom(area) > NEAR_BOTTOM);
    }
  }, [area, changeKey, ownerCount]);

  const jumpToEnd = useCallback(() => {
    if (!area) return;
    pinned.current = true;
    setAway(false);
    scrollToEnd(area);
  }, [area]);

  return { away, jumpToEnd };
}
