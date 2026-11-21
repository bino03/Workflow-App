type WordmarkProps = { size?: 'header' | 'login' };

/**
 * A marca "Em paralelo" (ADR 0036): uma linha que se divide em três — várias sessões do Claude Code ao mesmo
 * tempo, a razão de ser da app. Só em `accent`; o traço engrossa no tamanho pequeno para não se perder.
 */
export function ParallelMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className="flex-none">
      <path
        d="M3 12h6M9 12c4 0 5-6 9-6M9 12h9M9 12c4 0 5 6 9 6"
        stroke="var(--wfa-color-accent)"
        strokeWidth={size <= 18 ? 2.2 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Marca + "WORKFLOW" — barra de título (12/.16em) e login (15/.2em). */
export function Wordmark({ size = 'header' }: WordmarkProps) {
  const isLogin = size === 'login';
  return (
    <span className="inline-flex items-center gap-2">
      <ParallelMark size={isLogin ? 22 : 16} />
      <span
        className="font-semibold uppercase text-text-1"
        style={{ fontSize: isLogin ? 15 : 12, letterSpacing: isLogin ? '.2em' : '.16em' }}
      >
        Workflow
      </span>
    </span>
  );
}
