import { Empty } from 'antd';

type PagePlaceholderProps = { kicker: string; title: string; description: string };

/** Página de topo cuja feature ainda não existe — some quando a feature chegar. */
export function PagePlaceholder({ kicker, title, description }: PagePlaceholderProps) {
  return (
    <div className="p-8">
      <div className="kicker">{kicker}</div>
      <h1 className="text-display m-0 mt-1">{title}</h1>
      <div className="mt-16">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />
      </div>
    </div>
  );
}
