import { formatShortDate } from '@/components/library/libraryFormat';
import { STATUS_TAG, VERDICT_TAG } from '@/components/upwork/upworkFormat';
import type { ApplicationView } from '@/types/upwork';

type ApplicationListProps = {
  applications: ApplicationView[];
  selectedId: string | null;
  onSelect: (application: ApplicationView) => void;
};

/** Coluna de cards do mestre-detalhe (tables-and-lists.md §6): poucas candidaturas, cada uma com corpo longo. */
export function ApplicationList({ applications, selectedId, onSelect }: ApplicationListProps) {
  return (
    <ul className="m-0 p-0 list-none flex flex-col gap-2" aria-label="Candidaturas">
      {applications.map((application) => {
        const status = STATUS_TAG[application.status];
        const verdict = application.package ? VERDICT_TAG[application.package.verdict] : null;
        const selected = application.id === selectedId;
        return (
          <li key={application.id}>
            <button
              type="button"
              aria-current={selected || undefined}
              onClick={() => onSelect(application)}
              className={`w-full text-left flex flex-col gap-2 px-3.5 py-3 rounded-md border bg-surface-1 cursor-pointer transition-colors ${
                selected ? 'border-accent' : 'border-border hover:border-border-strong'
              }`}
            >
              <span className="text-[13.5px] font-semibold text-text-1 line-clamp-2">{application.title}</span>
              <span className="flex items-center gap-1.5 flex-wrap">
                <span className={status.className}>{status.label}</span>
                {verdict && <span className={verdict.className}>{verdict.label}</span>}
                <span className="flex-1" />
                <span className="text-[12px] text-text-3 truncate max-w-[140px]">{application.clientName ?? '—'}</span>
                <span className="font-mono text-[12px] text-text-3">{formatShortDate(application.createdAt)}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
