import { useEffect, useRef, useState } from 'react';
import { CloseOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Checkbox, Input, type InputRef } from 'antd';
import { MAX_TASK_TEXT, type ProjectTask } from '@/types/projectTask';

type Filter = 'todo' | 'done' | 'all';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'todo', label: 'Por fazer' },
  { id: 'done', label: 'Feitas' },
  { id: 'all', label: 'Todas' },
];

const EMPTY_TEXT: Record<Filter, string> = {
  todo: 'Nada por fazer. Bom trabalho.',
  done: 'Ainda nada feito.',
  all: 'Sem tarefas — escreve a primeira em baixo.',
};

/** Quanto tempo o "Desfazer" fica à mão depois de apagar. */
const UNDO_MS = 6_000;

type ProjectTasksPanelProps = {
  projectName: string;
  tasks: ProjectTask[];
  onAdd: (text: string) => Promise<boolean>;
  onSetDone: (id: string, done: boolean) => void;
  onRemove: (id: string) => Promise<ProjectTask | null>;
  onRestore: (task: ProjectTask) => void;
  onClose: () => void;
  /** A combinação do `toggleTasks` ("Alt+K"), ou `null` sem bind. */
  shortcutHint: string | null;
  /** Ao montar: `true` se foi o dono a abrir o painel (foca o campo) — mudar de projeto com ele aberto não foca. */
  takeFocusRequest: () => boolean;
};

/**
 * Painel de tarefas do projeto ativo, à direita dos Terminais (ADR 0037, proposta C do canvas). Lista pessoal,
 * sem nada a ver com o vault. A nova entra no fundo; apagar não pede confirmação e oferece "Desfazer".
 */
export function ProjectTasksPanel(props: ProjectTasksPanelProps) {
  const { tasks } = props;
  const [filter, setFilter] = useState<Filter>('todo');
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [undoTask, setUndoTask] = useState<ProjectTask | null>(null);
  const inputRef = useRef<InputRef>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (props.takeFocusRequest()) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao montar: abrir o painel, não cada render
  }, []);

  useEffect(() => {
    if (!undoTask) return;
    const timer = window.setTimeout(() => setUndoTask(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [undoTask]);

  const openCount = tasks.filter((t) => !t.done).length;
  const counts: Record<Filter, number> = { todo: openCount, done: tasks.length - openCount, all: tasks.length };
  const shown = tasks.filter((t) => (filter === 'all' ? true : filter === 'done' ? t.done : !t.done));

  const submit = async () => {
    const text = draft.trim();
    if (!text || adding) return;
    setAdding(true);
    const ok = await props.onAdd(text);
    setAdding(false);
    if (!ok) return;
    setDraft('');
    // A nova entra no fundo e é "por fazer": mostrá-la.
    if (filter === 'done') setFilter('todo');
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
  };

  const remove = async (id: string) => {
    const removed = await props.onRemove(id);
    if (removed) setUndoTask(removed);
  };

  const undo = () => {
    if (!undoTask) return;
    props.onRestore(undoTask);
    setUndoTask(null);
  };

  return (
    <aside
      aria-label="Tarefas do projeto"
      data-tasks-panel
      className="w-[var(--wfa-tasks-panel-width)] flex-none flex flex-col border-l border-border bg-surface-1 text-[12.5px]"
    >
      <div className="h-[var(--wfa-header-height)] flex-none flex items-center gap-2 pl-3 pr-1.5 border-b border-border">
        <span className="kicker">Tarefas</span>
        <span className="flex-1 min-w-0 truncate text-[12px] text-text-3">{props.projectName}</span>
        <button
          type="button"
          aria-label="Fechar tarefas"
          title={`Fechar tarefas${props.shortcutHint ? ` (${props.shortcutHint})` : ''}`}
          onClick={props.onClose}
          className="w-6 h-6 flex items-center justify-center bg-transparent border-0 rounded-sm text-text-3 cursor-pointer hover:bg-surface-3 hover:text-text-1"
        >
          <CloseOutlined style={{ fontSize: 11 }} />
        </button>
      </div>

      <div className="flex gap-1 px-3 py-2" role="group" aria-label="Filtrar tarefas">
        {FILTERS.map(({ id, label }) => (
          <button key={id} type="button" className="filter-chip" aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label} <span className="font-mono text-[10.5px] opacity-80">{counts[id]}</span>
          </button>
        ))}
      </div>

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-1.5" data-tasks-list>
        {shown.map((task) => (
          <div key={task.id} data-task={task.id} className="group min-h-8 flex items-center gap-2 px-1.5 py-1 rounded-sm hover:bg-surface-2">
            <Checkbox checked={task.done} onChange={(e) => props.onSetDone(task.id, e.target.checked)} aria-label={`Feita: ${task.text}`} />
            <span data-task-text className={`flex-1 min-w-0 break-words ${task.done ? 'text-text-3 line-through' : 'text-text-1'}`}>{task.text}</span>
            <button
              type="button"
              aria-label={`Apagar tarefa: ${task.text}`}
              title="Apagar"
              onClick={() => void remove(task.id)}
              className="w-[22px] h-[22px] flex-none flex items-center justify-center bg-transparent border-0 rounded-sm text-text-3 cursor-pointer opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-surface-3 hover:text-error"
            >
              <DeleteOutlined style={{ fontSize: 12 }} />
            </button>
          </div>
        ))}
        {shown.length === 0 && <p className="m-0 px-3 py-6 text-center text-text-3">{EMPTY_TEXT[filter]}</p>}
      </div>

      {undoTask && (
        <div
          role="status"
          className="mx-2 mt-2 h-8 flex-none flex items-center gap-2 px-2.5 rounded-sm border border-border-strong bg-surface-3 text-[12px] text-text-2"
        >
          <span className="flex-1 min-w-0 truncate">Tarefa apagada</span>
          <button type="button" onClick={undo} className="bg-transparent border-0 p-0 text-accent font-semibold text-[12px] cursor-pointer">
            Desfazer
          </button>
        </div>
      )}

      <div className="flex-none flex gap-1.5 px-3 py-2.5 border-t border-border mt-2">
        <Input
          ref={inputRef}
          aria-label="Nova tarefa"
          placeholder="Nova tarefa… (Enter)"
          value={draft}
          maxLength={MAX_TASK_TEXT}
          onChange={(e) => setDraft(e.target.value)}
          onPressEnter={() => void submit()}
        />
        <Button type="primary" aria-label="Adicionar tarefa" icon={<PlusOutlined />} onClick={() => void submit()} disabled={!draft.trim()} loading={adding} />
      </div>
    </aside>
  );
}
