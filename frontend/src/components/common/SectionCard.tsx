import type { ReactNode } from 'react';

type SectionCardProps = {
  title: string;
  icon?: ReactNode;
  kicker?: string;
  /** Ação à direita do cabeçalho (ex. um botão "Editar"). */
  extra?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Card de secção com cabeçalho — cards.md: `.card` + ícone em accent + título, sem sombra. */
export function SectionCard({ title, icon, kicker, extra, className = '', children }: SectionCardProps) {
  return (
    <section className={`card p-4 ${className}`}>
      <header className="flex items-start gap-2.5 mb-3">
        {icon && <span className="text-accent text-base leading-6 flex-none">{icon}</span>}
        <div className="flex-1 min-w-0">
          {kicker && <div className="card-kicker">{kicker}</div>}
          <h3 className="card-title m-0">{title}</h3>
        </div>
        {extra && <div className="flex-none">{extra}</div>}
      </header>
      <div className="card-body">{children}</div>
    </section>
  );
}
