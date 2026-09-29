import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Spin } from 'antd';
import { NewTerminalDrawer } from '@/components/terminals/new/NewTerminalDrawer';
import { ProjectTabs } from '@/components/terminals/ProjectTabs';
import { DEFAULT_GRID_STYLE, type GridStyle, initialSlotIds, slotPlacement } from '@/components/terminals/gridStyle';
import { GridStylePicker } from '@/components/terminals/GridStylePicker';
import { displayNames, type Project, joinProjects, projectsWithTerminals } from '@/components/terminals/projects';
import { QuotaMeter } from '@/components/terminals/QuotaMeter';
import { TerminalGrid } from '@/components/terminals/TerminalGrid';
import { TerminalPane } from '@/components/terminals/TerminalPane';
import { TerminalSidebar } from '@/components/terminals/TerminalSidebar';
import { ErrorHandler, getApiErrorResponse } from '@/errors/errorHandler';
import { useConfirm } from '@/hooks/useConfirm';
import { useLayoutMode } from '@/hooks/useLayoutMode';
import { useProjects } from '@/hooks/useProjects';
import { type ShortcutAction, useTerminalShortcuts } from '@/hooks/useTerminalShortcuts';
import { useTerminals } from '@/hooks/useTerminals';
import { useUsage } from '@/hooks/useUsage';
import { getFolders, setFavoriteFolder } from '@/services/folderService';
import { notificationService } from '@/services/general/notificationService';
import { estimateTerminalSize } from '@/terminal/terminalSize';
import type { CreateTerminalBody, TerminalSize } from '@/types/terminal';

const PANE_HEADER_HEIGHT = 44;
const FONT_DELTA_LIMITS = { min: -4, max: 16 };

type DrawerState = { open: boolean; key: number; folder?: string; mode?: 'new' | 'resume' };

/** O foco/split/ampliado ficam por projeto — trocar de separador nunca mistura nem perde o de outro.
 * `gridStyle`/`slotIds` (spec docs/features/estilos-de-grelha.md) só se usam fora de `classic` — os
 * lugares fixos do estilo escolhido, na Grelha. */
type ProjectLayout = {
  selectedId: string | null;
  splitId: string | null;
  enlargedId: string | null;
  activeId: string | null;
  previousId: string | null;
  gridStyle: GridStyle;
  slotIds: (string | null)[];
};
const EMPTY_LAYOUT: ProjectLayout = {
  selectedId: null,
  splitId: null,
  enlargedId: null,
  activeId: null,
  previousId: null,
  gridStyle: DEFAULT_GRID_STYLE,
  slotIds: [],
};

/**
 * Terminais navegados **por projeto** (spec docs/features/separadores-de-projetos.md, 2026-09-28): a
 * lateral lista os projetos (registo do Workflow + terminais existentes), cada projeto aberto ganha um
 * separador tipo browser, e dentro dele mantém-se o foco dividido/grelha da spec original (docs/features/terminais.md
 * §3) — mas só com os terminais desse projeto. Os terminais de projetos não ativos continuam montados
 * (escondidos, sem replay), exatamente como um terminal "fora do ecrã" já ficava antes desta spec.
 */
