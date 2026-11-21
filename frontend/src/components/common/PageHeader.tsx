import { ConfigProvider } from 'antd';
import type { ReactNode } from 'react';
import { CONTROL_HEIGHT } from '@/theme';

type PageHeaderProps = {
  /** O nome do ecrã, em kicker (ex.: "Projetos"). */
  kicker: string;
  title: ReactNode;
  /** Uma frase sobre o ecrã, a seguir ao título; cortada com reticências (inteira no `title`). */
  description?: string;
  /** Controlos à direita (pesquisa, ação principal), já com a altura da moldura. */
  actions?: ReactNode;
};

/**
 * Cabeçalho de página da moldura tipo IDE (ADR 0036, proposta C): uma linha de `--wfa-header-height` em
 * `surface-1`, fixa no topo do `<main>`, com o kicker alinhado com a marca da barra de título.
 */
export function PageHeader({ kicker, title, description, actions }: PageHeaderProps) {
  return (
    <header
      data-page-header
      className="sticky top-0 z-20 h-[var(--wfa-header-height)] flex-none flex items-center gap-3 px-[var(--wfa-page-gutter)] bg-surface-1 border-b border-border"
    >
      <span className="kicker flex-none">{kicker}</span>
      <h1 className="m-0 flex-none text-[13px] leading-[18px] font-semibold text-text-1">{title}</h1>
      {description && (
        <span className="min-w-0 truncate text-[12.5px] text-text-3" title={description}>
          {description}
        </span>
      )}
      <div className="flex-1" />
      {actions && (
        <ConfigProvider theme={{ token: { controlHeight: CONTROL_HEIGHT } }}>
          <div className="flex-none flex items-center gap-2">{actions}</div>
        </ConfigProvider>
      )}
    </header>
  );
}
