import { useEffect, useState } from 'react';
import { ArrowLeftOutlined, FolderOutlined } from '@ant-design/icons';
import { Button, Modal, Spin } from 'antd';
import { ErrorHandler } from '@/errors/errorHandler';
import { browseFolder, getFolders } from '@/services/folderService';
import type { FolderBrowse, FolderList } from '@/types/folder';
import { folderName } from '../terminalDisplay';

type OpenFolderModalProps = {
  open: boolean;
  onClose: () => void;
  /** Abre um terminal novo na pasta escolhida (passa a ser um projeto na lateral). Lança o erro para ficar aqui. */
  onOpen: (path: string) => Promise<void>;
};

/**
 * "Abrir outra pasta…" do seletor de projeto (proposta C do ADR 0036): uma pasta que não está no registo do
 * Workflow. Mostra as raízes, as favoritas e as recentes; navega-se para dentro com `/api/folders/browse`, que nunca
 * sai das `ALLOWED_ROOTS`. Abrir = um terminal novo nessa pasta.
 */
export function OpenFolderModal({ open, onClose, onOpen }: OpenFolderModalProps) {
  return open ? <OpenFolderBody onClose={onClose} onOpen={onOpen} /> : null;
}

function OpenFolderBody({ onClose, onOpen }: Omit<OpenFolderModalProps, 'open'>) {
  const [list, setList] = useState<FolderList | null>(null);
  const [current, setCurrent] = useState<FolderBrowse | null>(null);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getFolders()
      .then((folders) => !cancelled && setList(folders))
      .catch((e: unknown) => ErrorHandler.handle(e));
    return () => {
      cancelled = true;
    };
  }, []);

  const enter = async (path: string) => {
    setLoading(true);
    try {
      setCurrent(await browseFolder(path));
    } catch (e) {
      ErrorHandler.handle(e);
    } finally {
      setLoading(false);
    }
  };

  const openHere = async (path: string) => {
    setOpening(true);
    try {
      await onOpen(path);
      onClose();
    } catch (e) {
      ErrorHandler.handle(e);
    } finally {
      setOpening(false);
    }
  };

  const start = list ? [...new Set([...list.favorites.map((f) => f.path), ...list.recents.map((f) => f.path), ...list.roots])] : [];
  const rows = current ? current.entries.map((entry) => ({ path: entry.path, name: entry.name, meta: entry.sessionCount > 0 ? `${entry.sessionCount} sessões` : '' })) : start.map((path) => ({ path, name: folderName(path), meta: path }));

  return (
    <Modal
      open
      title="Abrir outra pasta"
      onCancel={onClose}
      width={520}
      footer={
        <div className="flex items-center gap-2">
          <span className="flex-1 min-w-0 truncate text-left font-mono text-[11px] text-text-3" data-open-folder-current={current?.path ?? ''}>
            {current?.path ?? 'Escolhe uma pasta'}
          </span>
          <Button onClick={onClose}>Cancelar</Button>
          {/* A carregar outra pasta, o "aqui" ainda é a anterior: desativado, para nunca abrir no sítio errado. */}
          <Button
            type="primary"
            disabled={!current || loading}
            loading={opening}
            onClick={() => current && void openHere(current.path)}
            data-open-folder-confirm
          >
            Novo terminal aqui
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-1 min-h-[240px]" data-open-folder>
        {current && (
          <button
            type="button"
            onClick={() => (current.parent ? void enter(current.parent) : setCurrent(null))}
            className="h-[var(--wfa-row-height)] flex items-center gap-2 px-2 rounded-sm border-0 bg-transparent cursor-pointer text-text-3 hover:bg-surface-2 hover:text-text-1"
          >
            <ArrowLeftOutlined className="text-[11px]" />
            {current.parent ? folderName(current.parent) : 'Raízes, favoritas e recentes'}
          </button>
        )}
        {(list === null || loading) && <Spin className="self-center mt-6" />}
        {!loading &&
          rows.map((row) => (
            <button
              key={row.path}
              type="button"
              data-folder-row={row.path}
              onClick={() => void enter(row.path)}
              className="h-8 flex items-center gap-2 px-2 rounded-sm border-0 bg-transparent cursor-pointer text-left text-text-1 hover:bg-surface-2"
            >
              <FolderOutlined className="text-accent" />
              <span className="flex-none text-[13px]">{row.name}</span>
              <span className="flex-1 min-w-0 truncate text-right font-mono text-[10.5px] text-text-3">{row.meta}</span>
            </button>
          ))}
        {!loading && current && rows.length === 0 && <p className="m-0 px-2 py-4 text-text-3">Sem subpastas.</p>}
      </div>
    </Modal>
  );
}
