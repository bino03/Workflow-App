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

/**
 * As fichas dos projetos (ADR 0028), buscadas uma vez. Cada escrita devolve a ficha nova e entra na lista sem
 * esperar por um refresh. As escritas notificam o erro (`ErrorHandler.handle`) e devolvem `null` em caso de falha.
 * Ao carregar, cada ficha com branch de deploy sincroniza do git em fundo (ADR 0034: o backend limita a 1×/5 min);
 * os avisos ficam por projeto, sem notificação.
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

  /** Um sync; `force` = o botão (notifica erros), sem `force` = em fundo (silencioso). */
  const runGitSync = useCallback(
    async (projectPath: string, force: boolean): Promise<boolean> => {
      try {
        const result = await syncProjectFromGit(projectPath, force);
        if (result.info) replace(result.info);
        setGitWarnings((current) => ({ ...current, [projectPath]: result.warnings }));
        return true;
      } catch (e) {
        ErrorHandler.handle(e, { showNotification: force });
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

  return { infos, loading, error, refresh, save, remove, registerDeploy, removeDeploy, gitWarnings, syncing, syncFromGit };
}
