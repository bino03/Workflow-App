import { useEffect, useState } from 'react';
import { StarFilled, StarOutlined } from '@ant-design/icons';
import { Spin } from 'antd';
import { ErrorHandler } from '@/errors/errorHandler';
import { browseFolder, setFavoriteFolder } from '@/services/folderService';
import type { FolderBrowse, FolderList, FolderView } from '@/types/folder';
import { folderName } from '../terminalDisplay';

type FolderPickerProps = {
  folders: FolderList | null;
  /** A pasta escolhida — é também a que o navegador mostra. */
  value: string;
  onChange: (path: string) => void;
  /** Uma estrela mudou: a lista de favoritas/recentes tem de ser relida. */
  onFavoritesChanged: () => void;
};

function FavoriteToggle({ path, favorite, onDone }: { path: string; favorite: boolean; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      aria-label={favorite ? 'Tirar das favoritas' : 'Marcar como favorita'}
      aria-pressed={favorite}
      disabled={busy}
      className={`bg-transparent border-0 p-1 cursor-pointer leading-none ${favorite ? 'text-warning' : 'text-text-3 hover:text-text-1'}`}
      onClick={async (event) => {
        event.stopPropagation();
        setBusy(true);
        try {
          await setFavoriteFolder(path, !favorite);
          onDone();
        } catch (e) {
          ErrorHandler.handle(e);
        } finally {
          setBusy(false);
        }
      }}
    >
      {favorite ? <StarFilled /> : <StarOutlined />}
    </button>
  );
}

/** Pasta do Novo terminal (protótipo 1j): favoritas · recentes por cima, depois as raízes e o navegador. */
export function FolderPicker({ folders, value, onChange, onFavoritesChanged }: FolderPickerProps) {
  const [browse, setBrowse] = useState<FolderBrowse | null>(null);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const favoritePaths = new Set(folders?.favorites.map((f) => f.path));

  useEffect(() => {
    if (!value) return;
    let cancelled = false;
    browseFolder(value)
      .then((result) => {
        if (cancelled) return;
        setBrowse(result);
        setBrowseError(null);
      })
      .catch((e: unknown) => {
        ErrorHandler.handle(e, { showNotification: false });
        if (!cancelled) setBrowseError(ErrorHandler.getMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  const shortcuts: (FolderView & { kind: 'favorite' | 'recent' })[] = [
    ...(folders?.favorites ?? []).map((f) => ({ ...f, kind: 'favorite' as const })),
    ...(folders?.recents ?? []).map((f) => ({ ...f, kind: 'recent' as const })),
  ];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold">Pasta</span>
        <span className="text-[12px] text-text-3">Só pastas dentro das raízes autorizadas</span>
      </div>

      {shortcuts.length > 0 && (
        <div className="border border-border rounded-md overflow-hidden" aria-label="Favoritas e recentes">
          <div className="h-7 flex items-center px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-3 border-b border-border">
            Favoritas · Recentes
          </div>
          {shortcuts.map((folder) => (
            <div
              key={folder.path}
              role="button"
              tabIndex={0}
              data-folder-shortcut={folder.path}
              onClick={() => onChange(folder.path)}
              onKeyDown={(event) => event.key === 'Enter' && onChange(folder.path)}
              className={`h-[34px] flex items-center gap-2.5 px-3 border-b border-border last:border-b-0 cursor-pointer ${
                folder.path === value ? 'bg-accent-subtle text-text-1' : 'text-text-2 hover:bg-surface-2'
              }`}
            >
              <FavoriteToggle path={folder.path} favorite={folder.kind === 'favorite'} onDone={onFavoritesChanged} />
              <span className="font-mono text-[12.5px] text-text-1">{folderName(folder.path)}</span>
              <span className="flex-1 min-w-0 font-mono text-[11.5px] text-text-3 overflow-hidden text-ellipsis whitespace-nowrap">{folder.path}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {folders?.roots.map((root) => (
          <button
            key={root}
            type="button"
            className="filter-chip font-mono text-[12px]"
            aria-pressed={value === root}
            onClick={() => onChange(root)}
          >
            {root}
          </button>
        ))}
      </div>

      <div className="border border-border rounded-md bg-bg overflow-hidden" aria-label="Navegador de pastas">
        <div className="h-[34px] flex items-center gap-2 px-3 border-b border-border font-mono text-[12px] text-text-2">
          <button
            type="button"
            aria-label="Subir um nível"
            disabled={!browse?.parent}
            onClick={() => browse?.parent && onChange(browse.parent)}
            className="bg-transparent border-0 p-0 text-text-3 cursor-pointer disabled:opacity-30 disabled:cursor-default"
          >
            ↑
          </button>
          <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" title={value}>
            {value || '—'}
          </span>
          {value && <FavoriteToggle path={value} favorite={favoritePaths.has(value)} onDone={onFavoritesChanged} />}
        </div>
        <div className="max-h-[204px] overflow-y-auto">
          {browseError && <div className="px-3 py-2 text-[12.5px] text-error">{browseError}</div>}
          {!browse && !browseError && (
            <div className="py-3 flex justify-center">
              <Spin size="small" />
            </div>
          )}
          {browse?.entries.length === 0 && <div className="px-3 py-2 text-[12.5px] text-text-3">Sem sub-pastas.</div>}
          {browse?.entries.map((entry) => (
            <div
              key={entry.path}
              role="button"
              tabIndex={0}
              data-folder-entry={entry.name}
              onClick={() => onChange(entry.path)}
              onKeyDown={(event) => event.key === 'Enter' && onChange(entry.path)}
              className="h-[34px] flex items-center gap-2.5 px-3 border-b border-border last:border-b-0 cursor-pointer text-text-2 hover:bg-surface-2 hover:text-text-1"
            >
              <span className="w-3 h-[9px] border-[1.5px] border-text-3 rounded-[2px] flex-none" aria-hidden />
              <span className="flex-1 font-mono text-[12.5px]">{entry.name}</span>
              <span className="text-[12px] text-text-3">
                {entry.sessionCount === 0 ? 'sem sessões' : `${entry.sessionCount} ${entry.sessionCount === 1 ? 'sessão gravada' : 'sessões gravadas'}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
