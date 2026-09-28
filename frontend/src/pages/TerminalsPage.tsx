import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Spin } from 'antd';
import { NewTerminalDrawer } from '@/components/terminals/new/NewTerminalDrawer';
import { displayNames, groupByProject, orderedTerminals } from '@/components/terminals/projects';
import { TerminalPane } from '@/components/terminals/TerminalPane';
import { TerminalSidebar } from '@/components/terminals/TerminalSidebar';
import { ErrorHandler, getApiErrorResponse } from '@/errors/errorHandler';
import { useConfirm } from '@/hooks/useConfirm';
import { type ShortcutAction, useTerminalShortcuts } from '@/hooks/useTerminalShortcuts';
import { useTerminals } from '@/hooks/useTerminals';
import { getFolders, setFavoriteFolder } from '@/services/folderService';
import { notificationService } from '@/services/general/notificationService';
import { estimateTerminalSize } from '@/terminal/terminalSize';
import type { CreateTerminalBody, TerminalSize } from '@/types/terminal';

const PANE_HEADER_HEIGHT = 44;

type DrawerState = { open: boolean; key: number; folder?: string; mode?: 'new' | 'resume' };

/**
 * Terminais em foco dividido (protótipos 1g/1h), com a lateral por projetos (spec §3, 2026-09-28): a lateral e
 * um painel, ou dois com Alt+\. Os terminais fora do ecrã continuam montados — ligados, sem replay ao voltar.
 */
