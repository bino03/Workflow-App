import { useCallback, useEffect, useState } from 'react';
import { ErrorHandler } from '@/errors/errorHandler';
import {
  deleteDeploy,
  deleteProjectInfo,
  getProjectInfos,
  registerDeploy as registerDeployRequest,
  saveProjectInfo,
  syncProjectFromGit,
} from '@/services/projectInfoService';
import type { DeployInput, GitSyncWarning, ProjectInfo, ProjectInfoInput } from '@/types/projectInfo';

const tracksGit = (info: ProjectInfo) => info.environments.some((environment) => environment.deployBranch !== null);

/** Voltar à janela relê a lista (e sincroniza do git), no máximo uma vez neste intervalo (ADR 0035). */
const REFRESH_ON_RETURN_MS = 5_000;

/**
 * As fichas dos projetos (ADR 0028), buscadas uma vez. Cada escrita devolve a ficha nova e entra na lista sem
 * esperar por um refresh. As escritas notificam o erro (`ErrorHandler.handle`) e devolvem `null` em caso de falha.
 * Ao carregar e ao voltar à janela, cada ficha com branch de deploy sincroniza do git em fundo (ADR 0035: o backend faz
 * um `ls-remote` e só vai buscar o commit se o topo mudou; nunca por temporizador); os avisos ficam por projeto, sem
 * notificação.
 */
export function useProjectInfos() {
  const [infos, setInfos] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [gitWarnings, setGitWarnings] = useState<Record<string, GitSyncWarning[]>>({});
  const [syncing, setSyncing] = useState<string | null>(null);

  const replace = useCallback((changed: ProjectInfo) => {
    setInfos((current) => [...current.filter((info) => info.projectPath !== changed.projectPath), changed]);
    return changed;
  }, []);

  /** Um sync; `notify` = o botão (notifica erros), sem ele = em fundo (silencioso). */
  const runGitSync = useCallback(
    async (projectPath: string, notify: boolean): Promise<boolean> => {
      try {
        const result = await syncProjectFromGit(projectPath);
        if (result.info) replace(result.info);
        setGitWarnings((current) => ({ ...current, [projectPath]: result.warnings }));
        return true;
      } catch (e) {
        ErrorHandler.handle(e, { showNotification: notify });
        return false;
      }
    },
    [replace],
  );

  useEffect(() => {
    let cancelled = false;
    getProjectInfos()
      .then((list) => {
        if (cancelled) return;
        setInfos(list);
        setError(null);
        for (const info of list.filter(tracksGit)) void runGitSync(info.projectPath, false);
      })
      .catch((e: unknown) => {
        ErrorHandler.handle(e, { showNotification: false });
        if (cancelled) return;
        setError(ErrorHandler.getMessage(e));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [attempt, runGitSync]);

  const refresh = useCallback(() => setAttempt((current) => current + 1), []);

  // Um deploy feito noutra janela (ou registado pelo hook de um terminal) aparece ao voltar a esta.
  useEffect(() => {
    let last = Date.now();
    const onReturn = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < REFRESH_ON_RETURN_MS) return;
      last = Date.now();
      refresh();
    };
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [refresh]);

  /** Ao abrir o drawer de um projeto que segue uma branch: em fundo, sem notificar. */
  const syncQuietly = useCallback(
    (projectPath: string) => {
      const info = infos.find((candidate) => candidate.projectPath === projectPath);
      if (info && tracksGit(info)) void runGitSync(projectPath, false);
    },
    [infos, runGitSync],
  );

  /** O botão **Atualizar do git** do drawer. */
  const syncFromGit = useCallback(
    async (projectPath: string): Promise<boolean> => {
      setSyncing(projectPath);
      try {
        return await runGitSync(projectPath, true);
      } finally {
        setSyncing(null);
      }
    },
    [runGitSync],
  );

  const save = useCallback(
    async (projectPath: string, info: ProjectInfoInput): Promise<ProjectInfo | null> => {
      try {
        const saved = replace(await saveProjectInfo(projectPath, info));
        // Uma branch nova (ou mudada) ainda não tem topo visto: vai buscá-lo já, sem esperar pelo botão.
        if (saved.environments.some((environment) => environment.deployBranch !== null && environment.lastGitCommit === null)) {
          void runGitSync(projectPath, true);
        }
        return saved;
      } catch (e) {
        ErrorHandler.handle(e);
        return null;
      }
    },
    [replace, runGitSync],
  );

  const remove = useCallback(async (projectPath: string): Promise<boolean> => {
    try {
      await deleteProjectInfo(projectPath);
      setInfos((current) => current.filter((info) => info.projectPath !== projectPath));
      return true;
    } catch (e) {
      ErrorHandler.handle(e);
      return false;
    }
  }, []);

  const registerDeploy = useCallback(
    async (projectPath: string, environmentId: string, deploy: DeployInput): Promise<ProjectInfo | null> => {
      try {
        return replace(await registerDeployRequest(projectPath, environmentId, deploy));
      } catch (e) {
        ErrorHandler.handle(e);
        return null;
      }
    },
    [replace],
  );

  const removeDeploy = useCallback(
    async (projectPath: string, environmentId: string, deployId: string): Promise<ProjectInfo | null> => {
      try {
        return replace(await deleteDeploy(projectPath, environmentId, deployId));
      } catch (e) {
        ErrorHandler.handle(e);
        return null;
      }
    },
    [replace],
  );

  return { infos, loading, error, refresh, save, remove, registerDeploy, removeDeploy, gitWarnings, syncing, syncFromGit, syncQuietly };
}
