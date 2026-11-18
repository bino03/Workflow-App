/**
 * A área com scroll onde a conversa vive. Não é sempre a mesma: o `<main>` do AppLayout no Novo projeto, a
 * `section` da candidatura na Upwork, a janela no `/_guided`. Por isso procura-se o ascendente com scroll em vez
 * de o assumir.
 */
export type ScrollArea = {
  /** O que tem `scrollTop`/`scrollHeight` (na janela, o `document.scrollingElement`). */
  element: HTMLElement;
  /** Onde se ouve o `scroll` (na janela, a própria `window`). */
  target: HTMLElement | Window;
  /** O retângulo visível da área, em coordenadas do viewport, sem a barra de scroll. */
  viewport: () => { top: number; bottom: number; left: number; right: number };
};

const SCROLLS = /(auto|scroll|overlay)/;

export function findScrollArea(from: HTMLElement): ScrollArea {
  for (let node = from.parentElement; node && node !== document.body; node = node.parentElement) {
    if (SCROLLS.test(getComputedStyle(node).overflowY)) {
      const element = node;
      return {
        element,
        target: element,
        viewport: () => {
          const rect = element.getBoundingClientRect();
          return { top: rect.top, bottom: rect.top + element.clientHeight, left: rect.left, right: rect.left + element.clientWidth };
        },
      };
    }
  }
  const element = (document.scrollingElement ?? document.documentElement) as HTMLElement;
  return {
    element,
    target: window,
    viewport: () => ({ top: 0, bottom: window.innerHeight, left: 0, right: document.documentElement.clientWidth }),
  };
}

export function distanceFromBottom(area: ScrollArea): number {
  const { scrollTop, clientHeight, scrollHeight } = area.element;
  // Na janela, o clientHeight do scrollingElement é a altura do viewport.
  return scrollHeight - scrollTop - clientHeight;
}

/**
 * O índice saltou para uma mensagem: a conversa deixa de estar presa ao fim **já**. Sem isto, uma entrada que chegue
 * antes do primeiro `scroll` do salto suave (o hook ainda acha que o dono está no fim) desfazia-o.
 */
export const JUMPED_AWAY_EVENT = 'guided:jumped-away';

export function scrollToEnd(area: ScrollArea) {
  area.element.scrollTo({ top: area.element.scrollHeight, behavior: 'smooth' });
}
