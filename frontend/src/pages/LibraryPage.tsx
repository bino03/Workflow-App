import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Button, Input, Select, Table, Tabs, type InputRef } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined } from '@ant-design/icons';
import { LibraryEntryDrawer } from '@/components/library/LibraryEntryDrawer';
import { MaturityTag } from '@/components/library/MaturityTag';
import { KIND_LABEL, MATURITY_CLASS, MATURITY_LABEL, formatShortDate } from '@/components/library/libraryFormat';
import { useLibrary } from '@/hooks/useLibrary';
import type {
  InvalidEntry,
  LibraryEntry,
  LibraryKind,
  Maturity,
  SkillEntry,
  StackEntry,
  ThemeEntry,
} from '@/types/library';

type MaturityFilter = Maturity | 'all';

const MATURITIES: Maturity[] = ['proven', 'partial', 'draft'];
const KINDS: LibraryKind[] = ['stacks', 'themes', 'skills'];

/** Camada só existe nas stacks, categoria só nas skills; os designs não têm agrupamento. */
const GROUP_PLACEHOLDER: Partial<Record<LibraryKind, string>> = {
  stacks: 'Todas as camadas',
  skills: 'Todas as categorias',
};

function matchesSearch(fields: (string | null)[], query: string) {
  if (!query) return true;
  const needle = query.toLowerCase();
  return fields.some((field) => field?.toLowerCase().includes(needle));
}

function Technologies({ values }: { values: string[] }) {
  return (
    <div className="flex gap-1 flex-wrap py-2">
      {values.map((value) => (
        <span key={value} className="tag h-5 px-[7px] text-[11.5px]">
          {value}
        </span>
      ))}
    </div>
  );
}

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

