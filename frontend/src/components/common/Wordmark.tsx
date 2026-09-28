type WordmarkProps = { size?: 'header' | 'login' };

/** Losango contornado em accent + "WORKFLOW" — header (13/.18em) e login (15/.2em). */
export function Wordmark({ size = 'header' }: WordmarkProps) {
  const isLogin = size === 'login';
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        aria-hidden
        className="inline-block rotate-45 border-accent border-[1.5px]"
        style={{ width: isLogin ? 12 : 9, height: isLogin ? 12 : 9 }}
      />
      <span
        className="font-semibold uppercase text-text-1"
        style={{ fontSize: isLogin ? 15 : 13, letterSpacing: isLogin ? '.2em' : '.18em' }}
      >
        Workflow
      </span>
    </span>
  );
}