export function TerminalsPage() {
  const { terminals, loading, error, refresh, create, reopen, rename, close, markExited } = useTerminals();
  const confirm = useConfirm();
  const mainRef = useRef<HTMLDivElement>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [splitId, setSplitId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const previousId = useRef<string | null>(null);
  // Cada abertura remonta o drawer (key): o formulário começa limpo sem reset num efeito.
  const [drawer, setDrawer] = useState<DrawerState>({ open: false, key: 0 });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [reopening, setReopening] = useState<Set<string>>(new Set());
  const [reopeningAll, setReopeningAll] = useState(false);
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [favoritesVersion, setFavoritesVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getFolders()
      .then((list) => !cancelled && setFavorites(list.favorites.map((f) => f.path)))
      .catch((e: unknown) => ErrorHandler.handle(e));
    return () => {
      cancelled = true;
    };
  }, [favoritesVersion]);

  const projects = useMemo(() => groupByProject(terminals, favorites), [terminals, favorites]);
  const ordered = useMemo(() => orderedTerminals(projects), [projects]);
  const names = useMemo(() => displayNames(projects), [projects]);
  const shortcutIndex = useMemo(() => new Map(ordered.map((t, i) => [t.id, i])), [ordered]);

  // A seleção tem de apontar sempre para um terminal que existe (fechar, fechar noutro separador…).
  const exists = useCallback((id: string | null) => !!id && terminals.some((t) => t.id === id), [terminals]);
  const primaryId = exists(selectedId) ? selectedId : (ordered[0]?.id ?? null);
  const secondaryId = exists(splitId) && splitId !== primaryId ? splitId : null;
  const keyboardId = activeId === secondaryId && secondaryId ? secondaryId : primaryId;
  const visibleIds = [primaryId, secondaryId].filter((id): id is string => !!id);

  const openDrawer = useCallback((folder?: string, mode?: 'new' | 'resume') => {
    setDrawer((state) => ({ open: true, key: state.key + 1, folder, mode }));
  }, []);

  const paneSize = useCallback((): TerminalSize => {
    const main = mainRef.current;
    const width = main?.clientWidth ?? window.innerWidth - 288;
    const height = (main?.clientHeight ?? window.innerHeight - 74) - PANE_HEADER_HEIGHT - 10;
    return estimateTerminalSize(secondaryId ? width / 2 - 14 : width - 14, height);
  }, [secondaryId]);

  const select = useCallback(
    (id: string) => {
      if (id === secondaryId) {
        setActiveId(id);
        return;
      }
      if (id !== primaryId) previousId.current = primaryId;
      setSelectedId(id);
      setActiveId(id);
    },
    [primaryId, secondaryId],
  );

  const handleCreate = async (body: Omit<CreateTerminalBody, 'cols' | 'rows'>) => {
    const view = await create({ ...body, ...paneSize() });
    select(view.id);
  };

  /** O + de um projeto: mais um terminal na mesma pasta, sessão nova, sem drawer. */
  const handleNewInProject = async (path: string) => {
    setCreatingIn(path);
    try {
      await handleCreate({ cwd: path, mode: 'new' });
    } catch (e) {
      ErrorHandler.handle(e);
    } finally {
      setCreatingIn(null);
    }
  };

  const handleToggleFavorite = async (path: string, favorite: boolean) => {
    try {
      await setFavoriteFolder(path, favorite);
      setFavoritesVersion((n) => n + 1);
    } catch (e) {
      ErrorHandler.handle(e);
    }
  };

  const reopenOne = async (id: string) => {
    const view = await reopen(id, paneSize());
    if (view.freshSession) {
      notificationService.info('Conversa nova', `${names.get(id) ?? 'O terminal'} não tinha conversa gravada — começou uma sessão nova.`);
    }
  };

  const handleReopen = async (id: string) => {
    setReopening((set) => new Set(set).add(id));
    try {
      await reopenOne(id);
    } catch (e) {
      ErrorHandler.handle(e);
    } finally {
      setReopening((set) => {
        const next = new Set(set);
        next.delete(id);
        return next;
      });
    }
  };

  /** Reabre os parados pela ordem da lateral, e para no limite de terminais (o resto fica parado). */
  const handleReopenAll = async () => {
    setReopeningAll(true);
    try {
      for (const terminal of ordered.filter((t) => t.status === 'stopped')) {
        try {
          await reopenOne(terminal.id);
        } catch (e) {
          ErrorHandler.handle(e);
          if (getApiErrorResponse(e)?.errorCode === 'TERMINAL_002') break;
        }
      }
    } finally {
      setReopeningAll(false);
    }
  };

  const requestClose = useCallback(
    (id: string) => {
      if (!exists(id)) return;
      confirm({
        title: `Fechar ${names.get(id)}?`,
        actionLabel: 'Fechar terminal',
        message: 'O processo do Claude Code termina. A conversa fica gravada e podes retomá-la em Novo terminal → Retomar.',
        onConfirm: async () => {
          try {
            await close(id);
          } catch (e) {
            ErrorHandler.handle(e);
          }
        },
      });
    },
    [exists, names, confirm, close],
  );

  const toggleSplit = useCallback(() => {
    if (secondaryId) {
      setSplitId(null);
      setActiveId(primaryId);
      return;
    }
    // Divide com o terminal anterior; sem anterior, com o seguinte na ordem da lateral.
    const candidate =
      (exists(previousId.current) && previousId.current !== primaryId ? previousId.current : null) ??
      ordered.find((t) => t.id !== primaryId)?.id ??
      null;
    if (candidate) {
      setSplitId(candidate);
      setActiveId(candidate);
    }
  }, [secondaryId, primaryId, exists, ordered]);

  useTerminalShortcuts((action: ShortcutAction) => {
    switch (action.type) {
      case 'new':
        openDrawer();
        break;
      case 'jump': {
        const target = ordered[action.index];
        if (target) select(target.id);
        break;
      }
      case 'split':
        toggleSplit();
        break;
      case 'close':
        if (keyboardId) requestClose(keyboardId);
        break;
      case 'rename':
        if (keyboardId) setRenamingId(keyboardId);
        break;
    }
  }, !drawer.open);

  // Um terminal que termina fora do ecrã só se nota por isto — não há estados "a trabalhar" no MVP.
  const handleExit = (id: string, code: number) => {
    markExited(id, code);
    if (exists(id) && !visibleIds.includes(id)) {
      notificationService.action(`${names.get(id)} terminou`, 'A sessão ficou gravada.', {
        label: 'Reabrir',
        onClick: () => {
          select(id);
          void handleReopen(id);
        },
      });
    }
  };

  const handleRenameEnd = async (id: string, label: string | null | undefined) => {
    setRenamingId(null);
    if (label === undefined) return;
    try {
      await rename(id, label);
    } catch (e) {
      ErrorHandler.handle(e);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spin />
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <TerminalSidebar
        projects={projects}
        names={names}
        shortcutIndex={shortcutIndex}
        visibleIds={visibleIds}
        onSelect={select}
        onNew={() => openDrawer()}
        onNewInProject={(path) => void handleNewInProject(path)}
        onResumeInProject={(path) => openDrawer(path, 'resume')}
        onToggleFavorite={(path, favorite) => void handleToggleFavorite(path, favorite)}
        creatingIn={creatingIn}
        onReopenAll={() => void handleReopenAll()}
        reopeningAll={reopeningAll}
      />
      <main ref={mainRef} className="flex-1 min-w-0 flex gap-px bg-border">
        {error && (
          <div className="flex-1 bg-bg p-8">
            <Alert type="error" showIcon title={error} action={<Button size="small" onClick={refresh}>Tentar de novo</Button>} />
          </div>
        )}
        {!error && terminals.length === 0 && (
          <div className="flex-1 bg-bg flex flex-col items-center justify-center gap-3">
            <p className="m-0 text-text-1 font-semibold">Nenhum terminal aberto</p>
            <p className="m-0 text-text-2 text-[13px]">Abre uma sessão do Claude Code numa das pastas autorizadas.</p>
            <Button type="primary" onClick={() => openDrawer()}>
              + Novo terminal <span className="font-mono text-[10.5px] opacity-75">Alt+N</span>
            </Button>
          </div>
        )}
        {!error &&
          // A ordem no DOM é a da lista (os xterm.js não se remontam); a ordem visual é a do foco dividido.
          terminals.map((terminal) => (
            <div
              key={`${terminal.id}:${terminal.lastOpenedAt}`}
              className={visibleIds.includes(terminal.id) ? 'flex-1 min-w-0 flex' : 'hidden'}
              style={{ order: terminal.id === secondaryId ? 2 : 1 }}
            >
              <TerminalPane
                terminal={terminal}
                name={names.get(terminal.id) ?? ''}
                visible={visibleIds.includes(terminal.id)}
                focused={terminal.id === keyboardId}
                split={!!secondaryId}
                renaming={renamingId === terminal.id}
                reopening={reopening.has(terminal.id)}
                onActivate={() => setActiveId(terminal.id)}
                onRenameStart={() => setRenamingId(terminal.id)}
                onRenameEnd={(label) => void handleRenameEnd(terminal.id, label)}
                onSplit={toggleSplit}
                onClose={() => requestClose(terminal.id)}
                onReopen={() => void handleReopen(terminal.id)}
                onExit={(code) => handleExit(terminal.id, code)}
                onGone={refresh}
              />
            </div>
          ))}
      </main>
      <NewTerminalDrawer
        key={drawer.key}
        open={drawer.open}
        initialFolder={drawer.folder}
        initialMode={drawer.mode}
        onClose={() => setDrawer((state) => ({ ...state, open: false }))}
        onCreate={async (body) => {
          await handleCreate(body);
          setFavoritesVersion((n) => n + 1);
        }}
      />
    </div>
  );
}