export function TerminalsPage() {
  const { terminals, loading: terminalsLoading, error, refresh, create, reopen, rename, close, markExited } = useTerminals();
  const { projects: registry, loading: registryLoading } = useProjects();
  const confirm = useConfirm();
  const mainRef = useRef<HTMLDivElement>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesVersion, setFavoritesVersion] = useState(0);
  const [layout] = useLayoutMode();
  const { usage, now } = useUsage();

  const [openPaths, setOpenPaths] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [layouts, setLayouts] = useState<Record<string, ProjectLayout>>({});
  const seeded = useRef(false);

  const [drawer, setDrawer] = useState<DrawerState>({ open: false, key: 0 });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [reopening, setReopening] = useState<Set<string>>(new Set());
  const [reopeningAll, setReopeningAll] = useState(false);
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [fontDelta, setFontDelta] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getFolders()
      .then((list) => !cancelled && setFavorites(list.favorites.map((f) => f.path)))
      .catch((e: unknown) => ErrorHandler.handle(e));
    return () => {
      cancelled = true;
    };
  }, [favoritesVersion]);

  const projects = useMemo(() => joinProjects(registry, terminals, favorites), [registry, terminals, favorites]);
  const names = useMemo(() => displayNames(projects), [projects]);
  const grid = layout === 'grid';

  // Ao carregar: um separador por cada projeto que já tem terminais (spec §3) — só uma vez.
  useEffect(() => {
    if (seeded.current || terminalsLoading || registryLoading) return;
    seeded.current = true;
    const withTerminals = projectsWithTerminals(projects).map((p) => p.path);
    setOpenPaths(withTerminals);
    setActivePath(withTerminals[0] ?? null);
  }, [terminalsLoading, registryLoading, projects]);

  const openProjects = useMemo(
    () => openPaths.map((path) => projects.find((p) => p.path === path)).filter((p): p is Project => !!p),
    [openPaths, projects],
  );
  const activeProject = useMemo(() => projects.find((p) => p.path === activePath) ?? null, [projects, activePath]);
  const activeTerminals = useMemo(() => activeProject?.terminals ?? [], [activeProject]);

  const layoutFor = useCallback((path: string) => layouts[path] ?? EMPTY_LAYOUT, [layouts]);
  const updateLayout = useCallback((path: string, patch: Partial<ProjectLayout>) => {
    setLayouts((prev) => ({ ...prev, [path]: { ...(prev[path] ?? EMPTY_LAYOUT), ...patch } }));
  }, []);

  const activeLayout = activePath ? layoutFor(activePath) : EMPTY_LAYOUT;
  // A seleção tem de apontar sempre para um terminal do projeto ativo que existe (fechar, terminar…).
  const existsInActive = useCallback((id: string | null) => !!id && activeTerminals.some((t) => t.id === id), [activeTerminals]);
  const primaryId = existsInActive(activeLayout.selectedId) ? activeLayout.selectedId : (activeTerminals[0]?.id ?? null);
  const secondaryId = existsInActive(activeLayout.splitId) && activeLayout.splitId !== primaryId ? activeLayout.splitId : null;
  const enlarged = grid && existsInActive(activeLayout.enlargedId) ? activeLayout.enlargedId : null;
  const keyboardId = grid
    ? (enlarged ?? (existsInActive(activeLayout.activeId) ? activeLayout.activeId : null))
    : activeLayout.activeId === secondaryId && secondaryId
      ? secondaryId
      : primaryId;
  const gridStyle = activeLayout.gridStyle;
  const usesSlots = gridStyle.kind !== 'classic';
  // Um lugar cujo id já não existe (fechado) conta como vazio — lido sempre por este filtro, nunca por um
  // efeito que limpa `slotIds` à parte (spec estilos-de-grelha §4.1).
  const sanitizedSlotIds = activeLayout.slotIds.map((id) => (existsInActive(id) ? id : null));
  const visibleIds = grid
    ? enlarged
      ? [enlarged]
      : usesSlots
        ? sanitizedSlotIds.filter((id): id is string => !!id)
        : activeTerminals.map((t) => t.id)
    : [primaryId, secondaryId].filter((id): id is string => !!id);
  const shortcutIndex = useMemo(() => new Map(activeTerminals.map((t, i) => [t.id, i])), [activeTerminals]);

  const openDrawer = useCallback((folder?: string, mode?: 'new' | 'resume') => {
    setDrawer((state) => ({ open: true, key: state.key + 1, folder, mode }));
  }, []);

  const paneSize = useCallback((split: boolean): TerminalSize => {
    const main = mainRef.current;
    const width = main?.clientWidth ?? window.innerWidth - 288;
    const height = (main?.clientHeight ?? window.innerHeight - 74) - PANE_HEADER_HEIGHT - 10;
    return estimateTerminalSize(split ? width / 2 - 14 : width - 14, height);
  }, []);

  /** Abre/foca o separador de `path` e faz de `id` o foco (respeita foco dividido vs. grelha). */
  const focusTerminal = useCallback(
    (path: string, id: string) => {
      setOpenPaths((prev) => (prev.includes(path) ? prev : [...prev, path]));
      setActivePath(path);
      setLayouts((prev) => {
        const current = prev[path] ?? EMPTY_LAYOUT;
        if (grid) return { ...prev, [path]: { ...current, enlargedId: id, activeId: id } };
        return { ...prev, [path]: { ...current, selectedId: id, splitId: null, activeId: id, previousId: current.selectedId } };
      });
    },
    [grid],
  );

  /**
   * Clicar um terminal (lateral, mosaico, ou painel): abre/foca o separador do projeto dele e dá-lhe o
   * teclado — na grelha, nunca amplia (um clique só edita no mosaico; duplo clique amplia, ver
   * `enlargeTerminal`). Ao mudar de projeto mantém o separador tal como ficou ("trocar de separador e
   * voltar mostra o projeto tal como foi deixado", spec separadores-de-projetos §3). Fora de `classic`
   * (spec estilos-de-grelha), um terminal que não está em nenhum lugar troca para o lugar que tinha o
   * teclado — nunca o mais antigo (§2 "Excesso").
   */
  const selectTerminal = useCallback(
    (id: string) => {
      const project = projects.find((p) => p.terminals.some((t) => t.id === id));
      if (!project) return;
      const path = project.path;
      setOpenPaths((prev) => (prev.includes(path) ? prev : [...prev, path]));
      setActivePath(path);
      setLayouts((prev) => {
        const current = prev[path] ?? EMPTY_LAYOUT;
        if (grid) {
          if (current.gridStyle.kind === 'classic' || current.slotIds.includes(id)) {
            return { ...prev, [path]: { ...current, activeId: id } };
          }
          const targetIndex = current.slotIds.indexOf(current.activeId);
          const slotIds = [...current.slotIds];
          slotIds[targetIndex === -1 ? 0 : targetIndex] = id;
          return { ...prev, [path]: { ...current, slotIds, activeId: id } };
        }
        const inProject = (candidate: string | null) => !!candidate && project.terminals.some((t) => t.id === candidate);
        if (id === current.splitId) return { ...prev, [path]: { ...current, activeId: id } };
        const primary = inProject(current.selectedId) ? current.selectedId : (project.terminals[0]?.id ?? null);
        if (id !== primary) return { ...prev, [path]: { ...current, previousId: primary, selectedId: id, activeId: id } };
        return { ...prev, [path]: { ...current, activeId: id } };
      });
    },
    [projects, grid],
  );

  /** Botão de estilo da grelha: muda o arranjo do projeto ativo e recalcula os lugares a partir dos
   * terminais já visíveis (ordem do `shortcutIndex`, a mesma do Alt+1…9). */
  const setGridStyle = useCallback(
    (style: GridStyle) => {
      if (!activePath) return;
      updateLayout(activePath, { gridStyle: style, slotIds: initialSlotIds(style, activeTerminals.map((t) => t.id)) });
    },
    [activePath, activeTerminals, updateLayout],
  );

  /** O "+" de um lugar vazio na grelha (estilo != classic): cria um terminal novo e ocupa-o logo. */
  const handleSlotNew = async (index: number) => {
    if (!activePath) return;
    setCreatingIn(activePath);
    try {
      const view = await create({ cwd: activePath, mode: 'new', ...paneSize(false) });
      setLayouts((prev) => {
        const current = prev[activePath] ?? EMPTY_LAYOUT;
        const slotIds = [...current.slotIds];
        slotIds[index] = view.id;
        return { ...prev, [activePath]: { ...current, slotIds, activeId: view.id } };
      });
    } catch (e) {
      ErrorHandler.handle(e);
    } finally {
      setCreatingIn(null);
    }
  };

  /** Duplo clique num mosaico (ou Alt+1…9): amplia-o para fullscreen — só dentro do projeto já ativo. */
  const enlargeTerminal = useCallback(
    (id: string) => {
      if (!activePath) return;
      updateLayout(activePath, { enlargedId: id, activeId: id });
    },
    [activePath, updateLayout],
  );

  /** Clique fora de qualquer mosaico, na grelha: larga o teclado do que estava em edição. */
  const clearGridFocus = useCallback(() => {
    if (!activePath) return;
    updateLayout(activePath, { activeId: null });
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, [activePath, updateLayout]);

  /** Sair da ampliação ("Voltar à grelha", Esc, Alt+\, Alt+N no já ampliado): larga o teclado também —
   * ao voltar à grelha o terminal não deve continuar como se estivesse pronto a escrever. */
  const exitEnlarge = useCallback(() => {
    if (!activePath) return;
    updateLayout(activePath, { enlargedId: null, activeId: null });
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, [activePath, updateLayout]);

  const handleCreate = async (body: Omit<CreateTerminalBody, 'cols' | 'rows'>) => {
    const view = await create({ ...body, ...paneSize(false) });
    focusTerminal(body.cwd, view.id);
  };

  /** O "+" de um projeto (lateral, cabeçalho da grelha): mais um terminal, sessão nova, sem drawer. */
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

  /** Clicar um projeto na lateral: sem terminais, cria logo o primeiro; com terminais, abre/foca o separador. */
  const handleSelectProject = async (path: string) => {
    const project = projects.find((p) => p.path === path);
    if (project && project.terminals.length > 0) {
      setOpenPaths((prev) => (prev.includes(path) ? prev : [...prev, path]));
      setActivePath(path);
      return;
    }
    await handleNewInProject(path);
  };

  /** Esconde o separador — os terminais do projeto continuam a correr (spec §3). */
  const closeTab = useCallback(
    (path: string) => {
      setOpenPaths((prev) => prev.filter((p) => p !== path));
      setActivePath((current) => {
        if (current !== path) return current;
        const next = openPaths.filter((p) => p !== path);
        return next[0] ?? null;
      });
    },
    [openPaths],
  );

  const handleToggleFavorite = async (path: string, favorite: boolean) => {
    try {
      await setFavoriteFolder(path, favorite);
      setFavoritesVersion((n) => n + 1);
    } catch (e) {
      ErrorHandler.handle(e);
    }
  };

  const reopenOne = async (id: string) => {
    const view = await reopen(id, paneSize(false));
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

  /** Reabre os parados de todos os projetos, e para no limite de terminais (o resto fica parado). */
  const handleReopenAll = async () => {
    setReopeningAll(true);
    try {
      for (const terminal of projects.flatMap((p) => p.terminals).filter((t) => t.status === 'stopped')) {
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
    [names, confirm, close],
  );

  const toggleSplit = () => {
    if (!activePath) return;
    if (secondaryId) {
      updateLayout(activePath, { splitId: null, activeId: primaryId });
      return;
    }
    const candidate =
      (existsInActive(activeLayout.previousId) && activeLayout.previousId !== primaryId ? activeLayout.previousId : null) ??
      activeTerminals.find((t) => t.id !== primaryId)?.id ??
      null;
    if (candidate) updateLayout(activePath, { splitId: candidate, activeId: candidate });
  };

  useTerminalShortcuts((action: ShortcutAction) => {
    switch (action.type) {
      case 'new':
        if (activePath) void handleNewInProject(activePath);
        break;
      case 'jump': {
        const target = activeTerminals[action.index];
        if (target) {
          if (grid) {
            // Alt+N no terminal já ampliado: alterna de volta à grelha em vez de não fazer nada.
            if (enlarged === target.id) exitEnlarge();
            else enlargeTerminal(target.id);
          } else selectTerminal(target.id);
        }
        break;
      }
      case 'split':
        if (grid) {
          if (enlarged) exitEnlarge();
        } else toggleSplit();
        break;
      case 'close':
        if (keyboardId) requestClose(keyboardId);
        break;
      case 'rename':
        if (keyboardId) setRenamingId(keyboardId);
        break;
      case 'zoom':
        setFontDelta((current) => {
          if (action.direction === 'reset') return 0;
          const next = current + (action.direction === 'in' ? 1 : -1);
          return Math.max(FONT_DELTA_LIMITS.min, Math.min(FONT_DELTA_LIMITS.max, next));
        });
        break;
    }
  }, !drawer.open);

  // Esc volta à grelha — só fora do terminal: lá dentro o Esc é do Claude Code (interromper).
  useEffect(() => {
    if (!enlarged || drawer.open || !activePath) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || (event.target instanceof Element && event.target.closest('.xterm'))) return;
      exitEnlarge();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enlarged, drawer.open, activePath, exitEnlarge]);

  // Um terminal que termina fora do ecrã só se nota por isto — não há estados "a trabalhar" no MVP.
  const handleExit = (id: string, code: number) => {
    markExited(id, code);
    if (!visibleIds.includes(id)) {
      notificationService.action(`${names.get(id)} terminou`, 'A sessão ficou gravada.', {
        label: 'Reabrir',
        onClick: () => {
          selectTerminal(id);
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

  if (terminalsLoading || registryLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spin />
      </div>
    );
  }

  const paneFor = (terminal: (typeof terminals)[number], tile: boolean) => (
    <TerminalPane
      terminal={terminal}
      name={names.get(terminal.id) ?? ''}
      fontDelta={fontDelta}
      variant={tile ? 'tile' : 'pane'}
      enlarged={tile && terminal.id === enlarged}
      visible={visibleIds.includes(terminal.id)}
      focused={terminal.id === keyboardId}
      renaming={renamingId === terminal.id}
      reopening={reopening.has(terminal.id)}
      onActivate={() => selectTerminal(terminal.id)}
      onEnlarge={() => enlargeTerminal(terminal.id)}
      onRenameEnd={(label) => void handleRenameEnd(terminal.id, label)}
      onReopen={() => void handleReopen(terminal.id)}
      onExit={(code) => handleExit(terminal.id, code)}
      onGone={refresh}
    />
  );

  const errorState = error && (
    <div className="flex-1 bg-bg p-8">
      <Alert type="error" showIcon title={error} action={<Button size="small" onClick={refresh}>Tentar de novo</Button>} />
    </div>
  );

  const noActiveProject = (
    <div className="flex-1 bg-bg flex flex-col items-center justify-center gap-3">
      <p className="m-0 text-text-1 font-semibold">Nenhum projeto aberto</p>
      <p className="m-0 text-text-2 text-[13px]">Escolhe um projeto na lateral para abrir um separador.</p>
    </div>
  );

  const emptyProject = activeProject && (
    <div className="flex-1 bg-bg flex flex-col items-center justify-center gap-3">
      <p className="m-0 text-text-1 font-semibold">Nenhum terminal em {activeProject.name}</p>
      <Button type="primary" onClick={() => void handleNewInProject(activeProject.path)} loading={creatingIn === activeProject.path}>
        + Novo terminal aqui
      </Button>
    </div>
  );

  const drawerElement = (
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
  );

  const sidebar = (
    <TerminalSidebar
      projects={projects}
      activePath={activePath}
      names={names}
      shortcutIndex={shortcutIndex}
      visibleIds={visibleIds}
      onSelectProject={(path) => void handleSelectProject(path)}
      onSelectTerminal={selectTerminal}
      onNewInProject={(path) => void handleNewInProject(path)}
      onResumeInProject={(path) => openDrawer(path, 'resume')}
      onToggleFavorite={(path, favorite) => void handleToggleFavorite(path, favorite)}
      creatingIn={creatingIn}
      onReopenAll={() => void handleReopenAll()}
      reopeningAll={reopeningAll}
      footer={<QuotaMeter usage={usage} now={now} variant="sidebar" />}
    />
  );

  return (
    <div className="h-full flex">
      {sidebar}
      <div className="flex-1 min-w-0 flex flex-col">
        <ProjectTabs projects={openProjects} activePath={activePath} onSelect={setActivePath} onClose={closeTab} />
        {errorState}
        {!error && grid && (
          <TerminalGrid
            terminals={activeTerminals}
            enlarged={!!enlarged}
            onBackgroundMouseDown={clearGridFocus}
            headerExtra={<QuotaMeter usage={usage} now={now} variant="header" />}
            stylePicker={<GridStylePicker value={gridStyle} onChange={setGridStyle} />}
            style={gridStyle}
            slotIds={sanitizedSlotIds}
            onSlotNew={(index) => void handleSlotNew(index)}
          >
            {terminals.map((terminal) => {
              const visible = visibleIds.includes(terminal.id);
              const placement =
                visible && !enlarged && usesSlots ? slotPlacement(gridStyle, sanitizedSlotIds.indexOf(terminal.id)) : undefined;
              return (
                <div
                  key={`${terminal.id}:${terminal.lastOpenedAt}`}
                  className={visible ? 'min-h-0 min-w-0 flex flex-1' : 'hidden'}
                  style={placement}
                >
                  {paneFor(terminal, true)}
                </div>
              );
            })}
            {!activeProject && noActiveProject}
            {activeProject && activeTerminals.length === 0 && emptyProject}
          </TerminalGrid>
        )}
        {!error && !grid && (
          <main ref={mainRef} className="flex-1 min-w-0 flex gap-px bg-border">
            {terminals.map((terminal) => (
              <div
                key={`${terminal.id}:${terminal.lastOpenedAt}`}
                className={visibleIds.includes(terminal.id) ? 'flex-1 min-w-0 flex' : 'hidden'}
                style={{ order: terminal.id === secondaryId ? 2 : 1 }}
              >
                {paneFor(terminal, false)}
              </div>
            ))}
            {!activeProject && noActiveProject}
            {activeProject && activeTerminals.length === 0 && emptyProject}
          </main>
        )}
      </div>
      {drawerElement}
    </div>
  );
}