export function LibraryPage() {
  const library = useLibrary();
  const [kind, setKind] = useState<LibraryKind>('stacks');
  const [search, setSearch] = useState('');
  const [maturity, setMaturity] = useState<MaturityFilter>('all');
  const [group, setGroup] = useState<string | null>(null);
  const [selected, setSelected] = useState<LibraryEntry | null>(null);
  const searchRef = useRef<InputRef>(null);

  // "/" leva à pesquisa, como no protótipo — nunca enquanto se escreve noutro campo.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const changeKind = (next: LibraryKind) => {
    setKind(next);
    setGroup(null);
  };

  const byMaturity = useCallback((entry: { maturity: Maturity }) => maturity === 'all' || entry.maturity === maturity, [maturity]);

  const stacks = useMemo(
    () =>
      library.stacks.entries.filter(
        (entry) =>
          byMaturity(entry) &&
          (kind !== 'stacks' || group === null || entry.layer === group) &&
          matchesSearch([entry.id, entry.name, entry.layer, ...entry.technologies], search),
      ),
    [library.stacks.entries, byMaturity, group, kind, search],
  );
  const themes = useMemo(
    () =>
      library.themes.entries.filter(
        (entry) => byMaturity(entry) && matchesSearch([entry.id, entry.name, ...entry.suits, ...entry.fonts], search),
      ),
    [library.themes.entries, byMaturity, search],
  );
  const skills = useMemo(
    () =>
      library.skills.entries.filter(
        (entry) =>
          byMaturity(entry) &&
          (kind !== 'skills' || group === null || entry.category === group) &&
          matchesSearch([entry.name, entry.description, entry.category, entry.stack], search),
      ),
    [library.skills.entries, byMaturity, group, kind, search],
  );

  const groupOptions = useMemo(() => {
    const values =
      kind === 'stacks'
        ? library.stacks.entries.map((entry) => entry.layer)
        : kind === 'skills'
          ? library.skills.entries.map((entry) => entry.category)
          : [];
    return [...new Set(values)].sort().map((value) => ({ value, label: value }));
  }, [kind, library.stacks.entries, library.skills.entries]);

  // Lista só de leitura: a ação é um link "Ver" em accent, à direita (tables-and-lists.md §3).
  const viewColumn = <T,>(open: (entry: T) => void): ColumnsType<T>[number] => ({
    title: <span className="block text-right">Ações</span>,
    key: 'actions',
    width: 70,
    render: (_, entry) => (
      <div className="text-right">
        <button
          type="button"
          className="bg-transparent border-0 p-0 cursor-pointer text-[13px] font-semibold text-accent hover:text-accent-hover"
          onClick={(event) => {
            event.stopPropagation();
            open(entry);
          }}
        >
          Ver
        </button>
      </div>
    ),
  });

  const maturityColumn = {
    title: 'Maturidade',
    key: 'maturity',
    width: 130,
    render: (_: unknown, entry: { maturity: Maturity; maturityRaw: string }) => (
      <MaturityTag maturity={entry.maturity} raw={entry.maturityRaw} />
    ),
  };

  const updatedColumn = {
    title: 'Atualizado',
    key: 'updated',
    width: 100,
    render: (_: unknown, entry: { updated: string | null }) => (
      <span className="font-mono text-[12px] text-text-3">{formatShortDate(entry.updated)}</span>
    ),
  };

  const nameCell = (value: string) => <span className="font-mono text-[13px] font-medium text-text-1">{value}</span>;
  const descriptionCell = (value: string) => <span className="text-[13.5px] text-text-2">{value || '—'}</span>;

  const stackColumns: ColumnsType<StackEntry> = [
    { title: 'Nome', dataIndex: 'id', width: 220, render: nameCell },
    { title: 'Descrição', dataIndex: 'name', ellipsis: true, render: descriptionCell },
    {
      title: 'Camada',
      dataIndex: 'layer',
      width: 120,
      render: (value: string) => <span className="font-mono text-[12px] text-text-2">{value}</span>,
    },
    { title: 'Tecnologias', dataIndex: 'technologies', width: 260, render: (values: string[]) => <Technologies values={values} /> },
    maturityColumn,
    updatedColumn,
    viewColumn<StackEntry>((entry) => setSelected({ kind: 'stacks', entry })),
  ];

  const themeColumns: ColumnsType<ThemeEntry> = [
    { title: 'Nome', dataIndex: 'id', width: 220, render: nameCell },
    { title: 'Descrição', dataIndex: 'name', ellipsis: true, render: descriptionCell },
    {
      title: 'Modo',
      key: 'mode',
      width: 160,
      render: (_, entry) => (
        <span className="text-[13px] text-text-2">{[entry.mode, entry.density].filter(Boolean).join(' · ') || '—'}</span>
      ),
    },
    { title: 'Serve para', dataIndex: 'suits', width: 260, render: (values: string[]) => <Technologies values={values} /> },
    maturityColumn,
    updatedColumn,
    viewColumn<ThemeEntry>((entry) => setSelected({ kind: 'themes', entry })),
  ];

  const skillColumns: ColumnsType<SkillEntry> = [
    { title: 'Nome', dataIndex: 'name', width: 220, render: nameCell },
    { title: 'Descrição', dataIndex: 'description', ellipsis: true, render: descriptionCell },
    {
      title: 'Categoria',
      key: 'category',
      width: 260,
      render: (_, entry) => <Technologies values={entry.stack ? [entry.category, entry.stack] : [entry.category]} />,
    },
    maturityColumn,
    updatedColumn,
    viewColumn<SkillEntry>((entry) => setSelected({ kind: 'skills', entry })),
  ];

  const isSelected = (path: string) => selected?.entry.path === path;
  const emptyText = <span className="text-text-3 text-[13px]">Nenhuma entrada corresponde aos filtros.</span>;

  const renderTable = <T extends { path: string }>(rows: T[], columns: ColumnsType<T>, open: (entry: T) => void) => (
    <Table<T>
      rowKey="path"
      dataSource={rows}
      columns={columns}
      loading={library.loading}
      pagination={false}
      tableLayout="fixed"
      locale={{ emptyText }}
      rowClassName={(entry) => `cursor-pointer ${isSelected(entry.path) ? 'ant-table-row-selected' : ''}`}
      onRow={(entry) => ({ onClick: () => open(entry) })}
    />
  );

  const tables: Record<LibraryKind, { total: { maturity: Maturity }[]; shown: number; invalid: InvalidEntry[]; table: ReactNode }> = {
    stacks: {
      total: library.stacks.entries,
      shown: stacks.length,
      invalid: library.stacks.invalid,
      table: renderTable(stacks, stackColumns, (entry) => setSelected({ kind: 'stacks', entry })),
    },
    themes: {
      total: library.themes.entries,
      shown: themes.length,
      invalid: library.themes.invalid,
      table: renderTable(themes, themeColumns, (entry) => setSelected({ kind: 'themes', entry })),
    },
    skills: {
      total: library.skills.entries,
      shown: skills.length,
      invalid: library.skills.invalid,
      table: renderTable(skills, skillColumns, (entry) => setSelected({ kind: 'skills', entry })),
    },
  };

  const current = tables[kind];
  const counts = MATURITIES.map((key) => `${current.total.filter((entry) => entry.maturity === key).length} ${MATURITY_LABEL[key].plural}`);
  const footer = [`${current.total.length} ${KIND_LABEL[kind].plural}`, ...counts].join(' · ');
  const groupPlaceholder = GROUP_PLACEHOLDER[kind];

  const chips = (
    <div className="flex gap-1.5 pb-2" role="group" aria-label="Filtrar por maturidade">
      <button type="button" className="filter-chip" aria-pressed={maturity === 'all'} onClick={() => setMaturity('all')}>
        Todas
      </button>
      {MATURITIES.map((key) => (
        <button key={key} type="button" className="filter-chip" aria-pressed={maturity === key} onClick={() => setMaturity(key)}>
          <span className={`mat-glyph ${MATURITY_CLASS[key].glyph}`} aria-hidden />
          {MATURITY_LABEL[key].singular}
        </button>
      ))}
    </div>
  );

  return (
    <div className="px-10 pt-7 pb-4 flex flex-col">
      <div className="flex items-end gap-4">
        <div className="flex-1 flex flex-col gap-1">
          <span className="kicker">Biblioteca</span>
          <h1 className="text-display m-0">Workflow</h1>
          <span className="text-[13.5px] text-text-2">Stacks, designs e skills do teu registo. Só leitura.</span>
        </div>
        {groupPlaceholder && (
          <Select
            className="w-[200px]"
            placeholder={groupPlaceholder}
            allowClear
            value={group}
            onChange={(value: string | undefined) => setGroup(value ?? null)}
            options={groupOptions}
            aria-label={groupPlaceholder}
          />
        )}
        <Input
          ref={searchRef}
          className="max-w-[320px]"
          prefix={<SearchOutlined className="opacity-50" />}
          suffix={<span className="kbd">/</span>}
          placeholder={`Pesquisar ${KIND_LABEL[kind].plural}…`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          allowClear
          aria-label="Pesquisar"
        />
      </div>

      <Tabs
        className="mt-[22px]"
        activeKey={kind}
        onChange={(key) => changeKind(key as LibraryKind)}
        tabBarExtraContent={chips}
        items={KINDS.map((key) => ({
          key,
          label: (
            <span className="flex items-center gap-2">
              {KIND_LABEL[key].tab}
              <span className="font-mono text-[11.5px] text-text-3">{tables[key].total.length}</span>
            </span>
          ),
          children: library.error ? (
            <Alert
              type="error"
              showIcon
              title={library.error}
              action={
                <Button size="small" onClick={library.reload}>
                  Tentar de novo
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              {tables[key].invalid.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  title={`${tables[key].invalid.length} manifesto(s) com erro — não aparecem na lista`}
                  description={
                    <ul className="m-0 pl-4">
                      {tables[key].invalid.map((invalid) => (
                        <li key={invalid.path}>
                          <span className="font-mono text-[12px]">{invalid.path}</span> — {invalid.message}
                        </li>
                      ))}
                    </ul>
                  }
                />
              )}
              {tables[key].table}
            </div>
          ),
        }))}
      />

      {!library.error && !library.loading && (
        <p className="m-0 h-11 flex items-center text-[12.5px] text-text-3">
          {footer}
          {current.shown !== current.total.length && ` · a mostrar ${current.shown}`}
        </p>
      )}

      <LibraryEntryDrawer selected={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
