import { Alert, Button, Collapse, Drawer, Space, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { DRAWER_WIDTH } from '@/config/drawer';
import { ErrorHandler } from '@/errors/errorHandler';
import { getImportDiff } from '@/services/importService';
import type { FileChange, ImportFileDiff, ImportView } from '@/types/imports';

type ImportReviewDrawerProps = {
  /** A importação a rever; null = fechado. */
  view: ImportView | null;
  busy: 'accept' | 'discard' | null;
  onClose: () => void;
  onAccept: () => void;
  /** Confirma quem chama — repõe o Workflow como estava. */
  onDiscard: () => void;
};

/**
 * Onde uma importação pode escrever — o contrato do Workflow (`docs/import-contract.md` lá → "Onde uma importação
 * escreve"). O diff mostra o repositório todo; o que fica fora disto assinala-se antes de aceitar.
 */
const insideImportScope = (path: string) => path.startsWith('library/') || path === 'docs/provenance.md';

const CHANGE_LABEL: Record<FileChange, { text: string; className: string }> = {
  added: { text: 'Novo', className: 'tag tag-work' },
  modified: { text: 'Alterado', className: 'tag tag-wait' },
  deleted: { text: 'Apagado', className: 'tag tag-err' },
};

/**
 * Uma linha do diff com a classe da sua marca (`+`, `−`, `@@`) — tokens de sucesso/erro/info. O cabeçalho do
 * `git diff` (`diff --git`, `index`, `---`/`+++`) não diz nada a quem revê: começa no primeiro `@@`.
 */
function DiffLines({ diff }: { diff: string }) {
  const all = diff.replace(/\n$/, '').split('\n');
  const firstHunk = all.findIndex((line) => line.startsWith('@@'));
  const lines = firstHunk > 0 ? all.slice(firstHunk) : all;
  if (diff.trim() === '') {
    // O git marca o ficheiro (fins de linha CRLF/LF, permissões), mas o conteúdo é igual.
    return <span className="text-[12.5px] text-text-3">Sem diferenças de conteúdo — só mudaram os fins de linha ou as permissões.</span>;
  }
  return (
    <div className="diff-block">
      {lines.map((line, i) => {
        const kind =
          line.startsWith('+') && !line.startsWith('+++')
            ? 'diff-add'
            : line.startsWith('-') && !line.startsWith('---')
              ? 'diff-del'
              : line.startsWith('@@')
                ? 'diff-hunk'
                : '';
        return (
          // A posição é a identidade de uma linha de diff: a lista nunca se reordena.
          <div key={i} className={`diff-line ${kind}`}>
            {line || ' '}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Rever uma importação antes de entrar na biblioteca (ADR 0019): o resumo e a triagem da skill, e o diff de
 * cada ficheiro que ela mudou no Workflow. Aceitar faz o commit lá; descartar repõe-no. Uma importação
 * recusada pela triagem e sem alterações abre sem diff ("Ver porquê").
 */
export function ImportReviewDrawer({ view, busy, onClose, onAccept, onDiscard }: ImportReviewDrawerProps) {
  const [files, setFiles] = useState<ImportFileDiff[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const reviewing = view?.status === 'review';
  const viewId = view?.id;

  useEffect(() => {
    if (!viewId || !reviewing) return;
    let cancelled = false;
    getImportDiff(viewId)
      .then((diff) => !cancelled && setFiles(diff.files))
      .catch((e: unknown) => {
        ErrorHandler.handle(e, { showNotification: false });
        if (!cancelled) setLoadError(ErrorHandler.getMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [viewId, reviewing]);

  const close = () => {
    setFiles(null);
    setLoadError(null);
    onClose();
  };

  const result = view?.result;
  return (
    <Drawer
      open={view !== null}
      onClose={close}
      size={DRAWER_WIDTH.large}
      extra={<span className="kbd">Esc</span>}
      title={
        <div className="flex flex-col gap-1">
          <h6 className="kicker m-0">Importação</h6>
          <h2 className="m-0 text-[20px] leading-[26px] font-semibold text-text-1">
            {result?.libraryId ? <span className="font-mono">{result.libraryId}</span> : 'Rever'}
          </h2>
        </div>
      }
      footer={
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-text-3 font-mono truncate">{reviewing ? result?.commitMessage : ''}</span>
          <span className="flex-1" />
          <Space>
            <Button onClick={close} disabled={busy !== null}>
              Fechar
            </Button>
            <Button danger disabled={busy !== null && busy !== 'discard'} loading={busy === 'discard'} onClick={onDiscard}>
              Descartar
            </Button>
            {reviewing && (
              <Button type="primary" disabled={busy !== null && busy !== 'accept'} loading={busy === 'accept'} onClick={onAccept}>
                Aceitar
              </Button>
            )}
          </Space>
        </div>
      }
    >
      {view && (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <span className="text-[12.5px] text-text-3">Resumo da skill</span>
            {/* Markdown curto da skill, mostrado como texto (a app ainda não tem renderizador de Markdown). */}
            <p className="m-0 whitespace-pre-wrap text-[13.5px] leading-[21px] text-text-1">{result?.summary || '—'}</p>
          </section>

          {result && result.triage.length > 0 && (
            <section className="flex flex-col gap-2">
              <span className="text-[12.5px] text-text-3">Triagem</span>
              <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
                {result.triage.map((item) => (
                  <li key={item.criterion} className="flex gap-2.5 text-[13px] leading-[19px]">
                    {/* Forma e cor: ✓ sucesso, ✕ erro. */}
                    <span className={`w-4 flex-none font-bold ${item.ok ? 'text-success' : 'text-error'}`} aria-label={item.ok ? 'passa' : 'falha'}>
                      {item.ok ? '✓' : '✕'}
                    </span>
                    <span className="w-28 flex-none text-text-1">{item.criterion}</span>
                    <span className="text-text-2">{item.note}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {reviewing && (
            <section className="flex flex-col gap-2">
              <span className="text-[12.5px] text-text-3">
                {view.changedFiles} {view.changedFiles === 1 ? 'ficheiro' : 'ficheiros'} no Workflow
              </span>
              {files && files.some((file) => !insideImportScope(file.path)) && (
                <Alert
                  type="warning"
                  showIcon
                  title="Esta importação mexeu fora da biblioteca"
                  description={
                    <>
                      Uma importação só devia escrever em <span className="font-mono">library/</span> e em{' '}
                      <span className="font-mono">docs/provenance.md</span>. Revê os ficheiros assinalados antes de aceitar — se
                      não forem para ficar, descarta e corrige-os à parte.
                    </>
                  }
                />
              )}
              {loadError ? (
                <Alert type="error" showIcon title={loadError} />
              ) : files === null ? (
                <Spin />
              ) : (
                <Collapse
                  size="small"
                  defaultActiveKey={files.length <= 3 ? files.map((f) => f.path) : []}
                  items={files.map((file) => ({
                    key: file.path,
                    label: (
                      <span className="flex items-center gap-2 min-w-0">
                        <span className={CHANGE_LABEL[file.change].className}>{CHANGE_LABEL[file.change].text}</span>
                        {!insideImportScope(file.path) && <span className="tag tag-err">Fora da biblioteca</span>}
                        <span className="font-mono text-[12.5px] text-text-1 truncate">{file.path}</span>
                      </span>
                    ),
                    children: (
                      <div className="flex flex-col gap-2">
                        <DiffLines diff={file.diff} />
                        {file.truncated && <span className="text-[12px] text-text-3">Cortado a 200 KB — o resto está no ficheiro.</span>}
                      </div>
                    ),
                  }))}
                />
              )}
            </section>
          )}
        </div>
      )}
    </Drawer>
  );
}
