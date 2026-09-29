import { AppstoreOutlined, CheckOutlined, DownOutlined } from '@ant-design/icons';
import { Dropdown, type MenuProps } from 'antd';
import { DEFAULT_GRID_STYLE, type GridStyle } from './gridStyle';

type GridStylePickerProps = {
  value: GridStyle;
  onChange: (style: GridStyle) => void;
};

type Option = { key: string; label: string; style: GridStyle };

const OPTIONS: Option[] = [
  { key: 'classic', label: 'Grelha 3×2', style: DEFAULT_GRID_STYLE },
  { key: 'columns-2', label: 'Colunas (2)', style: { kind: 'columns', count: 2 } },
  { key: 'columns-3', label: 'Colunas (3)', style: { kind: 'columns', count: 3 } },
  { key: 'columns-4', label: 'Colunas (4)', style: { kind: 'columns', count: 4 } },
  { key: 'quad', label: '2×2', style: { kind: 'quad' } },
  { key: 'spotlight', label: 'Principal + laterais', style: { kind: 'spotlight' } },
];

function keyFor(style: GridStyle): string {
  return style.kind === 'columns' ? `columns-${style.count}` : style.kind;
}

/**
 * Botão no cabeçalho da grelha (spec docs/features/estilos-de-grelha.md) — escolhe entre os quatro
 * arranjos (Grelha 3×2 é o de hoje, por omissão). Fica no lugar onde estava o antigo botão
 * "+ Novo terminal" (removido em 2026-09-29, TerminalGrid.tsx) — não é o mesmo botão.
 */
export function GridStylePicker({ value, onChange }: GridStylePickerProps) {
  const activeKey = keyFor(value);
  const activeLabel = OPTIONS.find((option) => option.key === activeKey)?.label ?? 'Grelha 3×2';

  const items: MenuProps['items'] = OPTIONS.map((option) => ({
    key: option.key,
    label: (
      <span className="flex items-center gap-2 min-w-[160px]">
        <span className="w-3.5 flex-none flex justify-center">
          {option.key === activeKey && <CheckOutlined className="text-accent" style={{ fontSize: 12 }} />}
        </span>
        {option.label}
      </span>
    ),
  }));

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{
        items,
        selectedKeys: [activeKey],
        onClick: ({ key }) => {
          const option = OPTIONS.find((o) => o.key === key);
          if (option) onChange(option.style);
        },
      }}
    >
      <button
        type="button"
        aria-label="Estilo de grelha"
        className="h-8 flex-none flex items-center gap-1.5 px-2.5 rounded-md border border-border bg-surface-1 text-text-2 text-[13px] cursor-pointer hover:bg-surface-2 hover:text-text-1"
      >
        <AppstoreOutlined style={{ fontSize: 13 }} />
        {activeLabel}
        <DownOutlined style={{ fontSize: 9 }} />
      </button>
    </Dropdown>
  );
}
