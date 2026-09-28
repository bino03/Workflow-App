import type { ReactNode } from 'react';
import { Button, Drawer, Space } from 'antd';
import { DRAWER_WIDTH } from '@/config/drawer';
import { notificationService } from '@/services/general/notificationService';
import type { LibraryEntry } from '@/types/library';
import { MaturityTag } from './MaturityTag';
import { KIND_LABEL, formatLongDate } from './libraryFormat';

type LibraryEntryDrawerProps = { selected: LibraryEntry | null; onClose: () => void };

type MetaRow = { label: string; value: ReactNode; mono?: boolean };

function joinOrDash(values: string[]) {
  return values.length ? values.join(', ') : '—';
}

/** Só frontmatter (ADR 0005): o corpo do manifesto não é lido. */
function describe(selected: LibraryEntry): { title: string; tags: string[]; rows: MetaRow[]; summary?: string } {
  switch (selected.kind) {
    case 'stacks': {
      const { entry } = selected;
      return {
        title: entry.id,
        tags: entry.technologies,
        rows: [
          { label: 'Nome', value: entry.name },
          { label: 'Camada', value: entry.layer, mono: true },
          { label: 'Combina com', value: joinOrDash(entry.pairsWith), mono: entry.pairsWith.length > 0 },
          { label: 'Skills', value: joinOrDash(entry.providesSkills), mono: entry.providesSkills.length > 0 },
        ],
      };
    }
    case 'themes': {
      const { entry } = selected;
      return {
        title: entry.id,
        tags: entry.suits,
        rows: [
          { label: 'Nome', value: entry.name },
          { label: 'Modo', value: entry.mode ?? '—' },
          { label: 'Densidade', value: entry.density ?? '—' },
          { label: 'Fontes', value: joinOrDash(entry.fonts) },
          { label: 'Stacks', value: joinOrDash(entry.frontendStacks), mono: entry.frontendStacks.length > 0 },
        ],
      };
    }
    case 'skills': {
      const { entry } = selected;
      return {
        title: entry.name,
        tags: [entry.category],
        summary: entry.description || undefined,
        rows: [
          { label: 'Categoria', value: entry.category },
          { label: 'Stack', value: entry.stack ?? '—', mono: entry.stack !== null },
          { label: 'Quando', value: entry.appliesWhen ?? '—' },
        ],
      };
    }
  }
}

async function copyPath(path: string) {
  try {
    await navigator.clipboard.writeText(path);
    notificationService.success('Caminho copiado');
  } catch {
    // Fora de um contexto seguro (http num IP da rede) o browser não expõe a área de transferência.
    notificationService.error('Erro', 'Não foi possível copiar o caminho.');
  }
}

export function LibraryEntryDrawer({ selected, onClose }: LibraryEntryDrawerProps) {
  const details = selected ? describe(selected) : null;
  const entry = selected?.entry;

  return (
    <Drawer
      open={!!selected}
      onClose={onClose}
      size={DRAWER_WIDTH.medium}
      extra={<span className="kbd">Esc</span>}
      title={
        selected &&
        details && (
          <div className="flex flex-col gap-1">
            <h6 className="kicker m-0">{KIND_LABEL[selected.kind].kicker}</h6>
            <h2 className="m-0 font-mono text-[20px] leading-[26px] font-semibold text-text-1 break-all">{details.title}</h2>
          </div>
        )
      }
      footer={
        entry && (
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-text-3">Só leitura · edita no Obsidian</span>
            <span className="flex-1" />
            <Space>
              <Button onClick={() => void copyPath(entry.path)}>Copiar caminho</Button>
              <Button type="primary" onClick={onClose}>
                Fechar
              </Button>
            </Space>
          </div>
        )
      }
    >
      {entry && details && (
        <div className="flex flex-col gap-5">
          <div className="flex gap-1.5 flex-wrap items-center">
            <MaturityTag maturity={entry.maturity} raw={entry.maturityRaw} />
            {details.tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>

          {details.summary && <p className="m-0 text-text-2 text-[14px] leading-[22px]">{details.summary}</p>}

          <dl className="m-0 grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[12.5px]">
            {[
              ...details.rows,
              { label: 'Ficheiro', value: entry.path, mono: true },
              { label: 'Atualizado', value: formatLongDate(entry.updated) },
            ].map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-text-3">{row.label}</dt>
                <dd className={`m-0 text-text-2 break-words ${row.mono ? 'font-mono' : ''}`}>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Drawer>
  );
}
