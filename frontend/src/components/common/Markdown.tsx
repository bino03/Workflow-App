import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Links abrem fora da app e sem `opener`; o resto do HTML é o que o react-markdown gera a partir do Markdown. */
const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

/**
 * Markdown vindo do Claude (ADR 0020 ponto 9): GFM (tabelas, listas de tarefas), **nunca HTML cru** — `skipHtml`
 * descarta-o, sem `rehype-raw` — e sem imagens (um `![](url)` faria o browser pedir um URL alheio). Estilo
 * pela classe `.md` (tokens).
 */
export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`md ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml disallowedElements={['img']} unwrapDisallowed components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
